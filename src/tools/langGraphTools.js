const { DynamicTool } = require('@langchain/core/tools');
const { CentralLineTools } = require('./centralTools');
const { CircleLineTools } = require('./circleTools');
const { BakerlooLineTools } = require('./bakerlooTools');
const { DistrictLineTools } = require('./districtTools');
const { StatusTools } = require('./statusTools');
const { DateTimeTools } = require('./dateTimeTools');

class LangGraphToolsRegistry {
  constructor() {
    this.toolInstances = {
      central: new CentralLineTools(),
      circle: new CircleLineTools(),
      bakerloo: new BakerlooLineTools(),
      district: new DistrictLineTools(),
      status: new StatusTools(),
      datetime: new DateTimeTools()
    };

    this.tools = this.createLangGraphTools();
  }

  createLangGraphTools() {
    const tools = [];

    // Central Line Tools
    tools.push(
      new DynamicTool({
        name: "get_central_line_info",
        description: "Get Central Line service status, station information, and live arrivals. Use for any Central Line related queries.",
        func: async (input) => {
          try {
            const result = await this.toolInstances.central.getLineInfo(input);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_central_station_info",
        description: "Get detailed information about a Central Line station including arrivals and facilities. Input should be the station name.",
        func: async (stationName) => {
          try {
            const result = await this.toolInstances.central.getStationInfo(stationName);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_central_arrivals",
        description: "Get live arrival times for a Central Line station. Input should be the station ID.",
        func: async (stationId) => {
          try {
            const result = await this.toolInstances.central.getArrivals(stationId);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // Circle Line Tools
    tools.push(
      new DynamicTool({
        name: "get_circle_line_info",
        description: "Get Circle Line service status, station information, and live arrivals. Use for any Circle Line related queries.",
        func: async (input) => {
          try {
            const result = await this.toolInstances.circle.getLineInfo(input);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_circle_station_info",
        description: "Get detailed information about a Circle Line station including arrivals and facilities. Input should be the station name.",
        func: async (stationName) => {
          try {
            const result = await this.toolInstances.circle.getStationInfo(stationName);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // Bakerloo Line Tools
    tools.push(
      new DynamicTool({
        name: "get_bakerloo_line_info",
        description: "Get Bakerloo Line service status, station information, and live arrivals. Use for any Bakerloo Line related queries.",
        func: async (input) => {
          try {
            const result = await this.toolInstances.bakerloo.getLineInfo(input);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_bakerloo_station_info",
        description: "Get detailed information about a Bakerloo Line station including arrivals and facilities. Input should be the station name.",
        func: async (stationName) => {
          try {
            const result = await this.toolInstances.bakerloo.getStationInfo(stationName);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // District Line Tools
    tools.push(
      new DynamicTool({
        name: "get_district_line_info",
        description: "Get District Line service status, station information, and live arrivals. Use for any District Line related queries.",
        func: async (input) => {
          try {
            const result = await this.toolInstances.district.getLineInfo(input);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_district_station_info",
        description: "Get detailed information about a District Line station including arrivals and facilities. Input should be the station name.",
        func: async (stationName) => {
          try {
            const result = await this.toolInstances.district.getStationInfo(stationName);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // General Network Status Tools
    tools.push(
      new DynamicTool({
        name: "get_network_status",
        description: "Get overall London Underground network status for all lines. Use when asked about general network conditions or multiple lines.",
        func: async (input) => {
          try {
            const result = await this.toolInstances.status.getNetworkStatus();
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "get_line_status",
        description: "Get specific line status by line name. Input should be the line name (e.g., 'central', 'circle', 'bakerloo').",
        func: async (lineName) => {
          try {
            const result = await this.toolInstances.status.getLineStatus(lineName);
            return JSON.stringify(result);
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // DateTime Tools
    tools.push(
      new DynamicTool({
        name: "get_current_london_time",
        description: "Get the current date and time in London timezone (GMT/BST). Use when you need to provide current time information.",
        func: async () => {
          try {
            const result = DateTimeTools.getTFLTimestamp();
            return `Current London time: ${result}`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: "format_time_duration",
        description: "Format a time duration in seconds to human-readable format. Input should be duration in seconds.",
        func: async (seconds) => {
          try {
            const minutes = Math.round(seconds / 60);
            if (minutes === 0) return 'less than a minute';
            if (minutes === 1) return '1 minute';
            return `${minutes} minutes`;
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    // Multi-line Journey Planning Tool
    tools.push(
      new DynamicTool({
        name: "plan_multi_line_journey",
        description: "Plan a journey that may involve multiple Underground lines. Input should be JSON with 'from' and 'to' station names.",
        func: async (input) => {
          try {
            const { from, to } = JSON.parse(input);
            
            // This would integrate with TFL Journey Planner API
            // For now, we'll provide a structured response for multi-line planning
            const result = {
              from,
              to,
              suggestion: `To plan your journey from ${from} to ${to}, I'll need to check which lines serve these stations and find the best route. This may involve interchanges between different Underground lines.`,
              requiresMultipleAgents: true,
              recommendedApproach: 'Check individual line agents for station connectivity'
            };
            
            return JSON.stringify(result);
          } catch (error) {
            return `Error parsing journey request: ${error.message}`;
          }
        }
      })
    );

    // Tool for complex station searches
    tools.push(
      new DynamicTool({
        name: "search_station_across_lines",
        description: "Search for a station across all supported Underground lines. Input should be the station name to search for.",
        func: async (stationName) => {
          try {
            const results = [];
            const searchPromises = [];

            // Search across all line tools
            for (const [lineName, toolInstance] of Object.entries(this.toolInstances)) {
              if (lineName === 'status' || lineName === 'datetime') continue;
              
              searchPromises.push(
                toolInstance.getStationInfo(stationName)
                  .then(result => ({ line: lineName, ...result }))
                  .catch(error => ({ line: lineName, error: error.message }))
              );
            }

            const searchResults = await Promise.all(searchPromises);
            const foundStations = searchResults.filter(result => !result.error && result.station);

            return JSON.stringify({
              searchTerm: stationName,
              foundOn: foundStations.map(result => result.line),
              stations: foundStations,
              summary: foundStations.length > 0 
                ? `Found "${stationName}" on ${foundStations.length} line(s): ${foundStations.map(r => r.line).join(', ')}`
                : `No stations found matching "${stationName}" on supported lines`
            });
          } catch (error) {
            return `Error: ${error.message}`;
          }
        }
      })
    );

    return tools;
  }

  // Get tools for specific agent
  getToolsForAgent(agentName) {
    const agentToolMap = {
      central: ['get_central_line_info', 'get_central_station_info', 'get_central_arrivals', 'get_current_london_time', 'format_time_duration'],
      circle: ['get_circle_line_info', 'get_circle_station_info', 'get_current_london_time', 'format_time_duration'],
      bakerloo: ['get_bakerloo_line_info', 'get_bakerloo_station_info', 'get_current_london_time', 'format_time_duration'],
      district: ['get_district_line_info', 'get_district_station_info', 'get_current_london_time', 'format_time_duration'],
      status: ['get_network_status', 'get_line_status', 'get_current_london_time'],
      router: ['search_station_across_lines', 'plan_multi_line_journey', 'get_network_status', 'get_current_london_time']
    };

    const relevantToolNames = agentToolMap[agentName] || [];
    return this.tools.filter(tool => relevantToolNames.includes(tool.name));
  }

  // Get all tools
  getAllTools() {
    return this.tools;
  }

  // Get tool by name
  getTool(toolName) {
    return this.tools.find(tool => tool.name === toolName);
  }

  // Execute tool with error handling and logging
  async executeTool(toolName, input, context = {}) {
    console.log(`[LangGraphTools] Executing tool: ${toolName} with input:`, input);
    
    const tool = this.getTool(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }

    try {
      const startTime = Date.now();
      const result = await tool.func(input);
      const executionTime = Date.now() - startTime;
      
      console.log(`[LangGraphTools] Tool ${toolName} executed successfully in ${executionTime}ms`);
      
      return {
        success: true,
        result,
        executionTime,
        toolName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[LangGraphTools] Tool ${toolName} failed:`, error);
      
      return {
        success: false,
        error: error.message,
        toolName,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = { LangGraphToolsRegistry };