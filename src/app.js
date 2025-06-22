const { ChatOpenAI } = require('@langchain/openai');
// LangSmith tracing removed
const { RouterAgent } = require('./agents/routerAgent');
const { CircleAgent } = require('./agents/circleAgent');
const { BakerlooAgent } = require('./agents/bakerlooAgent');
const { DistrictAgent } = require('./agents/districtAgent');
const { CentralAgent } = require('./agents/centralAgent');
const { NorthernAgent } = require('./agents/northernAgent');
const { PiccadillyAgent } = require('./agents/piccadillyAgent');
const { VictoriaAgent } = require('./agents/victoriaAgent');
const { JubileeAgent } = require('./agents/jubileeAgent');
const { MetropolitanAgent } = require('./agents/metropolitanAgent');
const { HammersmithCityAgent } = require('./agents/hammersmithCityAgent');
const { WaterlooCityAgent } = require('./agents/waterlooCityAgent');
const { ElizabethAgent } = require('./agents/elizabethAgent');
const { StatusAgent } = require('./agents/statusAgent');
const { StartNode } = require('./utils/startNode');
const { GraphState } = require('./utils/graphState');
const { ChatMemory } = require('./memory/chatMemory');
const { EnhancedMemory } = require('./memory/enhancedMemory');
const { TFLWorkflow } = require('./workflows/tflWorkflow');
const { CollaborativeWorkflow } = require('./workflows/collaborativeWorkflow');

class TFLUndergroundApp {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;

    // Initialize shared LLM instance for efficiency
    this.sharedLLM = new ChatOpenAI({
      model: this.model,
      temperature: this.temperature,
    });

    // Initialize agents
    this.agents = {
      router: new RouterAgent(),
      circle: new CircleAgent(),
      bakerloo: new BakerlooAgent(),
      district: new DistrictAgent(),
      central: new CentralAgent(),
      northern: new NorthernAgent(),
      piccadilly: new PiccadillyAgent(),
      victoria: new VictoriaAgent(),
      jubilee: new JubileeAgent(),
      metropolitan: new MetropolitanAgent(),
      hammersmith_city: new HammersmithCityAgent(),
      waterloo_city: new WaterlooCityAgent(),
      elizabeth: new ElizabethAgent(),
      status: new StatusAgent(),
    };

    // Initialize workflow components
    this.startNode = new StartNode();
    this.memory = new EnhancedMemory(); // Use enhanced memory with summarization
    this.workflow = null; // Will be initialized after memory
    this.collaborativeWorkflow = null; // Will be initialized after memory

    // Initialize the application
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize database
      await this.memory.initialize();
      console.log('[TFL App] Database initialized successfully');

      // Initialize LangGraph workflow
      this.workflow = new TFLWorkflow(this.agents, this.memory, this.sharedLLM);
      console.log('[TFL App] LangGraph workflow initialized successfully');

      // Initialize collaborative workflow
      this.collaborativeWorkflow = new CollaborativeWorkflow(this.agents, this.memory, this.sharedLLM);
      console.log('[TFL App] Collaborative workflow initialized successfully');

      // Log agent initialization
      console.log('[TFL App] Agents initialized:', Object.keys(this.agents));
    } catch (error) {
      console.error('[TFL App] Initialization error:', error);
      throw error;
    }
  }
  async processQuery(query, threadId = null, userContext = {}) {
    return await this._processQuery(query, threadId, userContext);
  }

  async processQueryWithConfirmation(query, threadId = null, userContext = {}, userConfirmation = null) {
    return await this._processQueryWithConfirmation(query, threadId, userContext, userConfirmation);
  }

  _processQuery = async (query, threadId = null, userContext = {}) => {
      const startTime = Date.now();

      try {
        console.log(`[TFL App] Processing query with LangGraph workflow: "${query.substring(0, 100)}..."`);

        // Prepare initial state for workflow
        const initialState = {
          query,
          threadId,
          userContext,
          conversationHistory: threadId ? await this.getConversationHistory(threadId, 10) : []
        };

        // Determine whether to use collaborative workflow
        const useCollaborative = this.shouldUseCollaborativeWorkflow(query);
        
        // Execute the appropriate workflow
        const result = useCollaborative 
          ? await this.collaborativeWorkflow.execute(initialState)
          : await this.workflow.execute(initialState);

        // Format response for compatibility with existing API
        const response = {
          response: result.synthesizedResponse || result.agentResponse || result.error?.message || "I apologize, but I couldn't process your request.",
          agent: result.primaryAgent || result.selectedAgent || 'unknown',
          lineColor: this.getAgentLineColor(result.primaryAgent || result.selectedAgent),
          confidence: result.confidence || 0.1,
          threadId: result.threadId,
          tflData: result.tflData,
          collaborative: useCollaborative,
          agentsUsed: result.metadata?.agentsUsed || [result.selectedAgent].filter(Boolean),
          metadata: {
            ...result.metadata,
            processingTime: result.metadata?.processingTime || (Date.now() - startTime),
            timestamp: new Date().toISOString(),
            workflowUsed: useCollaborative ? 'collaborative' : 'standard',
            llmModel: this.model
          }
        };

        console.log(`[TFL App] Query processed successfully with workflow in ${response.metadata.processingTime}ms`);
        return response;

      } catch (error) {
        console.error('[TFL App] Workflow processing error:', error);
        
        // Fallback to legacy processing if workflow fails
        return await this._legacyProcessQuery(query, threadId, userContext, startTime);
      }
    };

  _processQueryWithConfirmation = async (query, threadId = null, userContext = {}, userConfirmation = null) => {
      const startTime = Date.now();

      try {
        console.log(`[TFL App] Processing query with confirmation: "${query.substring(0, 100)}..."`);

        // Prepare initial state for workflow with confirmation
        const initialState = {
          query,
          threadId,
          userContext,
          userConfirmation,
          conversationHistory: threadId ? await this.getConversationHistory(threadId, 10) : []
        };

        // Determine whether to use collaborative workflow
        const useCollaborative = this.shouldUseCollaborativeWorkflow(query);
        
        // Execute the appropriate workflow
        const result = useCollaborative 
          ? await this.collaborativeWorkflow.execute(initialState)
          : await this.workflow.execute(initialState);

        // Format response
        const response = {
          response: result.agentResponse,
          agent: result.selectedAgent || 'unknown',
          lineColor: this.getAgentLineColor(result.selectedAgent),
          confidence: result.confidence || 0.1,
          threadId: result.threadId,
          tflData: result.tflData,
          requiresConfirmation: result.requiresConfirmation,
          awaitingConfirmation: result.metadata?.awaitingConfirmation,
          metadata: {
            ...result.metadata,
            processingTime: result.metadata?.processingTime || (Date.now() - startTime),
            timestamp: new Date().toISOString(),
            workflowUsed: true,
            llmModel: this.model
          }
        };

        return response;

      } catch (error) {
        console.error('[TFL App] Workflow confirmation processing error:', error);
        throw error;
      }
    };

  // Legacy processing method as fallback
  async _legacyProcessQuery(query, threadId, userContext, startTime) {
    let graphState = new GraphState();

    try {
      console.log(
        `[TFL App] Processing query: "${query.substring(0, 100)}..."`,
      ); // Step 1: Start Node - Initialize and validate input
      const startResult = await this.startNode.processWithValidation({
        query,
        threadId,
        userContext,
      });

      if (!startResult.success) {
        throw new Error(`Start node failed: ${startResult.error.message}`);
      }

      graphState = startResult.graphState;
      const state = startResult.state;

      // Step 2: Router - Determine which agent to use
      console.log('[TFL App] Routing query to appropriate agent...');

      const routerResult = await this.agents.router.processQuery(
        state.query,
        this.sharedLLM,
        state.userContext,
      );

      if (!routerResult.selectedAgent) {
        throw new Error('Router failed to select an agent');
      }

      // Handle content filtering responses
      if (routerResult.selectedAgent === 'OFF_TOPIC' || routerResult.selectedAgent === 'INAPPROPRIATE') {
        console.log(`[TFL App] Query filtered: ${routerResult.selectedAgent}`);
        
        // Save filtered query to memory if threadId provided
        if (threadId) {
          try {
            await this.memory.saveMessage(threadId, 'user', query, {
              userContext,
              timestamp: new Date().toISOString(),
            });
            
            await this.memory.saveMessage(threadId, 'assistant', routerResult.message, {
              agent: 'filter',
              confidence: 1.0,
              filtered: true,
              filterType: routerResult.selectedAgent,
              processingTime: Date.now() - startTime,
            });
          } catch (memoryError) {
            console.error('[TFL App] Memory save error for filtered query:', memoryError);
          }
        }
        
        return {
          response: routerResult.message,
          agent: 'filter',
          lineColor: '#FFA500', // Orange for filtered content
          confidence: 1.0,
          threadId: threadId || graphState.state.threadId,
          filtered: true,
          filterType: routerResult.selectedAgent,
          metadata: {
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            nodeSequence: ['start', 'router', 'filter'],
            llmModel: this.model,
          },
        };
      }

      // Update state with router decision
      graphState.setSelectedAgent(
        routerResult.selectedAgent,
        routerResult.confidence,
      );

      console.log(
        `[TFL App] Router selected: ${routerResult.selectedAgent} (confidence: ${routerResult.confidence})`,
      );

      // Step 3: Agent Processing - Execute selected agent
      let agentResponse;
      const selectedAgentName = routerResult.selectedAgent;

      if (!this.agents[selectedAgentName]) {
        throw new Error(`Agent "${selectedAgentName}" not found`);
      }

      console.log(`[TFL App] Processing with ${selectedAgentName} agent...`);

      agentResponse = await this.agents[selectedAgentName].processQuery(
        state.query,
        this.sharedLLM,
        {
          ...state.userContext,
          routerConfidence: routerResult.confidence,
          conversationHistory: state.conversationHistory,
        },
      );

      // Update state with agent response
      graphState.setAgentResponse(
        agentResponse.response,
        agentResponse.tflData,
      );
      graphState.addToHistory('assistant', agentResponse.response, {
        agent: selectedAgentName,
        confidence: agentResponse.confidence,
        lineColor: agentResponse.lineColor,
        tflDataIncluded: !!agentResponse.tflData,
      });

      // Step 4: Memory - Save conversation
      if (state.threadId) {
        try {
          await this.memory.saveMessage(state.threadId, 'user', state.query, {
            userContext: state.userContext,
            timestamp: state.metadata.timestamp,
          });

          await this.memory.saveMessage(
            state.threadId,
            'assistant',
            agentResponse.response,
            {
              agent: selectedAgentName,
              confidence: agentResponse.confidence,
              lineColor: agentResponse.lineColor,
              tflData: agentResponse.tflData,
              processingTime: Date.now() - startTime,
            },
          );
        } catch (memoryError) {
          console.error('[TFL App] Memory save error:', memoryError);
          // Don't fail the request for memory errors
        }
      }

      // Step 5: Finalize response
      const processingTime = Date.now() - startTime;
      graphState.setProcessingTime(startTime);

      const finalResponse = {
        response: agentResponse.response,
        agent: selectedAgentName,
        lineColor: agentResponse.lineColor,
        confidence: agentResponse.confidence,
        threadId: state.threadId,
        tflData: agentResponse.tflData,
        metadata: {
          processingTime,
          timestamp: new Date().toISOString(),
          routerConfidence: routerResult.confidence,
          nodeSequence: ['start', 'router', selectedAgentName],
          llmModel: this.model,
        },
      };

      console.log(
        `[TFL App] Query processed successfully in ${processingTime}ms`,
      );

      return finalResponse;
    } catch (error) {
      console.error('[TFL App] Processing error:', error);

      // Update state with error
      graphState.setError(error);

      // Try to save error to memory
      if (threadId) {
        try {
          await this.memory.saveMessage(
            threadId,
            'system',
            `Error: ${error.message}`,
            {
              error: true,
              errorType: error.constructor.name,
              processingTime: Date.now() - startTime,
            },
          );
        } catch (memoryError) {
          console.error('[TFL App] Error saving error to memory:', memoryError);
        }
      }

      // Return error response
      return {
        response:
          'I apologize, but I encountered an error processing your query. Please try again or contact TFL customer service for immediate assistance.',
        agent: 'error',
        lineColor: '#DC143C', // Crimson for errors
        confidence: 0.1,
        threadId: threadId || graphState.state.threadId,
        error: {
          message: error.message,
          type: error.constructor.name,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          failed: true,
        },
      };
    }
  }

  // Helper method to determine if collaborative workflow should be used
  shouldUseCollaborativeWorkflow(query) {
    const collaborativeKeywords = [
      'journey from .+ to',
      'travel from .+ to',
      'route from .+ to',
      'best way from .+ to',
      'how to get from .+ to',
      'compare',
      'alternative',
      'interchange',
      'change at',
      'multiple lines',
      'all lines',
      'network status',
      'overall service',
      'which lines serve',
      'accessibility at'
    ];

    const queryLower = query.toLowerCase();
    return collaborativeKeywords.some(keyword => 
      new RegExp(keyword, 'i').test(queryLower)
    );
  }

  // Helper method to get agent line colors
  getAgentLineColor(agentName) {
    const lineColors = {
      circle: '#FFD329',
      bakerloo: '#B36305', 
      district: '#00782A',
      central: '#E32017',
      northern: '#000000',
      piccadilly: '#003688',
      victoria: '#0098D4',
      jubilee: '#A0A5A9',
      metropolitan: '#9B0056',
      hammersmith_city: '#F3A9BB',
      waterloo_city: '#95CDBA',
      elizabeth: '#6950A1',
      status: '#0098D4',
      filter: '#FFA500',
      fallback: '#DC143C',
      error: '#DC143C'
    };
    return lineColors[agentName] || '#666666';
  }

  // Streaming query processing
  async *streamQuery(query, threadId = null, userContext = {}) {
    console.log(`[TFL App] Starting streaming query: "${query.substring(0, 100)}..."`);
    
    try {
      const initialState = {
        query,
        threadId,
        userContext,
        conversationHistory: threadId ? await this.getConversationHistory(threadId, 10) : [],
        streamingEnabled: true
      };

      // Stream workflow execution
      for await (const step of this.workflow.stream(initialState)) {
        const stepName = Object.keys(step)[0];
        const stepState = step[stepName];
        
        // Format streaming update
        const update = {
          step: stepName,
          agent: stepState.selectedAgent,
          partialResponse: stepState.agentResponse,
          confidence: stepState.confidence,
          metadata: {
            timestamp: new Date().toISOString(),
            streaming: true
          }
        };
        
        yield update;
      }
    } catch (error) {
      console.error('[TFL App] Streaming error:', error);
      yield {
        error: true,
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Get conversation history
  async getConversationHistory(threadId, limit = 50) {
    try {
      return await this.memory.getConversationHistory(threadId, limit);
    } catch (error) {
      console.error('[TFL App] Error getting conversation history:', error);
      return [];
    }
  }

  // Get conversation insights
  async getConversationInsights(threadId) {
    try {
      if (this.memory.getConversationInsights) {
        return await this.memory.getConversationInsights(threadId);
      }
      return null;
    } catch (error) {
      console.error('[TFL App] Error getting conversation insights:', error);
      return null;
    }
  }

  // Trigger manual summarization
  async triggerSummarization(threadId) {
    try {
      if (this.memory.triggerSummary) {
        return await this.memory.triggerSummary(threadId);
      }
      return null;
    } catch (error) {
      console.error('[TFL App] Error triggering summarization:', error);
      return null;
    }
  }

  // Get system health status
  async getHealthStatus() {
    try {
      // Test database connection
      const dbStatus = await this.memory.healthCheck();

      // Test LLM connection
      let llmStatus = false;
      try {
        await this.sharedLLM.invoke([{ role: 'user', content: 'test' }]);
        llmStatus = true;
      } catch (llmError) {
        console.error('[TFL App] LLM health check failed:', llmError);
      }

      // Test agent availability
      const agentStatus = Object.keys(this.agents).reduce(
        (status, agentName) => {
          status[agentName] =
            typeof this.agents[agentName].processQuery === 'function';
          return status;
        },
        {},
      );

      return {
        healthy: dbStatus && llmStatus,
        components: {
          database: dbStatus,
          llm: llmStatus,
          agents: agentStatus,
        },
        timestamp: new Date().toISOString(),
        model: this.model,
        version: '1.0.0',
      };
    } catch (error) {
      console.error('[TFL App] Health check error:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Get application info
  getInfo() {
    return {
      name: 'TFL Underground AI Assistant',
      description:
        'Multi-agent conversational AI system for London Underground transport information',
      version: '1.0.0',
      agents: Object.keys(this.agents),
      model: this.model,
      capabilities: [
        'Real-time TFL Underground information',
        'Circle Line specialist',
        'Bakerloo Line specialist',
        'District Line specialist',
        'Central Line specialist',
        'Network Status specialist',
        'Journey planning',
        'Service status updates',
        'Station information',
        'Conversation memory',
      ],
      endpoints: {
        chat: 'POST /api/chat',
        health: 'GET /api/health',
        history: 'GET /api/conversations/:threadId',
      },
    };
  }

  // Cleanup resources
  async shutdown() {
    try {
      console.log('[TFL App] Shutting down...');

      // Close database connections
      if (this.memory && this.memory.close) {
        await this.memory.close();
      }

      console.log('[TFL App] Shutdown complete');
    } catch (error) {
      console.error('[TFL App] Shutdown error:', error);
    }
  }
}

module.exports = { TFLUndergroundApp };
