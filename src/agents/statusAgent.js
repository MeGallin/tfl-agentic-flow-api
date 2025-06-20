const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { StatusTools } = require('../tools/statusTools');
const { createStatusPrompt } = require('../prompts/statusPrompt');

class StatusAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;
    this.tools = new StatusTools();
    this.lineColor = '#000000'; // Black for network status
  }

  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[StatusAgent] Starting to process query...');

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000, // 10 second timeout
        });

      console.log('[StatusAgent] LLM initialized, fetching TFL status data...');

      // Determine what type of status query this is
      const queryType = this.detectStatusQueryType(query);
      let statusData;

      switch (queryType) {
        case 'disrupted':
          statusData = await this.tools.getDisruptedLines();
          break;
        case 'good_service':
          statusData = await this.tools.getGoodServiceLines();
          break;
        case 'overview':
          statusData = await this.tools.getOverallNetworkStatus();
          break;
        default:
          statusData = await this.tools.getAllLinesStatus(query);
          break;
      }

      console.log('[StatusAgent] Status data fetched, preparing prompt...');

      const systemPrompt = createStatusPrompt(statusData);
      console.log('[StatusAgent] Calling LLM...');

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      console.log('[StatusAgent] LLM response received, preparing final response...');

      return {
        response: response.content,
        agent: 'STATUS',
        statusData: statusData,
        lineColor: this.lineColor,
        specialization: 'London Underground Network Status',
        queryType: queryType,
      };
    } catch (error) {
      console.error('[StatusAgent] Status Agent error:', error);
      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Network Status specialist, I'm unable to provide status information at the moment. Please try again shortly.",
        agent: 'STATUS',
        statusData: null,
        lineColor: this.lineColor,
        error: error.message,
      };
    }
  }

  async getAllLinesStatus() {
    return await this.tools.getAllLinesStatus();
  }

  async getDisruptedLines() {
    return await this.tools.getDisruptedLines();
  }

  async getGoodServiceLines() {
    return await this.tools.getGoodServiceLines();
  }

  async getOverallNetworkStatus() {
    return await this.tools.getOverallNetworkStatus();
  }

  detectStatusQueryType(query) {
    const lowerQuery = query.toLowerCase();

    // Check for disruption-related queries
    const disruptionKeywords = [
      'disruption',
      'delay',
      'problem',
      'issue',
      'suspended',
      'closed',
      'fault',
      'not running',
      'disrupted',
    ];

    // Check for good service queries
    const goodServiceKeywords = [
      'good service',
      'running normally',
      'no problems',
      'working',
      'normal',
    ];

    // Check for overview queries
    const overviewKeywords = [
      'overall',
      'network',
      'all lines',
      'summary',
      'status',
      'how is',
      'what is',
    ];

    if (disruptionKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'disrupted';
    }

    if (goodServiceKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'good_service';
    }

    if (overviewKeywords.some((keyword) => lowerQuery.includes(keyword))) {
      return 'overview';
    }

    // Default to showing all lines status
    return 'all_lines';
  }
}

module.exports = { StatusAgent };