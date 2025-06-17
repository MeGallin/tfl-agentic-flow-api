const { GraphState } = require('./graphState');

class StartNode {
  constructor() {
    this.name = 'start';
    this.description =
      'Entry point for the TFL Underground AI Assistant workflow';
  }

  async process(input) {
    const startTime = Date.now();

    try {
      // Create new graph state
      const graphState = new GraphState();

      // Extract input parameters
      const { query, threadId, userContext } = input;

      // Validate input
      if (!query || typeof query !== 'string' || !query.trim()) {
        throw new Error('Valid query is required');
      }

      // Initialize state
      const state = graphState.initializeState(query, threadId, userContext);

      // Add user query to conversation history
      graphState.addToHistory('user', query, {
        userAgent: userContext?.userAgent || 'unknown',
        ipAddress: userContext?.ipAddress || 'unknown',
        sessionId: userContext?.sessionId || null,
      });

      // Log the start of processing
      console.log(
        `[StartNode] Processing query: "${query.substring(0, 100)}..." for thread: ${state.threadId}`,
      );

      // Prepare the state for the next node (router)
      const output = {
        ...state,
        nextNode: 'router',
        metadata: {
          ...state.metadata,
          startTime,
          nodeSequence: ['start'],
        },
      };

      // Calculate initial processing time
      graphState.setProcessingTime(startTime);

      console.log(
        `[StartNode] State initialized successfully for thread: ${state.threadId}`,
      );

      return {
        success: true,
        state: output,
        graphState,
        message: 'Query processed and ready for routing',
      };
    } catch (error) {
      console.error('[StartNode] Error:', error);

      return {
        success: false,
        error: {
          message: error.message,
          type: 'StartNodeError',
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
        },
        state: null,
      };
    }
  }

  // Validate input structure
  validateInput(input) {
    const errors = [];

    if (!input || typeof input !== 'object') {
      errors.push('Input must be an object');
      return { valid: false, errors };
    }

    if (!input.query || typeof input.query !== 'string') {
      errors.push('Query must be a non-empty string');
    }

    if (input.threadId && typeof input.threadId !== 'string') {
      errors.push('ThreadId must be a string if provided');
    }

    if (input.userContext && typeof input.userContext !== 'object') {
      errors.push('UserContext must be an object if provided');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Sanitize user input
  sanitizeInput(input) {
    const sanitized = { ...input };

    // Trim and sanitize query
    if (sanitized.query) {
      sanitized.query = sanitized.query
        .trim()
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .substring(0, 1000); // Limit query length
    }

    // Sanitize threadId
    if (sanitized.threadId) {
      sanitized.threadId = sanitized.threadId
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '') // Only allow alphanumeric, underscore, and dash
        .substring(0, 100); // Limit length
    }

    // Sanitize userContext
    if (sanitized.userContext) {
      const allowedContextKeys = [
        'userAgent',
        'ipAddress',
        'sessionId',
        'preferences',
        'location',
      ];
      const cleanContext = {};

      allowedContextKeys.forEach((key) => {
        if (sanitized.userContext[key]) {
          cleanContext[key] = String(sanitized.userContext[key]).substring(
            0,
            500,
          );
        }
      });

      sanitized.userContext = cleanContext;
    }

    return sanitized;
  }

  // Process with validation and sanitization
  async processWithValidation(input) {
    try {
      // Validate input
      const validation = this.validateInput(input);
      if (!validation.valid) {
        return {
          success: false,
          error: {
            message: 'Input validation failed',
            type: 'ValidationError',
            details: validation.errors,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Sanitize input
      const sanitizedInput = this.sanitizeInput(input);

      // Process the sanitized input
      return await this.process(sanitizedInput);
    } catch (error) {
      console.error('[StartNode] Validation/Processing Error:', error);

      return {
        success: false,
        error: {
          message: 'Failed to process input',
          type: 'ProcessingError',
          originalError: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // Get node information
  getInfo() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        required: ['query'],
        optional: ['threadId', 'userContext'],
        properties: {
          query: {
            type: 'string',
            description: 'User query about TFL Underground',
          },
          threadId: {
            type: 'string',
            description: 'Optional conversation thread ID',
          },
          userContext: {
            type: 'object',
            description: 'Optional user context information',
          },
        },
      },
      outputSchema: {
        success: {
          type: 'boolean',
          description: 'Whether processing was successful',
        },
        state: { type: 'object', description: 'Graph state object' },
        graphState: { type: 'object', description: 'GraphState instance' },
        error: { type: 'object', description: 'Error information if failed' },
      },
    };
  }
}

module.exports = { StartNode };
