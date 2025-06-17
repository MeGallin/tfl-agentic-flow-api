class GraphState {
  constructor() {
    this.state = {
      query: '',
      threadId: '',
      userContext: {},
      selectedAgent: null,
      agentResponse: null,
      confidence: 0,
      tflData: null,
      conversationHistory: [],
      error: null,
      metadata: {
        timestamp: null,
        processingTime: 0,
        apiCalls: 0,
      },
    };
  }

  // Initialize state with user input
  initializeState(query, threadId, userContext = {}) {
    this.state = {
      ...this.state,
      query: query.trim(),
      threadId: threadId || this.generateThreadId(),
      userContext,
      metadata: {
        ...this.state.metadata,
        timestamp: new Date().toISOString(),
      },
    };
    return this.state;
  }

  // Update selected agent
  setSelectedAgent(agent, confidence) {
    this.state.selectedAgent = agent;
    this.state.confidence = confidence;
    return this.state;
  }

  // Set agent response
  setAgentResponse(response, tflData = null) {
    this.state.agentResponse = response;
    this.state.tflData = tflData;
    return this.state;
  }

  // Add conversation to history
  addToHistory(role, content, metadata = {}) {
    const historyEntry = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.state.conversationHistory.push(historyEntry);
    return this.state;
  }

  // Set error state
  setError(error) {
    this.state.error = {
      message: error.message || error,
      timestamp: new Date().toISOString(),
      stack: error.stack || null,
    };
    return this.state;
  }

  // Update metadata
  updateMetadata(updates) {
    this.state.metadata = {
      ...this.state.metadata,
      ...updates,
    };
    return this.state;
  }

  // Increment API call counter
  incrementApiCalls() {
    this.state.metadata.apiCalls += 1;
    return this.state;
  }

  // Calculate processing time
  setProcessingTime(startTime) {
    const endTime = Date.now();
    this.state.metadata.processingTime = endTime - startTime;
    return this.state;
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Reset state
  reset() {
    const threadId = this.state.threadId;
    const conversationHistory = this.state.conversationHistory;

    this.state = {
      query: '',
      threadId,
      userContext: {},
      selectedAgent: null,
      agentResponse: null,
      confidence: 0,
      tflData: null,
      conversationHistory,
      error: null,
      metadata: {
        timestamp: null,
        processingTime: 0,
        apiCalls: 0,
      },
    };
    return this.state;
  }

  // Generate unique thread ID
  generateThreadId() {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Validate state for processing
  isValid() {
    return !!(this.state.query && this.state.threadId);
  }

  // Get state summary for logging
  getSummary() {
    return {
      threadId: this.state.threadId,
      query:
        this.state.query.substring(0, 100) +
        (this.state.query.length > 100 ? '...' : ''),
      selectedAgent: this.state.selectedAgent,
      confidence: this.state.confidence,
      hasResponse: !!this.state.agentResponse,
      hasError: !!this.state.error,
      processingTime: this.state.metadata.processingTime,
      apiCalls: this.state.metadata.apiCalls,
    };
  }

  // Export state for persistence
  exportState() {
    return {
      ...this.state,
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
    };
  }

  // Import state from persistence
  importState(importedState) {
    if (importedState && importedState.version === '1.0.0') {
      this.state = {
        ...importedState,
        metadata: {
          ...importedState.metadata,
          importedAt: new Date().toISOString(),
        },
      };
      delete this.state.version;
      delete this.state.exportedAt;
    }
    return this.state;
  }
}

module.exports = { GraphState };
