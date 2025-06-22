const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
// LangSmith tracing removed
const { JubileeLineTools } = require('../tools/jubileeTools');
const { createJubileePrompt } = require('../prompts/jubileePrompt');
const { todays_date_time } = require('../tools/dateTimeTools');

class JubileeAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0.3;
    this.tools = new JubileeLineTools();
    this.lineColor = '#A0A5A9'; // TFL Jubilee line grey
  }

  processQuery = async (query, sharedLLM = null, context = {}) => {
    console.log('[JubileeAgent] Starting to process query...');

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
      console.log('[JubileeAgent] LLM initialized, fetching TFL data...');

      // Get real-time TFL data but limit it to prevent token overflow
      const rawTflData = await this.tools.getLineInfo(query);

      // Check if the query is asking for arrival times at a specific station
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[JubileeAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        // Get station info which now includes arrivals
        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        console.log(
          `[JubileeAgent] Station info result:`,
          JSON.stringify(stationInfo, null, 2),
        );

        if (stationInfo.station && stationInfo.arrivals) {
          console.log(
            `[JubileeAgent] Found station: ${stationInfo.station.commonName} with ${stationInfo.arrivals.length} arrivals`,
          );

          // Format arrival data to match expected structure
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'Jubilee',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };

          console.log(
            `[JubileeAgent] Formatted arrival data:`,
            JSON.stringify(arrivalData, null, 2),
          );
        } else {
          console.log(
            `[JubileeAgent] No station or arrivals found in stationInfo`,
          );
        }
      }

      // Filter and limit the TFL data to prevent overwhelming the LLM
      tflData = {
        line: {
          name: rawTflData.line?.name || 'Jubilee Line',
          id: rawTflData.line?.id || 'jubilee',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 27,
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
        '[JubileeAgent] TFL data filtered and limited, preparing prompt...',
      );

      // Build system prompt with arrival data if available
      let arrivalInfo = '';
      console.log('[JubileeAgent] Checking arrival data for prompt...');
      console.log(
        '[JubileeAgent] tflData.arrivals:',
        JSON.stringify(tflData.arrivals, null, 2),
      );

      if (
        tflData.arrivals &&
        tflData.arrivals.arrivals &&
        tflData.arrivals.arrivals.length > 0
      ) {
        console.log('[JubileeAgent] Building arrival info for prompt...');
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

        console.log('[JubileeAgent] Arrival info constructed:', arrivalInfo);
      } else {
        console.log('[JubileeAgent] No arrival data available for prompt');
      }

      // Get current London time for the prompt
      const currentTime = todays_date_time();
      const systemPrompt = createJubileePrompt(tflData, arrivalInfo, currentTime);

      console.log('[JubileeAgent] System prompt being sent to LLM:');
      console.log('='.repeat(80));
      console.log(systemPrompt);
      console.log('='.repeat(80));
      console.log('[JubileeAgent] Calling LLM...');

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      console.log(
        '[JubileeAgent] LLM response received, preparing final response...',
      );

      return {
        response: response.content,
        agent: 'JUBILEE',
        tflData: tflData,
        lineColor: this.lineColor,
        specialization: 'Jubilee Line Underground Services',
      };
    } catch (error) {
      console.error('[JubileeAgent] Jubilee Agent error:', error);

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
        const fallbackResponse = `I'm experiencing some technical difficulties, but I can tell you that the next Jubilee Line trains at ${stationName} are in ${nextArrivals.join(', ')} minutes.`;

        return {
          response: fallbackResponse,
          agent: 'JUBILEE',
          tflData: tflData, // Include the successfully fetched data
          lineColor: this.lineColor,
          error: error.message,
        };
      }

      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Jubilee Line specialist, I'm unable to provide information at the moment. Please try again shortly.",
        agent: 'JUBILEE',
        tflData: tflData, // Include any TFL data we managed to fetch
        lineColor: this.lineColor,
        error: error.message,
      };
    }
  };

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
        'Stanmore',
        'Canons Park',
        'Queensbury',
        'Kingsbury',
        'Wembley Park',
        'Neasden',
        'Dollis Hill',
        'Willesden Green',
        'Kilburn',
        'West Hampstead',
        'Finchley Road',
        'Swiss Cottage',
        'St. John\'s Wood',
        'Baker Street',
        'Bond Street',
        'Green Park',
        'Westminster',
        'Waterloo',
        'Southwark',
        'London Bridge',
        'Bermondsey',
        'Canada Water',
        'Canary Wharf',
        'North Greenwich',
        'Canning Town',
        'West Ham',
        'Stratford',
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

module.exports = { JubileeAgent };