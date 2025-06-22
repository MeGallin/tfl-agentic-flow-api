const { StateGraph, START, END } = require('@langchain/langgraph');
const { GraphState } = require('../utils/graphState');
const { RouterAgent } = require('../agents/routerAgent');

class TFLWorkflow {
  constructor(agents, memory, sharedLLM) {
    this.agents = agents;
    this.memory = memory;
    this.sharedLLM = sharedLLM;
    this.router = new RouterAgent();
    
    // Create the workflow
    this.workflow = this.createWorkflow();
  }

  createWorkflow() {
    const workflow = new StateGraph({
      channels: {
        query: null,
        threadId: null,
        userContext: null,
        selectedAgent: null,
        agentResponse: null,
        confidence: null,
        tflData: null,
        conversationHistory: null,
        error: null,
        metadata: null,
        requiresConfirmation: null,
        userConfirmation: null,
        fallbackRequired: null,
        streamingEnabled: null
      }
    });

    // Add nodes
    workflow.addNode('input_validation', this.validateInput.bind(this));
    workflow.addNode('route_query', this.routeQuery.bind(this));
    workflow.addNode('process_agent', this.processAgent.bind(this));
    workflow.addNode('check_confirmation', this.checkConfirmation.bind(this));
    workflow.addNode('await_confirmation', this.awaitConfirmation.bind(this));
    workflow.addNode('fallback_handler', this.handleFallback.bind(this));
    workflow.addNode('save_memory', this.saveMemory.bind(this));
    workflow.addNode('finalize_response', this.finalizeResponse.bind(this));

    // Add edges
    workflow.addEdge(START, 'input_validation');
    
    // Conditional routing based on validation
    workflow.addConditionalEdges(
      'input_validation',
      this.shouldRoute.bind(this),
      {
        'route': 'route_query',
        'error': 'fallback_handler'
      }
    );

    // Route to appropriate agent
    workflow.addEdge('route_query', 'process_agent');

    // Check if confirmation is needed
    workflow.addConditionalEdges(
      'process_agent',
      this.needsConfirmation.bind(this),
      {
        'confirm': 'check_confirmation',
        'proceed': 'save_memory',
        'fallback': 'fallback_handler'
      }
    );

    // Handle confirmation workflow
    workflow.addConditionalEdges(
      'check_confirmation',
      this.evaluateConfirmation.bind(this),
      {
        'await': 'await_confirmation',
        'approved': 'save_memory',
        'rejected': 'route_query'
      }
    );

    workflow.addEdge('await_confirmation', 'check_confirmation');
    workflow.addEdge('fallback_handler', 'save_memory');
    workflow.addEdge('save_memory', 'finalize_response');
    workflow.addEdge('finalize_response', END);

    return workflow.compile();
  }

  // Node implementations
  async validateInput(state) {
    console.log('[TFLWorkflow] Validating input...');
    
    if (!state.query || state.query.trim().length === 0) {
      return {
        ...state,
        error: {
          message: 'Please provide a valid query',
          type: 'validation_error'
        }
      };
    }

    // Initialize metadata
    const metadata = {
      timestamp: new Date().toISOString(),
      processingTime: 0,
      apiCalls: 0,
      workflowPath: ['input_validation']
    };

    return {
      ...state,
      query: state.query.trim(),
      threadId: state.threadId || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata
    };
  }

  async routeQuery(state) {
    console.log('[TFLWorkflow] Routing query...');
    
    try {
      const routerResult = await this.router.processQuery(
        state.query,
        this.sharedLLM,
        state.userContext
      );

      // Handle off-topic or inappropriate queries
      if (routerResult.selectedAgent === 'OFF_TOPIC' || routerResult.selectedAgent === 'INAPPROPRIATE') {
        return {
          ...state,
          agentResponse: routerResult.message,
          selectedAgent: 'filter',
          confidence: 1.0,
          metadata: {
            ...state.metadata,
            workflowPath: [...state.metadata.workflowPath, 'route_query_filtered']
          }
        };
      }

      return {
        ...state,
        selectedAgent: routerResult.selectedAgent,
        confidence: routerResult.confidence,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'route_query'],
          routerConfidence: routerResult.confidence
        }
      };
    } catch (error) {
      console.error('[TFLWorkflow] Routing error:', error);
      return {
        ...state,
        error: {
          message: error.message,
          type: 'routing_error'
        },
        fallbackRequired: true
      };
    }
  }

  async processAgent(state) {
    console.log(`[TFLWorkflow] Processing with ${state.selectedAgent} agent...`);
    
    try {
      if (!this.agents[state.selectedAgent]) {
        throw new Error(`Agent "${state.selectedAgent}" not found`);
      }

      const agentResponse = await this.agents[state.selectedAgent].processQuery(
        state.query,
        this.sharedLLM,
        {
          ...state.userContext,
          routerConfidence: state.confidence,
          conversationHistory: state.conversationHistory
        }
      );

      // Check if this is a complex journey that might need confirmation
      const requiresConfirmation = this.detectComplexJourney(state.query, agentResponse);

      return {
        ...state,
        agentResponse: agentResponse.response,
        tflData: agentResponse.tflData,
        requiresConfirmation,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'process_agent'],
          agentUsed: state.selectedAgent,
          agentConfidence: agentResponse.confidence
        }
      };
    } catch (error) {
      console.error('[TFLWorkflow] Agent processing error:', error);
      return {
        ...state,
        error: {
          message: error.message,
          type: 'agent_error'
        },
        fallbackRequired: true
      };
    }
  }

  async checkConfirmation(state) {
    console.log('[TFLWorkflow] Checking confirmation status...');
    
    // This would be enhanced to handle real user confirmation
    // For now, we'll simulate based on query complexity
    return {
      ...state,
      userConfirmation: state.userConfirmation || null,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'check_confirmation']
      }
    };
  }

  async awaitConfirmation(state) {
    console.log('[TFLWorkflow] Awaiting user confirmation...');
    
    // Enhanced confirmation response
    const confirmationPrompt = `${state.agentResponse}\n\n❓ **Confirmation Required**\nThis journey involves multiple steps. Would you like me to proceed with this recommendation?\n\nReply with "yes" to confirm or "no" to see alternatives.`;
    
    return {
      ...state,
      agentResponse: confirmationPrompt,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'await_confirmation'],
        awaitingConfirmation: true
      }
    };
  }

  async handleFallback(state) {
    console.log('[TFLWorkflow] Handling fallback...');
    
    const fallbackMessage = state.error ? 
      `I apologize, but I encountered an issue: ${state.error.message}. Please try rephrasing your question or contact TFL customer service for immediate assistance.` :
      "I'm having trouble processing your request at the moment. Please try again or ask me something else about London Underground services.";

    return {
      ...state,
      agentResponse: fallbackMessage,
      selectedAgent: 'fallback',
      confidence: 0.1,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'fallback_handler'],
        fallbackReason: state.error?.type || 'unknown'
      }
    };
  }

  async saveMemory(state) {
    console.log('[TFLWorkflow] Saving to memory...');
    
    try {
      if (state.threadId && this.memory) {
        // Save user message
        await this.memory.saveMessage(state.threadId, 'user', state.query, {
          userContext: state.userContext,
          timestamp: state.metadata.timestamp
        });

        // Save assistant response
        await this.memory.saveMessage(state.threadId, 'assistant', state.agentResponse, {
          agent: state.selectedAgent,
          confidence: state.confidence,
          tflData: state.tflData,
          workflowPath: state.metadata.workflowPath,
          processingTime: Date.now() - new Date(state.metadata.timestamp).getTime()
        });
      }

      return {
        ...state,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'save_memory'],
          memorySaved: true
        }
      };
    } catch (error) {
      console.error('[TFLWorkflow] Memory save error:', error);
      // Don't fail the entire workflow for memory errors
      return {
        ...state,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'save_memory_failed'],
          memoryError: error.message
        }
      };
    }
  }

  async finalizeResponse(state) {
    console.log('[TFLWorkflow] Finalizing response...');
    
    const processingTime = Date.now() - new Date(state.metadata.timestamp).getTime();
    
    return {
      ...state,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'finalize_response'],
        processingTime,
        completed: true
      }
    };
  }

  // Condition functions
  shouldRoute(state) {
    return state.error ? 'error' : 'route';
  }

  needsConfirmation(state) {
    if (state.error || state.fallbackRequired) {
      return 'fallback';
    }
    return state.requiresConfirmation ? 'confirm' : 'proceed';
  }

  evaluateConfirmation(state) {
    if (state.userConfirmation === null || state.userConfirmation === undefined) {
      // If no confirmation provided, proceed without confirmation for now
      // In a real implementation, this would wait for user input
      console.log('[TFLWorkflow] No user confirmation provided, proceeding without confirmation');
      return 'approved';
    }
    return state.userConfirmation ? 'approved' : 'rejected';
  }

  // Helper methods
  detectComplexJourney(query, agentResponse) {
    // Temporarily disable complex journey detection to avoid confirmation loops
    return false;
    
    // const complexityIndicators = [
    //   'interchange',
    //   'change at',
    //   'multiple lines',
    //   'alternative route',
    //   'disruption',
    //   'delayed',
    //   'suspended'
    // ];

    // const queryText = (query + ' ' + (agentResponse.response || '')).toLowerCase();
    // return complexityIndicators.some(indicator => queryText.includes(indicator));
  }

  // Main execution method
  async execute(initialState) {
    console.log('[TFLWorkflow] Starting workflow execution...');
    
    try {
      const result = await this.workflow.invoke(initialState);
      console.log('[TFLWorkflow] Workflow completed successfully');
      return result;
    } catch (error) {
      console.error('[TFLWorkflow] Workflow execution error:', error);
      throw error;
    }
  }

  // Stream execution for real-time updates
  async *stream(initialState) {
    console.log('[TFLWorkflow] Starting streaming workflow execution...');
    
    try {
      // For now, fall back to regular execution since StateGraph.stream() is not available
      const result = await this.workflow.invoke(initialState);
      
      // Simulate streaming by yielding the final result
      yield {
        finalize_response: result
      };
    } catch (error) {
      console.error('[TFLWorkflow] Streaming workflow error:', error);
      throw error;
    }
  }

  // Get workflow visualization
  getWorkflowVisualization() {
    return this.workflow.getGraph();
  }
}

module.exports = { TFLWorkflow };