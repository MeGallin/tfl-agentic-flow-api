const { StateGraph, START, END } = require('@langchain/langgraph');
const { EnhancedAgent } = require('../agents/enhancedAgent');

class CollaborativeWorkflow {
  constructor(agents, memory, sharedLLM) {
    this.agents = agents;
    this.memory = memory;
    this.sharedLLM = sharedLLM;
    
    // Initialize enhanced agents for collaboration
    this.enhancedAgents = this.initializeEnhancedAgents();
    
    // Create the collaborative workflow
    this.workflow = this.createCollaborativeWorkflow();
  }

  initializeEnhancedAgents() {
    const enhancedAgents = {};
    
    // Agent configurations with their specializations
    const agentConfigs = {
      central: { color: '#E32017', specialization: 'Central Line Underground Services' },
      circle: { color: '#FFD329', specialization: 'Circle Line Underground Services' },
      bakerloo: { color: '#B36305', specialization: 'Bakerloo Line Underground Services' },
      district: { color: '#00782A', specialization: 'District Line Underground Services' },
      northern: { color: '#000000', specialization: 'Northern Line Underground Services' },
      piccadilly: { color: '#003688', specialization: 'Piccadilly Line Underground Services' },
      victoria: { color: '#0098D4', specialization: 'Victoria Line Underground Services' },
      jubilee: { color: '#A0A5A9', specialization: 'Jubilee Line Underground Services' },
      metropolitan: { color: '#9B0056', specialization: 'Metropolitan Line Underground Services' },
      hammersmith_city: { color: '#F3A9BB', specialization: 'Hammersmith & City Line Underground Services' },
      waterloo_city: { color: '#95CDBA', specialization: 'Waterloo & City Line Underground Services' },
      elizabeth: { color: '#6950A1', specialization: 'Elizabeth Line Underground Services' },
      status: { color: '#0098D4', specialization: 'Network Status and General Information' }
    };

    for (const [agentName, config] of Object.entries(agentConfigs)) {
      if (this.agents[agentName]) {
        enhancedAgents[agentName] = new EnhancedAgent(
          agentName,
          config.color,
          config.specialization
        );
      }
    }

    return enhancedAgents;
  }

  createCollaborativeWorkflow() {
    const workflow = new StateGraph({
      channels: {
        query: null,
        threadId: null,
        userContext: null,
        primaryAgent: null,
        collaboratingAgents: null,
        agentResponses: null,
        synthesizedResponse: null,
        confidence: null,
        tflData: null,
        conversationHistory: null,
        error: null,
        metadata: null,
        requiresCollaboration: null,
        collaborationType: null,
        multiLineJourney: null
      }
    });

    // Add nodes for collaborative processing
    workflow.addNode('analyze_complexity', this.analyzeQueryComplexity.bind(this));
    workflow.addNode('route_primary_agent', this.routePrimaryAgent.bind(this));
    workflow.addNode('identify_collaborators', this.identifyCollaborators.bind(this));
    workflow.addNode('execute_primary_agent', this.executePrimaryAgent.bind(this));
    workflow.addNode('execute_collaborating_agents', this.executeCollaboratingAgents.bind(this));
    workflow.addNode('synthesize_responses', this.synthesizeResponses.bind(this));
    workflow.addNode('validate_synthesis', this.validateSynthesis.bind(this));
    workflow.addNode('finalize_collaborative_response', this.finalizeCollaborativeResponse.bind(this));

    // Add edges
    workflow.addEdge(START, 'analyze_complexity');
    
    // Conditional routing based on complexity
    workflow.addConditionalEdges(
      'analyze_complexity',
      this.shouldCollaborate.bind(this),
      {
        'collaborate': 'route_primary_agent',
        'single_agent': 'route_primary_agent'
      }
    );

    workflow.addEdge('route_primary_agent', 'identify_collaborators');
    workflow.addEdge('identify_collaborators', 'execute_primary_agent');
    
    // Conditional collaboration
    workflow.addConditionalEdges(
      'execute_primary_agent',
      this.needsAdditionalAgents.bind(this),
      {
        'collaborate': 'execute_collaborating_agents',
        'single': 'synthesize_responses'
      }
    );

    workflow.addEdge('execute_collaborating_agents', 'synthesize_responses');
    workflow.addEdge('synthesize_responses', 'validate_synthesis');
    
    // Validation routing
    workflow.addConditionalEdges(
      'validate_synthesis',
      this.isValidSynthesis.bind(this),
      {
        'valid': 'finalize_collaborative_response',
        'retry': 'synthesize_responses'
      }
    );

    workflow.addEdge('finalize_collaborative_response', END);

    return workflow.compile();
  }

  // Node implementations
  async analyzeQueryComplexity(state) {
    console.log('[CollaborativeWorkflow] Analyzing query complexity...');
    
    const query = state.query.toLowerCase();
    
    // Patterns that indicate multi-agent collaboration needs
    const collaborationIndicators = {
      multiLineJourney: [
        'from .+ to .+',
        'journey from',
        'travel from .+ to',
        'route from .+ to',
        'interchange',
        'change at',
        'connect'
      ],
      networkStatus: [
        'all lines',
        'network status',
        'overall service',
        'general status',
        'multiple lines'
      ],
      comparison: [
        'compare',
        'better route',
        'alternative',
        'fastest way',
        'quickest route'
      ],
      stationInfo: [
        'facilities at',
        'accessibility',
        'step free access',
        'which lines serve'
      ]
    };

    let requiresCollaboration = false;
    let collaborationType = 'single';
    let multiLineJourney = false;

    // Check for collaboration indicators
    for (const [type, patterns] of Object.entries(collaborationIndicators)) {
      for (const pattern of patterns) {
        if (new RegExp(pattern, 'i').test(query)) {
          requiresCollaboration = true;
          collaborationType = type;
          if (type === 'multiLineJourney') {
            multiLineJourney = true;
          }
          break;
        }
      }
      if (requiresCollaboration) break;
    }

    return {
      ...state,
      requiresCollaboration,
      collaborationType,
      multiLineJourney,
      metadata: {
        ...state.metadata,
        workflowPath: ['analyze_complexity'],
        collaborationAnalysis: {
          requiresCollaboration,
          collaborationType,
          queryComplexity: requiresCollaboration ? 'high' : 'low'
        }
      }
    };
  }

  async routePrimaryAgent(state) {
    console.log('[CollaborativeWorkflow] Routing to primary agent...');
    
    // Use existing router logic to determine primary agent
    const routerResult = await this.agents.router.processQuery(
      state.query,
      this.sharedLLM,
      state.userContext
    );

    return {
      ...state,
      primaryAgent: routerResult.selectedAgent,
      confidence: routerResult.confidence,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'route_primary_agent'],
        primaryAgentConfidence: routerResult.confidence
      }
    };
  }

  async identifyCollaborators(state) {
    console.log('[CollaborativeWorkflow] Identifying collaborating agents...');
    
    let collaboratingAgents = [];

    if (state.requiresCollaboration) {
      switch (state.collaborationType) {
        case 'multiLineJourney':
          // For journey planning, we might need multiple line agents
          collaboratingAgents = this.identifyLineAgentsForJourney(state.query);
          break;
          
        case 'networkStatus':
          // For network status, include status agent and major line agents
          collaboratingAgents = ['status', 'central', 'circle', 'bakerloo', 'district'];
          break;
          
        case 'comparison':
          // For comparisons, identify relevant line agents
          collaboratingAgents = this.identifyRelevantLineAgents(state.query);
          break;
          
        case 'stationInfo':
          // For station info, find which lines serve the station
          collaboratingAgents = await this.identifyAgentsForStation(state.query);
          break;
      }
    }

    // Remove primary agent from collaborators and ensure valid agents
    collaboratingAgents = collaboratingAgents
      .filter(agent => agent !== state.primaryAgent && this.enhancedAgents[agent])
      .slice(0, 3); // Limit to 3 collaborators for performance

    return {
      ...state,
      collaboratingAgents,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'identify_collaborators'],
        collaboratorsIdentified: collaboratingAgents
      }
    };
  }

  async executePrimaryAgent(state) {
    console.log(`[CollaborativeWorkflow] Executing primary agent: ${state.primaryAgent}`);
    
    try {
      // Use enhanced agent if available, fallback to original
      const agent = this.enhancedAgents[state.primaryAgent] || this.agents[state.primaryAgent];
      
      const response = await agent.processQuery(
        state.query,
        this.sharedLLM,
        {
          ...state.userContext,
          isCollaborative: state.requiresCollaboration,
          collaborationType: state.collaborationType
        }
      );

      const agentResponses = {
        [state.primaryAgent]: response
      };

      return {
        ...state,
        agentResponses,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'execute_primary_agent']
        }
      };
    } catch (error) {
      console.error(`[CollaborativeWorkflow] Primary agent execution failed:`, error);
      return {
        ...state,
        error: { message: error.message, type: 'primary_agent_error' },
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'execute_primary_agent_failed']
        }
      };
    }
  }

  async executeCollaboratingAgents(state) {
    console.log(`[CollaborativeWorkflow] Executing collaborating agents: ${state.collaboratingAgents.join(', ')}`);
    
    if (!state.collaboratingAgents || state.collaboratingAgents.length === 0) {
      return state;
    }

    try {
      const collaborationPromises = state.collaboratingAgents.map(async (agentName) => {
        const agent = this.enhancedAgents[agentName] || this.agents[agentName];
        
        // Create focused query for each collaborating agent
        const focusedQuery = this.createFocusedQuery(state.query, agentName, state.collaborationType);
        
        try {
          const response = await agent.processQuery(
            focusedQuery,
            this.sharedLLM,
            {
              ...state.userContext,
              isCollaborative: true,
              collaborationType: state.collaborationType,
              primaryAgent: state.primaryAgent
            }
          );
          
          return { [agentName]: response };
        } catch (error) {
          console.error(`[CollaborativeWorkflow] Collaborating agent ${agentName} failed:`, error);
          return { [agentName]: { error: error.message, agent: agentName } };
        }
      });

      const collaborationResults = await Promise.all(collaborationPromises);
      
      // Merge all responses
      const allResponses = { ...state.agentResponses };
      collaborationResults.forEach(result => {
        Object.assign(allResponses, result);
      });

      return {
        ...state,
        agentResponses: allResponses,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'execute_collaborating_agents'],
          collaborationResults: collaborationResults.length
        }
      };
    } catch (error) {
      console.error(`[CollaborativeWorkflow] Collaboration execution failed:`, error);
      return {
        ...state,
        error: { message: error.message, type: 'collaboration_error' },
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'execute_collaborating_agents_failed']
        }
      };
    }
  }

  async synthesizeResponses(state) {
    console.log('[CollaborativeWorkflow] Synthesizing responses...');
    
    if (!state.agentResponses || Object.keys(state.agentResponses).length === 1) {
      // Single agent response
      const singleResponse = Object.values(state.agentResponses)[0];
      return {
        ...state,
        synthesizedResponse: singleResponse.response,
        tflData: singleResponse.tflData,
        confidence: singleResponse.confidence,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'synthesize_responses_single']
        }
      };
    }

    // Multi-agent synthesis
    try {
      const synthesis = await this.performSynthesis(state);
      
      return {
        ...state,
        synthesizedResponse: synthesis.response,
        tflData: synthesis.tflData,
        confidence: synthesis.confidence,
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'synthesize_responses_multi'],
          synthesisType: synthesis.type
        }
      };
    } catch (error) {
      console.error('[CollaborativeWorkflow] Synthesis failed:', error);
      
      // Fallback to primary agent response
      const primaryResponse = state.agentResponses[state.primaryAgent];
      return {
        ...state,
        synthesizedResponse: primaryResponse?.response || 'Unable to process your request.',
        tflData: primaryResponse?.tflData,
        confidence: 0.5,
        error: { message: error.message, type: 'synthesis_error' },
        metadata: {
          ...state.metadata,
          workflowPath: [...state.metadata.workflowPath, 'synthesize_responses_fallback']
        }
      };
    }
  }

  async validateSynthesis(state) {
    console.log('[CollaborativeWorkflow] Validating synthesis...');
    
    // Simple validation logic
    const isValid = state.synthesizedResponse && 
                   state.synthesizedResponse.length > 50 && 
                   !state.synthesizedResponse.includes('Error:') &&
                   state.confidence > 0.3;

    return {
      ...state,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'validate_synthesis'],
        synthesisValid: isValid
      }
    };
  }

  async finalizeCollaborativeResponse(state) {
    console.log('[CollaborativeWorkflow] Finalizing collaborative response...');
    
    return {
      ...state,
      metadata: {
        ...state.metadata,
        workflowPath: [...state.metadata.workflowPath, 'finalize_collaborative_response'],
        completed: true,
        agentsUsed: Object.keys(state.agentResponses || {}),
        collaborationSuccessful: !state.error
      }
    };
  }

  // Condition functions
  shouldCollaborate(state) {
    // For now, always route through the same path
    return 'collaborate';
  }

  needsAdditionalAgents(state) {
    return state.requiresCollaboration && state.collaboratingAgents?.length > 0 ? 'collaborate' : 'single';
  }

  isValidSynthesis(state) {
    return state.metadata?.synthesisValid ? 'valid' : 'retry';
  }

  // Helper methods
  identifyLineAgentsForJourney(query) {
    // Extract station names and identify which lines serve them
    // This is a simplified implementation
    return ['central', 'circle', 'district'];
  }

  identifyRelevantLineAgents(query) {
    // Identify line agents mentioned in the query
    const lineKeywords = {
      central: ['central'],
      circle: ['circle'],
      bakerloo: ['bakerloo'],
      district: ['district'],
      northern: ['northern'],
      piccadilly: ['piccadilly'],
      victoria: ['victoria'],
      jubilee: ['jubilee']
    };

    const query_lower = query.toLowerCase();
    const relevantAgents = [];

    for (const [agent, keywords] of Object.entries(lineKeywords)) {
      if (keywords.some(keyword => query_lower.includes(keyword))) {
        relevantAgents.push(agent);
      }
    }

    return relevantAgents.length > 0 ? relevantAgents : ['status'];
  }

  async identifyAgentsForStation(query) {
    // Use the station search tool to identify which lines serve a station
    // This is a simplified implementation
    return ['central', 'circle'];
  }

  createFocusedQuery(originalQuery, agentName, collaborationType) {
    // Create a focused query for each collaborating agent
    switch (collaborationType) {
      case 'networkStatus':
        return `What is the current status of the ${agentName} line?`;
      case 'multiLineJourney':
        return `${originalQuery} - focus on ${agentName} line connectivity`;
      default:
        return originalQuery;
    }
  }

  async performSynthesis(state) {
    // Combine responses from multiple agents into a coherent answer
    const responses = state.agentResponses;
    const agentNames = Object.keys(responses);
    
    if (agentNames.length === 1) {
      const single = responses[agentNames[0]];
      return {
        response: single.response,
        tflData: single.tflData,
        confidence: single.confidence,
        type: 'single'
      };
    }

    // Multi-agent synthesis
    const primaryResponse = responses[state.primaryAgent];
    const collaborativeResponses = agentNames
      .filter(name => name !== state.primaryAgent)
      .map(name => responses[name]);

    // Create synthesized response
    let synthesizedText = primaryResponse.response;
    
    // Add relevant information from collaborating agents
    if (collaborativeResponses.length > 0) {
      synthesizedText += '\n\n**Additional Information:**\n';
      collaborativeResponses.forEach((response, index) => {
        if (response.response && !response.error) {
          synthesizedText += `\n• ${response.response.substring(0, 200)}${response.response.length > 200 ? '...' : ''}`;
        }
      });
    }

    // Combine TFL data
    const combinedTflData = this.combineTflData([primaryResponse, ...collaborativeResponses]);

    // Calculate average confidence
    const validResponses = [primaryResponse, ...collaborativeResponses].filter(r => !r.error);
    const avgConfidence = validResponses.reduce((sum, r) => sum + (r.confidence || 0.5), 0) / validResponses.length;

    return {
      response: synthesizedText,
      tflData: combinedTflData,
      confidence: avgConfidence,
      type: 'collaborative'
    };
  }

  combineTflData(responses) {
    const combined = {
      lastUpdated: new Date().toISOString(),
      sources: responses.map(r => r.agent).filter(Boolean),
      collaborative: true
    };

    // Combine data from all responses
    responses.forEach(response => {
      if (response.tflData) {
        Object.assign(combined, response.tflData);
      }
    });

    return combined;
  }

  // Main execution method
  async execute(initialState) {
    console.log('[CollaborativeWorkflow] Starting collaborative execution...');
    
    try {
      const result = await this.workflow.invoke(initialState);
      console.log('[CollaborativeWorkflow] Collaborative workflow completed successfully');
      return result;
    } catch (error) {
      console.error('[CollaborativeWorkflow] Collaborative workflow execution error:', error);
      throw error;
    }
  }
}

module.exports = { CollaborativeWorkflow };