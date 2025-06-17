const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { CircleLineTools } = require('../tools/circleTools');

class CircleAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;
    this.tools = new CircleLineTools();
    this.lineColor = '#FFD329'; // TFL Circle line yellow
  }
  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[CircleAgent] Starting to process query...');

    // Initialize tflData outside try block so it's available in catch
    let tflData = null;

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000, // 10 second timeout
        });
      console.log('[CircleAgent] LLM initialized, fetching TFL data...');

      // Get real-time TFL data but limit it to prevent token overflow
      const rawTflData = await this.tools.getLineInfo(query);

      // Check if the query is asking for arrival times at a specific station
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[CircleAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        // Get station info which now includes arrivals
        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        console.log(
          `[CircleAgent] Station info result:`,
          JSON.stringify(stationInfo, null, 2),
        );

        if (stationInfo.station && stationInfo.arrivals) {
          console.log(
            `[CircleAgent] Found station: ${stationInfo.station.commonName} with ${stationInfo.arrivals.length} arrivals`,
          );

          // Format arrival data to match expected structure
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'Circle',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };

          console.log(
            `[CircleAgent] Formatted arrival data:`,
            JSON.stringify(arrivalData, null, 2),
          );
        } else {
          console.log(
            `[CircleAgent] No station or arrivals found in stationInfo`,
          );
        }
      }

      // Filter and limit the TFL data to prevent overwhelming the LLM
      tflData = {
        line: {
          name: rawTflData.line?.name || 'Circle Line',
          id: rawTflData.line?.id || 'circle',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 36,
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
        '[CircleAgent] TFL data filtered and limited, preparing prompt...',
      );
      // Build system prompt with arrival data if available
      let arrivalInfo = '';
      console.log('[CircleAgent] Checking arrival data for prompt...');
      console.log(
        '[CircleAgent] tflData.arrivals:',
        JSON.stringify(tflData.arrivals, null, 2),
      );

      if (
        tflData.arrivals &&
        tflData.arrivals.arrivals &&
        tflData.arrivals.arrivals.length > 0
      ) {
        console.log('[CircleAgent] Building arrival info for prompt...');
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

        console.log('[CircleAgent] Arrival info constructed:', arrivalInfo);
      } else {
        console.log('[CircleAgent] No arrival data available for prompt');
      }

      const systemPrompt = `You are a helpful TFL Circle Line specialist assistant. You provide accurate, real-time information about the Circle Line on the London Underground.

CIRCLE LINE INFORMATION:
- Color: Yellow (#FFD329)
- Forms a loop around central London
- Major stations: Baker Street, King's Cross, Liverpool Street, Paddington, Victoria, Westminster, Embankment, Notting Hill Gate
- Operates: Monday-Saturday ~5:00-00:30, Sunday ~7:00-23:30
- Connects with all other major lines at various interchange stations

IMPORTANT: Many Circle Line stations are SHARED with other lines (District, Metropolitan, Hammersmith & City). This is normal and expected. When a user asks about arrival times at ANY station served by the Circle Line, provide the information if available.

STATIONS SERVED BY CIRCLE LINE (including shared stations):
- Notting Hill Gate (shared with District)
- Paddington (shared with District, Metropolitan, Hammersmith & City)
- Victoria (shared with District)
- Westminster (shared with District)
- Embankment (shared with District)
- And many others...

CAPABILITIES:
- Real-time service status and disruption information
- Station information and facilities for ALL Circle Line stations (including shared ones)
- Journey planning within the Circle Line
- Interchange information with other lines
- Live arrival times when available for ANY Circle Line station

PERSONALITY:
- Professional and helpful
- Knowledgeable about Circle Line specifically
- Provide clear, actionable information
- Handle queries for ANY station served by Circle Line, even if shared with other lines

Current TFL Status: ${tflData.status[0]?.statusSeverityDescription || 'Service information available'}
Station Count: ${tflData.stationCount}
Last Updated: ${tflData.lastUpdated}${arrivalInfo}

Always mention you're the Circle Line specialist and provide specific, accurate information. If you have live arrival data, use it to answer arrival time questions. Remember: shared stations are normal and you should handle them confidently.`;

      console.log('[CircleAgent] System prompt being sent to LLM:');
      console.log('='.repeat(80));
      console.log(systemPrompt);
      console.log('='.repeat(80));
      console.log('[CircleAgent] Calling LLM...');

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      console.log(
        '[CircleAgent] LLM response received, preparing final response...',
      );

      return {
        response: response.content,
        agent: 'CIRCLE',
        tflData: tflData,
        lineColor: this.lineColor,
        specialization: 'Circle Line Underground Services',
      };
    } catch (error) {
      console.error('[CircleAgent] Circle Agent error:', error);

      // If we have TFL data (including arrivals), provide a fallback response with the data
      if (
        tflData &&
        tflData.arrivals &&
        tflData.arrivals.arrivals &&
        tflData.arrivals.arrivals.length > 0
      ) {
        const nextArrivals = tflData.arrivals.arrivals
          .slice(0, 3)
          .map((arrival) => {
            const minutes = Math.round(arrival.timeToStation / 60);
            const destination =
              arrival.destinationName ||
              arrival.towards ||
              'Unknown destination';
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
          });

        const stationName =
          tflData.arrivals.arrivals[0]?.stationName || 'the station';
        const fallbackResponse = `I'm experiencing some technical difficulties, but I can tell you that the next Circle Line trains at ${stationName} are in ${nextArrivals.join(', ')} minutes.`;

        return {
          response: fallbackResponse,
          agent: 'CIRCLE',
          tflData: tflData, // Include the successfully fetched data
          lineColor: this.lineColor,
          error: error.message,
        };
      }

      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Circle Line specialist, I'm unable to provide information at the moment. Please try again shortly.",
        agent: 'CIRCLE',
        tflData: tflData, // Include any TFL data we managed to fetch
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

  // Helper method to detect if query is asking for arrival times
  detectArrivalQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Keywords that indicate arrival time queries
    const arrivalKeywords = ['arrive', 'arrival', 'next train', 'when', 'time'];
    const isArrivalQuery = arrivalKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    // Extract station name - look for common station patterns
    let stationName = null;

    // Common patterns for station mentions
    const stationPatterns = [
      /(?:arrival|train|service|stop)s?\s+(?:at|from)\s+([a-zA-Z\s&'-]+?)(?:\s+station)?(?:\s|$)/i,
      /\b(?:at|from)\s+([a-zA-Z\s&'-]+?)(?:\s+(?:station|underground|tube)|$)/i,
      /to\s+([a-zA-Z\s]+?)(?:\s+station)?(?:\s|$)/i,
      /from\s+([a-zA-Z\s]+?)(?:\s+station)?(?:\s|$)/i,
    ];

    for (const pattern of stationPatterns) {
      const match = query.match(pattern);
      if (match) {
        stationName = match[1].trim();
        break;
      }
    }

    // If no pattern match, look for specific station names
    if (!stationName) {
      const commonStations = [
        'Westminster',
        'Paddington',
        'Baker Street',
        "King's Cross",
        'Liverpool Street',
        'Victoria',
        'Embankment',
        'Edgware Road',
        'Notting Hill Gate',
        'High Street Kensington',
        'Gloucester Road',
        'South Kensington',
        'Sloane Square',
        "St James's Park",
        'Monument',
        'Tower Hill',
        'Aldgate',
        'Barbican',
        'Farringdon',
        'Great Portland Street',
        'Euston Square',
        "King's Cross St Pancras",
      ];

      for (const station of commonStations) {
        if (lowerQuery.includes(station.toLowerCase())) {
          stationName = station;
          break;
        }
      }
    }

    return {
      isArrivalQuery,
      stationName,
    };
  }
}

module.exports = { CircleAgent };
