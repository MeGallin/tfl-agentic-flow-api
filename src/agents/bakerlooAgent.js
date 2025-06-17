const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { BakerlooLineTools } = require('../tools/bakerlooTools');
const { createBakerlooPrompt } = require('../prompts/bakerlooPrompt');

class BakerlooAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;
    this.tools = new BakerlooLineTools();
    this.lineColor = '#894E24'; // TFL Bakerloo line brown
  }
  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[BakerlooAgent] Starting to process query...');

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000, // 10 second timeout
        });

      console.log('[BakerlooAgent] LLM initialized, fetching TFL data...');

      // Get real-time TFL data but limit it to prevent token overflow
      const rawTflData = await this.tools.getLineInfo(query);

      // Check if the query is asking for arrival times at a specific station
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[BakerlooAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        // Get station info which now includes arrivals
        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        console.log(
          `[BakerlooAgent] Station info result:`,
          JSON.stringify(stationInfo, null, 2),
        );

        if (stationInfo.station && stationInfo.arrivals) {
          console.log(
            `[BakerlooAgent] Found station: ${stationInfo.station.commonName} with ${stationInfo.arrivals.length} arrivals`,
          );

          // Format arrival data to match expected structure
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'Bakerloo',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };

          console.log(
            `[BakerlooAgent] Formatted arrival data:`,
            JSON.stringify(arrivalData, null, 2),
          );
        } else {
          console.log(
            `[BakerlooAgent] No station or arrivals found in stationInfo`,
          );
        }
      }

      // Filter and limit the TFL data to prevent overwhelming the LLM
      const tflData = {
        line: {
          name: rawTflData.line?.name || 'Bakerloo Line',
          id: rawTflData.line?.id || 'bakerloo',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 25,
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
        '[BakerlooAgent] TFL data filtered and limited, preparing prompt...',
      );

      // Build system prompt with arrival data if available
      let arrivalInfo = '';
      console.log('[BakerlooAgent] Checking arrival data for prompt...');
      console.log(
        '[BakerlooAgent] tflData.arrivals:',
        JSON.stringify(tflData.arrivals, null, 2),
      );

      if (
        tflData.arrivals &&
        tflData.arrivals.arrivals &&
        tflData.arrivals.arrivals.length > 0
      ) {
        console.log('[BakerlooAgent] Building arrival info for prompt...');
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

        console.log('[BakerlooAgent] Arrival info constructed:', arrivalInfo);
      } else {
        console.log('[BakerlooAgent] No arrival data available for prompt');
      }

      const systemPrompt = createBakerlooPrompt(tflData, arrivalInfo);
      console.log('[BakerlooAgent] Calling LLM...');

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      console.log(
        '[BakerlooAgent] LLM response received, preparing final response...',
      );

      return {
        response: response.content,
        agent: 'BAKERLOO',
        tflData: tflData,
        lineColor: this.lineColor,
        specialization: 'Bakerloo Line Underground Services',
      };
    } catch (error) {
      console.error('[BakerlooAgent] Bakerloo Agent error:', error);
      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Bakerloo Line specialist, I'm unable to provide information at the moment. Please try again shortly.",
        agent: 'BAKERLOO',
        tflData: null,
        lineColor: this.lineColor,
        error: error.message,
      };
    }
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

    // Pattern: direct station name (common stations)
    if (!stationName) {
      const commonStations = [
        'paddington',
        'oxford circus',
        'piccadilly circus',
        'waterloo',
        'elephant and castle',
        'baker street',
        "regent's park",
        'marylebone',
        'edgware road',
        'lambeth north',
        'southwark',
        'embankment',
        'charing cross',
        'leicester square',
        'tottenham court road',
        'goodge street',
        'warren street',
        'great portland street',
        "queen's park",
        'kilburn park',
        'maida vale',
        'warwick avenue',
        'royal oak',
        'westbourne park',
        'ladbroke grove',
        'latimer road',
        'kensal green',
        'willesden junction',
        'harlesden',
        'stonebridge park',
        'wembley central',
        'north wembley',
        'south kenton',
        'kenton',
        'harrow & wealdstone',
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

module.exports = { BakerlooAgent };
