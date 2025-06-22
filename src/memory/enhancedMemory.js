const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { ChatMemory } = require('./chatMemory');

class EnhancedMemory extends ChatMemory {
  constructor() {
    super();
    this.model = 'gpt-4o-mini'; // Use smaller model for summarization
    this.summaryLLM = new ChatOpenAI({
      model: this.model,
      temperature: 0.3,
      timeout: 10000,
    });
    
    // Configuration for summarization
    this.summarizationConfig = {
      enableSummarization: true,
      maxMessagesBeforeSummary: 20,
      summaryLength: 'medium', // short, medium, long
      preserveImportantMessages: true,
      summaryUpdateInterval: 10 // messages
    };
  }

  async initialize() {
    await super.initialize();
    
    // Create summaries table
    await this.createSummariesTable();
    console.log('[EnhancedMemory] Enhanced memory system initialized');
  }

  async createSummariesTable() {
    const createSummariesTableSQL = `
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        start_timestamp TEXT NOT NULL,
        end_timestamp TEXT NOT NULL,
        important_topics TEXT, -- JSON array of key topics
        sentiment TEXT, -- overall conversation sentiment
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (thread_id) REFERENCES conversations (thread_id)
      )
    `;

    return new Promise((resolve, reject) => {
      this.db.run(createSummariesTableSQL, (err) => {
        if (err) {
          console.error('[EnhancedMemory] Error creating summaries table:', err);
          reject(err);
        } else {
          console.log('[EnhancedMemory] Summaries table created/verified');
          resolve();
        }
      });
    });
  }

  async saveMessage(threadId, role, content, metadata = {}) {
    // Save message using parent method
    const messageId = await super.saveMessage(threadId, role, content, metadata);

    // Check if summarization is needed
    if (this.summarizationConfig.enableSummarization) {
      await this.checkAndSummarizeIfNeeded(threadId);
    }

    return messageId;
  }

  async checkAndSummarizeIfNeeded(threadId) {
    try {
      // Temporarily disable summarization to fix column issues
      console.log(`[EnhancedMemory] Summarization temporarily disabled`);
      return;
      
      // Get message count since last summary
      const messageCount = await this.getMessageCountSinceLastSummary(threadId);
      
      if (messageCount >= this.summarizationConfig.maxMessagesBeforeSummary) {
        console.log(`[EnhancedMemory] Triggering summarization for thread ${threadId} (${messageCount} messages)`);
        await this.createConversationSummary(threadId);
      }
    } catch (error) {
      console.error('[EnhancedMemory] Error checking summarization need:', error);
      // Don't throw - summarization is not critical
    }
  }

  async getMessageCountSinceLastSummary(threadId) {
    return new Promise((resolve, reject) => {
      // Get the timestamp of the last summary
      const getLastSummarySQL = `
        SELECT end_timestamp 
        FROM conversation_summaries 
        WHERE thread_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      this.db.get(getLastSummarySQL, [threadId], (err, summary) => {
        if (err) {
          reject(err);
          return;
        }

        const sinceTimestamp = summary ? summary.end_timestamp : '1970-01-01T00:00:00.000Z';

        // Count messages since that timestamp
        const countSQL = `
          SELECT COUNT(*) as count 
          FROM messages 
          WHERE thread_id = ? AND created_at > ?
        `;

        this.db.get(countSQL, [threadId, sinceTimestamp], (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result.count);
          }
        });
      });
    });
  }

  async createConversationSummary(threadId) {
    try {
      // Get messages since last summary
      const messagesToSummarize = await this.getMessagesSinceLastSummary(threadId);
      
      if (messagesToSummarize.length === 0) {
        return null;
      }

      // Create summary using LLM
      const summary = await this.generateSummary(messagesToSummarize);
      
      // Save summary to database
      const summaryId = await this.saveSummary(threadId, summary, messagesToSummarize);
      
      console.log(`[EnhancedMemory] Created summary ${summaryId} for thread ${threadId}`);
      return summaryId;
    } catch (error) {
      console.error('[EnhancedMemory] Error creating conversation summary:', error);
      throw error;
    }
  }

  async getMessagesSinceLastSummary(threadId) {
    return new Promise((resolve, reject) => {
      // Get the timestamp of the last summary
      const getLastSummarySQL = `
        SELECT end_timestamp 
        FROM conversation_summaries 
        WHERE thread_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      this.db.get(getLastSummarySQL, [threadId], (err, summary) => {
        if (err) {
          reject(err);
          return;
        }

        const sinceTimestamp = summary ? summary.end_timestamp : '1970-01-01T00:00:00.000Z';

        // Get messages since that timestamp
        const getMessagesSQL = `
          SELECT * FROM messages 
          WHERE thread_id = ? AND created_at > ? 
          ORDER BY created_at ASC
        `;

        this.db.all(getMessagesSQL, [threadId, sinceTimestamp], (err, messages) => {
          if (err) {
            reject(err);
          } else {
            resolve(messages.map(msg => ({
              ...msg,
              metadata: msg.metadata ? JSON.parse(msg.metadata) : {}
            })));
          }
        });
      });
    });
  }

  async generateSummary(messages) {
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = this.createSummaryPrompt(conversationText);

    try {
      const response = await this.summaryLLM.invoke([
        new SystemMessage(summaryPrompt),
        new HumanMessage('Please summarize this conversation.')
      ]);

      // Parse the structured response
      const summaryContent = response.content;
      
      try {
        // Try to parse as JSON for structured summary
        const structured = JSON.parse(summaryContent);
        return {
          summary: structured.summary || summaryContent,
          importantTopics: structured.topics || [],
          sentiment: structured.sentiment || 'neutral',
          keyInsights: structured.insights || [],
          structuredSummary: structured
        };
      } catch {
        // Fallback to plain text summary
        return {
          summary: summaryContent,
          importantTopics: this.extractTopics(conversationText),
          sentiment: 'neutral',
          keyInsights: [],
          structuredSummary: null
        };
      }
    } catch (error) {
      console.error('[EnhancedMemory] Error generating summary:', error);
      
      // Fallback summary
      return {
        summary: `Conversation with ${messages.length} messages about London Underground services. Topics discussed include station information, service status, and journey planning.`,
        importantTopics: this.extractTopics(conversationText),
        sentiment: 'neutral',
        keyInsights: [],
        structuredSummary: null
      };
    }
  }

  createSummaryPrompt(conversationText) {
    return `You are a conversation summarization assistant for a London Underground AI system. 
    
TASK: Create a comprehensive but concise summary of the following conversation.

FOCUS ON:
- Transport-related queries and recommendations provided
- Station names, line names, and journey details mentioned
- Service status information discussed
- Any issues, disruptions, or problems addressed
- User preferences or patterns that emerged

OUTPUT FORMAT (JSON):
{
  "summary": "2-3 sentence overview of the conversation",
  "topics": ["topic1", "topic2", "topic3"],
  "sentiment": "positive|neutral|negative",
  "insights": ["key insight 1", "key insight 2"],
  "stationsDiscussed": ["station1", "station2"],
  "linesDiscussed": ["line1", "line2"],
  "journeyType": "station_info|service_status|journey_planning|general_inquiry"
}

CONVERSATION TO SUMMARIZE:
${conversationText}

Provide a JSON response only:`;
  }

  extractTopics(conversationText) {
    // Simple topic extraction based on keywords
    const topics = [];
    const text = conversationText.toLowerCase();

    // Line names
    const lines = ['central', 'circle', 'bakerloo', 'district', 'northern', 'piccadilly', 'victoria', 'jubilee', 'metropolitan', 'elizabeth'];
    lines.forEach(line => {
      if (text.includes(line)) topics.push(`${line} line`);
    });

    // Common topics
    if (text.includes('delay') || text.includes('disruption')) topics.push('service disruptions');
    if (text.includes('journey') || text.includes('travel')) topics.push('journey planning');
    if (text.includes('station')) topics.push('station information');
    if (text.includes('arrival') || text.includes('time')) topics.push('arrival times');
    if (text.includes('status')) topics.push('service status');

    return topics.slice(0, 5); // Limit to 5 topics
  }

  async saveSummary(threadId, summaryData, messages) {
    return new Promise((resolve, reject) => {
      const insertSQL = `
        INSERT INTO conversation_summaries (
          thread_id, summary, message_count, start_timestamp, end_timestamp,
          important_topics, sentiment
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const startTimestamp = messages[0]?.created_at || new Date().toISOString();
      const endTimestamp = messages[messages.length - 1]?.created_at || new Date().toISOString();

      this.db.run(insertSQL, [
        threadId,
        summaryData.summary,
        messages.length,
        startTimestamp,
        endTimestamp,
        JSON.stringify(summaryData.importantTopics || []),
        summaryData.sentiment || 'neutral'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getConversationHistory(threadId, limit = 50, includeContext = true) {
    try {
      // Get recent messages
      const recentMessages = await super.getConversationHistory(threadId, limit);

      if (!includeContext || !this.summarizationConfig.enableSummarization) {
        return recentMessages;
      }

      // Get conversation summaries for context
      const summaries = await this.getConversationSummaries(threadId);

      // Combine summaries with recent messages for enriched context
      const context = {
        recentMessages,
        summaries,
        totalMessages: await this.getTotalMessageCount(threadId),
        conversationStarted: summaries.length > 0 ? summaries[0].start_timestamp : 
                            (recentMessages.length > 0 ? recentMessages[0].created_at : null)
      };

      return context;
    } catch (error) {
      console.error('[EnhancedMemory] Error getting enhanced conversation history:', error);
      // Fallback to basic history
      return await super.getConversationHistory(threadId, limit);
    }
  }

  async getConversationSummaries(threadId) {
    return new Promise((resolve, reject) => {
      const getSQL = `
        SELECT * FROM conversation_summaries 
        WHERE thread_id = ? 
        ORDER BY created_at ASC
      `;

      this.db.all(getSQL, [threadId], (err, summaries) => {
        if (err) {
          reject(err);
        } else {
          resolve(summaries.map(summary => ({
            ...summary,
            important_topics: summary.important_topics ? JSON.parse(summary.important_topics) : []
          })));
        }
      });
    });
  }

  async getTotalMessageCount(threadId) {
    return new Promise((resolve, reject) => {
      const countSQL = 'SELECT COUNT(*) as count FROM messages WHERE thread_id = ?';
      
      this.db.get(countSQL, [threadId], (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.count);
        }
      });
    });
  }

  // Get conversation insights
  async getConversationInsights(threadId) {
    try {
      const summaries = await this.getConversationSummaries(threadId);
      
      if (summaries.length === 0) {
        return null;
      }

      // Aggregate insights from summaries
      const allTopics = summaries.flatMap(s => s.important_topics);
      const topicCounts = {};
      
      allTopics.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });

      const mostDiscussedTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      return {
        totalSummaries: summaries.length,
        conversationSpan: {
          start: summaries[0].start_timestamp,
          end: summaries[summaries.length - 1].end_timestamp
        },
        mostDiscussedTopics,
        overallSentiment: this.calculateOverallSentiment(summaries),
        totalMessagesSummarized: summaries.reduce((sum, s) => sum + s.message_count, 0)
      };
    } catch (error) {
      console.error('[EnhancedMemory] Error getting conversation insights:', error);
      return null;
    }
  }

  calculateOverallSentiment(summaries) {
    const sentiments = summaries.map(s => s.sentiment);
    const counts = { positive: 0, neutral: 0, negative: 0 };
    
    sentiments.forEach(sentiment => {
      counts[sentiment] = (counts[sentiment] || 0) + 1;
    });

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  // Update configuration
  updateSummarizationConfig(newConfig) {
    this.summarizationConfig = {
      ...this.summarizationConfig,
      ...newConfig
    };
    console.log('[EnhancedMemory] Summarization config updated:', this.summarizationConfig);
  }

  // Manually trigger summarization
  async triggerSummary(threadId) {
    return await this.createConversationSummary(threadId);
  }

  // Health check with enhanced features
  async healthCheck() {
    try {
      const basicHealth = await super.healthCheck();
      
      if (!basicHealth) return false;

      // Test summarization table
      return new Promise((resolve) => {
        this.db.get('SELECT COUNT(*) as count FROM conversation_summaries', (err) => {
          resolve(!err);
        });
      });
    } catch (error) {
      console.error('[EnhancedMemory] Enhanced health check failed:', error);
      return false;
    }
  }
}

module.exports = { EnhancedMemory };