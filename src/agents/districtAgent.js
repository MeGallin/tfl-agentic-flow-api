const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { DistrictLineTools } = require('../tools/districtTools');
const { createDistrictPrompt } = require('../prompts/districtPrompt');

class DistrictAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;
    this.tools = new DistrictLineTools();
    this.lineColor = '#007934'; // TFL District line green
  }
  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[DistrictAgent] Starting to process query...');

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000, // 10 second timeout
        });

      console.log('[DistrictAgent] LLM initialized, fetching TFL data...');

      // Get real-time TFL data but limit it to prevent token overflow
      const rawTflData = await this.tools.getLineInfo(query);

      // Check if the query is asking for arrival times at a specific station
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[DistrictAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        // Get station info which now includes arrivals
        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        console.log(
          `[DistrictAgent] Station info result:`,
          JSON.stringify(stationInfo, null, 2),
        );

        if (stationInfo.station && stationInfo.arrivals) {
          console.log(
            `[DistrictAgent] Found station: ${stationInfo.station.commonName} with ${stationInfo.arrivals.length} arrivals`,
          );

          // Format arrival data to match expected structure
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'District',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };

          console.log(
            `[DistrictAgent] Formatted arrival data:`,
            JSON.stringify(arrivalData, null, 2),
          );
        } else {
          console.log(
            `[DistrictAgent] No station or arrivals found in stationInfo`,
          );
        }
      }

      // Filter and limit the TFL data to prevent overwhelming the LLM
      const tflData = {
        line: {
          name: rawTflData.line?.name || 'District Line',
          id: rawTflData.line?.id || 'district',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 60,
        queryProcessed: query,
        lastUpdated: rawTflData.lastUpdated || new Date().toISOString(),
        // Only include a few key stations to avoid token overflow
        keyStations:
          rawTflData.stations?.slice(0, 10)?.map((station) => ({
            name: station.commonName || station.name,
            id: station.id,
          })) || [],
        // Include arrival data if available
        arrivals: arrivalData,
      };

      console.log(
        '[DistrictAgent] TFL data filtered and limited, preparing prompt...',
      );

      // Build system prompt with arrival data if available
      let arrivalInfo = '';
      console.log('[DistrictAgent] Checking arrival data for prompt...');
      console.log(
        '[DistrictAgent] tflData.arrivals:',
        JSON.stringify(tflData.arrivals, null, 2),
      );

      if (
        tflData.arrivals &&
        tflData.arrivals.arrivals &&
        tflData.arrivals.arrivals.length > 0
      ) {
        console.log('[DistrictAgent] Building arrival info for prompt...');
        const nextArrivals = tflData.arrivals.arrivals
          .slice(0, 3)
          .map((arrival) => {
            const minutes = Math.round(arrival.timeToStation / 60);
            const destination =
              arrival.destinationName ||
              arrival.towards ||
              'Unknown destination';
            return `- ${minutes} minute${minutes !== 1 ? 's' : ''} to ${destination}`;
          })
          .join('\n');

        const stationName =
          tflData.arrivals.arrivals[0]?.stationName || 'Station';
        arrivalInfo = `\n\nLIVE ARRIVAL TIMES FOR ${stationName.toUpperCase()}:
${nextArrivals}
(Last updated: ${tflData.arrivals.lastUpdated})`;

        console.log('[DistrictAgent] Arrival info constructed:', arrivalInfo);
      } else {
        console.log('[DistrictAgent] No arrival data available for prompt');
      }

      const systemPrompt = createDistrictPrompt(tflData, arrivalInfo);

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`${query}\n\nContext: ${JSON.stringify(context)}`),
      ];
      console.log('[DistrictAgent] Calling LLM...');

      const response = await llm.invoke(messages);

      console.log(
        '[DistrictAgent] LLM response received, preparing final response...',
      );

      return {
        response: response.content,
        agent: 'DISTRICT',
        lineColor: this.lineColor,
        confidence: this.calculateConfidence(query),
        tflData: tflData,
        specialization: 'District Line Underground Services',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[DistrictAgent] District Agent Error:', error);
      return {
        response:
          'I apologize, but I encountered an error processing your District Line query. Please try again or contact TFL customer service for immediate assistance.',
        agent: 'DISTRICT',
        lineColor: this.lineColor,
        confidence: 0.1,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  calculateConfidence(query) {
    const districtKeywords = [
      'district',
      'green line',
      'upminster',
      'ealing broadway',
      'richmond',
      'wimbledon',
      'kensington olympia',
      "earl's court",
      'tower hill',
      'monument',
      'westminster',
      'victoria',
      'south kensington',
      'notting hill gate',
      'paddington',
      'putney bridge',
      'hammersmith',
      'fulham broadway',
      'parsons green',
      'gloucester road',
      'embankment',
      'blackfriars',
      'mansion house',
      'cannon street',
      'aldgate east',
      'whitechapel',
      'stepney green',
      'mile end',
      'bow road',
      'bromley-by-bow',
      'west ham',
      'plaistow',
      'upton park',
      'east ham',
      'barking',
      'upney',
      'becontree',
      'dagenham heathway',
      'dagenham east',
      'elm park',
      'hornchurch',
    ];

    const queryLower = query.toLowerCase();
    const matches = districtKeywords.filter((keyword) =>
      queryLower.includes(keyword),
    ).length;

    // Base confidence on keyword matches
    const baseConfidence = Math.min(matches * 0.2, 0.8);

    // Boost confidence for explicit District Line mentions
    if (
      queryLower.includes('district line') ||
      queryLower.includes('district')
    ) {
      return Math.min(baseConfidence + 0.3, 0.95);
    }

    return baseConfidence;
  }

  // Integration methods for TFL API tools
  async getLineInfo(query) {
    return await this.tools.getLineInfo(query);
  }
  async getStationInfo(stationName) {
    return await this.tools.getStationInfo(stationName);
  }

  async getServiceStatus() {
    return await this.tools.getServiceStatus();
  }

  async getArrivals(stationId) {
    return await this.tools.getArrivals(stationId);
  }

  detectArrivalQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Keywords that indicate arrival/departure queries
    const arrivalKeywords = [
      'next train',
      'when',
      'arrival',
      'departure',
      'time',
      'due',
      'coming',
      'leaving',
      'schedule',
      'timetable',
      'how long',
      'what time',
      'next arrival',
    ];

    // Check if query contains arrival-related keywords
    const isArrivalQuery = arrivalKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    if (!isArrivalQuery) {
      return { isArrivalQuery: false, stationName: null };
    }

    // Extract station name - look for common patterns
    let stationName = null;

    // Pattern: "at [station]" or "from [station]" - but avoid matching "what time"
    const atMatch = lowerQuery.match(
      /(?:arrival|train|service|stop)s?\s+(?:at|from)\s+([a-z\s&'-]+?)(?:\s|$|\?)/,
    );
    if (atMatch) {
      stationName = atMatch[1].trim();
    }

    // Fallback pattern for simpler "at [station]" cases
    if (!stationName) {
      const simpleAtMatch = lowerQuery.match(
        /\b(?:at|from)\s+([a-z\s&'-]+?)(?:\s+(?:station|underground|tube)|$|\?)/,
      );
      if (simpleAtMatch && !simpleAtMatch[1].includes('time')) {
        stationName = simpleAtMatch[1].trim();
      }
    }

    // Pattern: "[station] station"
    if (!stationName) {
      const stationMatch = lowerQuery.match(
        /([a-z\s&'-]+?)\s+(?:station|underground)/,
      );
      if (stationMatch) {
        stationName = stationMatch[1].trim();
      }
    }

    // Pattern: direct station name (common District Line stations)
    if (!stationName) {
      const commonStations = [
        'upminster',
        'ealing broadway',
        'richmond',
        'wimbledon',
        'kensington olympia',
        "earl's court",
        'tower hill',
        'monument',
        'westminster',
        'victoria',
        'south kensington',
        'notting hill gate',
        'paddington',
        'putney bridge',
        'hammersmith',
        'fulham broadway',
        'parsons green',
        'gloucester road',
        'embankment',
        'blackfriars',
        'mansion house',
        'cannon street',
        'aldgate east',
        'whitechapel',
        'stepney green',
        'mile end',
        'bow road',
        'bromley-by-bow',
        'west ham',
        'plaistow',
        'upton park',
        'east ham',
        'barking',
        'upney',
        'becontree',
        'dagenham heathway',
        'dagenham east',
        'elm park',
        'hornchurch',
        'high street kensington',
        'sloane square',
        'st james park',
        'green park',
        'hyde park corner',
        'knightsbridge',
        'royal oak',
        'westbourne park',
        'ladbroke grove',
        'latimer road',
        'wood lane',
        'shepherds bush market',
        'goldhawk road',
        'stamford brook',
        'ravenscourt park',
        'turnham green',
        'chiswick park',
        'acton town',
        'ealing common',
        'north ealing',
        'park royal',
        'alperton',
        'sudbury town',
        'sudbury hill',
        'south harrow',
        'rayners lane',
        'west harrow',
        'harrow-on-the-hill',
        'northwick park',
        'preston road',
        'wembley park',
        'kingsbury',
        'queensbury',
        'canons park',
        'stanmore',
      ];

      for (const station of commonStations) {
        if (lowerQuery.includes(station)) {
          stationName = station;
          break;
        }
      }
    }

    // Clean up station name
    if (stationName) {
      stationName = stationName
        .replace(/\b(station|underground|tube)\b/gi, '')
        .trim()
        .replace(/\s+/g, ' ');
    }

    return {
      isArrivalQuery,
      stationName,
    };
  }
}

module.exports = { DistrictAgent };
