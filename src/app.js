const { ChatOpenAI } = require('@langchain/openai');
const { traceable } = require('langsmith/traceable');
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
    this.memory = new ChatMemory();

    // Initialize the application
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize database
      await this.memory.initialize();
      console.log('[TFL App] Database initialized successfully');

      // Log agent initialization
      console.log('[TFL App] Agents initialized:', Object.keys(this.agents));
    } catch (error) {
      console.error('[TFL App] Initialization error:', error);
      throw error;
    }
  }
  async processQuery(query, threadId = null, userContext = {}) {
    return await this._traceableProcessQuery(query, threadId, userContext);
  }

  _traceableProcessQuery = traceable(
    async (query, threadId = null, userContext = {}) => {
    const startTime = Date.now();
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
    },
    {
      name: 'TFL_processQuery',
      project_name: process.env.LANGCHAIN_PROJECT || 'TFL-Underground-AI-Assistant',
      metadata: { 
        version: '1.0.0',
        agent_type: 'multi_agent_system'
      }
    }
  );

  // Get conversation history
  async getConversationHistory(threadId, limit = 50) {
    try {
      return await this.memory.getConversationHistory(threadId, limit);
    } catch (error) {
      console.error('[TFL App] Error getting conversation history:', error);
      return [];
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
