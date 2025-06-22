const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');
const { LangGraphToolsRegistry } = require('../tools/langGraphTools');
const { DateTimeTools } = require('../tools/dateTimeTools');

class EnhancedAgent {
  constructor(agentName, lineColor, specialization) {
    this.agentName = agentName;
    this.lineColor = lineColor;
    this.specialization = specialization;
    this.model = 'gpt-4o';
    this.temperature = 0.3;
    
    // Initialize tools registry
    this.toolsRegistry = new LangGraphToolsRegistry();
    this.tools = this.toolsRegistry.getToolsForAgent(agentName);
    
    // Agent executor will be initialized when needed
    this.agentExecutor = null;
  }

  async initializeAgent(sharedLLM = null) {
    const llm = sharedLLM || new ChatOpenAI({
      model: this.model,
      temperature: this.temperature,
      timeout: 15000,
    });

    // Create system prompt
    const systemPrompt = this.createSystemPrompt();

    try {
      // Create OpenAI tools agent
      const agent = await createOpenAIToolsAgent({
        llm,
        tools: this.tools,
        prompt: systemPrompt
      });

      // Create agent executor
      this.agentExecutor = new AgentExecutor({
        agent,
        tools: this.tools,
        verbose: true,
        maxIterations: 5,
        returnIntermediateSteps: true
      });

      console.log(`[EnhancedAgent] ${this.agentName} agent initialized with ${this.tools.length} tools`);
      return this.agentExecutor;
    } catch (error) {
      console.error(`[EnhancedAgent] Failed to initialize ${this.agentName} agent:`, error);
      throw error;
    }
  }

  createSystemPrompt() {
    const currentTime = DateTimeTools.getTFLTimestamp();
    
    return `You are an expert London Underground assistant specializing in ${this.specialization}.

CURRENT TIME: ${currentTime}

RESPONSIBILITIES:
- Provide accurate, real-time transport information
- Use available tools to fetch live data from TFL APIs
- Focus on ${this.agentName} line services when applicable
- Offer helpful journey planning and station information
- Maintain a professional but friendly tone

TOOL USAGE GUIDELINES:
1. Always use tools to fetch real-time data rather than relying on static knowledge
2. If a tool fails, acknowledge the error and provide alternative assistance
3. Combine multiple tool calls when needed for comprehensive responses
4. Format times and arrivals in a user-friendly way

RESPONSE FORMATTING:
- Use clear, conversational language
- Include relevant timestamps for live data
- Highlight important service information (delays, disruptions)
- Provide actionable advice when possible
- Use bullet points or lists for multiple pieces of information

IMPORTANT NOTES:
- All arrival times are live data from TFL systems
- Service status can change rapidly - always use current tools
- When no live data is available, clearly state this limitation
- Prioritize passenger safety and official TFL guidance

Remember: You are the ${this.agentName} specialist, but you can access information about other lines when needed for journey planning.`;
  }

  async processQuery(query, sharedLLM = null, context = {}) {
    console.log(`[EnhancedAgent] ${this.agentName} processing query: "${query.substring(0, 100)}..."`);
    
    try {
      // Initialize agent if not already done
      if (!this.agentExecutor) {
        await this.initializeAgent(sharedLLM);
      }

      // Prepare input with context
      const input = {
        input: query,
        chat_history: context.conversationHistory || [],
        user_context: context
      };

      // Execute agent with tools
      const result = await this.agentExecutor.invoke(input);

      // Extract tool execution data
      const toolExecutions = result.intermediateSteps?.map(step => ({
        tool: step.action?.tool,
        input: step.action?.toolInput,
        output: step.observation,
        success: !step.observation?.includes('Error:')
      })) || [];

      // Calculate confidence based on tool success and result quality
      const confidence = this.calculateConfidence(result, toolExecutions);

      // Extract TFL data from tool executions
      const tflData = this.extractTFLData(toolExecutions);

      const response = {
        response: result.output,
        agent: this.agentName.toUpperCase(),
        lineColor: this.lineColor,
        confidence,
        specialization: this.specialization,
        tflData,
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
        metadata: {
          toolsUsed: toolExecutions.map(t => t.tool).filter(Boolean),
          processingTime: Date.now() - (context.startTime || Date.now()),
          timestamp: new Date().toISOString(),
          enhanced: true
        }
      };

      console.log(`[EnhancedAgent] ${this.agentName} completed processing with ${toolExecutions.length} tool executions`);
      return response;

    } catch (error) {
      console.error(`[EnhancedAgent] ${this.agentName} processing error:`, error);
      
      // Fallback response
      return {
        response: `I apologize, but I'm experiencing technical difficulties as your ${this.specialization} specialist. Please try asking your question again, or contact TFL customer service for immediate assistance.`,
        agent: this.agentName.toUpperCase(),
        lineColor: this.lineColor,
        confidence: 0.1,
        error: error.message,
        metadata: {
          timestamp: new Date().toISOString(),
          enhanced: true,
          fallback: true
        }
      };
    }
  }

  calculateConfidence(result, toolExecutions) {
    let confidence = 0.7; // Base confidence

    // Increase confidence for successful tool usage
    const successfulTools = toolExecutions.filter(t => t.success).length;
    const totalTools = toolExecutions.length;
    
    if (totalTools > 0) {
      const toolSuccessRate = successfulTools / totalTools;
      confidence += toolSuccessRate * 0.2;
    }

    // Increase confidence for comprehensive responses
    if (result.output && result.output.length > 100) {
      confidence += 0.1;
    }

    // Reduce confidence for errors or short responses
    if (result.output?.includes('Error:') || result.output?.includes('unable to')) {
      confidence -= 0.3;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  extractTFLData(toolExecutions) {
    const tflData = {
      lastUpdated: new Date().toISOString(),
      toolsExecuted: toolExecutions.length,
      dataSource: 'live_api'
    };

    for (const execution of toolExecutions) {
      if (execution.success && execution.output) {
        try {
          const parsed = JSON.parse(execution.output);
          
          // Extract line information
          if (parsed.line && !tflData.line) {
            tflData.line = parsed.line;
          }
          
          // Extract status information
          if (parsed.status && !tflData.status) {
            tflData.status = parsed.status;
          }
          
          // Extract station information
          if (parsed.station && !tflData.station) {
            tflData.station = parsed.station;
          }
          
          // Extract arrivals
          if (parsed.arrivals && !tflData.arrivals) {
            tflData.arrivals = parsed.arrivals;
          }
          
          // Extract stations list
          if (parsed.stations && !tflData.stations) {
            tflData.stations = parsed.stations.slice(0, 5); // Limit for performance
          }
        } catch (parseError) {
          // If not JSON, treat as text data
          if (!tflData.textData) {
            tflData.textData = [];
          }
          tflData.textData.push(execution.output);
        }
      }
    }

    return tflData;
  }

  // Get available tools for this agent
  getAvailableTools() {
    return this.tools.map(tool => ({
      name: tool.name,
      description: tool.description
    }));
  }

  // Execute a specific tool manually (for testing)
  async executeTool(toolName, input) {
    return await this.toolsRegistry.executeTool(toolName, input, {
      agent: this.agentName,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { EnhancedAgent };