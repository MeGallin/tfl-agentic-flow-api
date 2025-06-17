const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { WaterlooCityLineTools } = require('../tools/waterlooCityTools');
const { createWaterlooCityPrompt } = require('../prompts/waterlooCityPrompt');
const { todays_date_time } = require('../tools/dateTimeTools');

class WaterlooCityAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0.3;
    this.tools = new WaterlooCityLineTools();
    this.lineColor = '#95CDBA'; // TFL Waterloo & City line turquoise
  }

  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[WaterlooCityAgent] Starting to process query...');

    let tflData = null;

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000,
        });
      console.log('[WaterlooCityAgent] LLM initialized, fetching TFL data...');

      const rawTflData = await this.tools.getLineInfo(query);
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[WaterlooCityAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        if (stationInfo.station && stationInfo.arrivals) {
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'Waterloo & City',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };
        }
      }

      tflData = {
        line: {
          name: rawTflData.line?.name || 'Waterloo & City Line',
          id: rawTflData.line?.id || 'waterloo-city',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 2,
        queryProcessed: query,
        lastUpdated: rawTflData.lastUpdated || new Date().toISOString(),
        keyStations:
          rawTflData.stations?.slice(0, 10)?.map((station) => ({
            name: station.commonName || station.name,
            id: station.id,
          })) || [],
        arrivals: arrivalData,
      };

      let arrivalInfo = '';
      if (tflData.arrivals?.arrivals?.length > 0) {
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
      }

      // Get current London time for the prompt
      const currentTime = todays_date_time();

      const systemPrompt = createWaterlooCityPrompt(tflData, arrivalInfo, currentTime);
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      return {
        response: response.content,
        agent: 'WATERLOO_CITY',
        tflData: tflData,
        lineColor: this.lineColor,
        specialization: 'Waterloo & City Line Underground Services',
      };
    } catch (error) {
      console.error('[WaterlooCityAgent] Waterloo & City Agent error:', error);

      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Waterloo & City Line specialist, I'm unable to provide information at the moment. Please try again shortly.",
        agent: 'WATERLOO_CITY',
        tflData: tflData,
        lineColor: this.lineColor,
        error: error.message,
      };
    }
  }

  detectArrivalQuery(query) {
    const lowerQuery = query.toLowerCase();
    const arrivalKeywords = ['arrive', 'arrival', 'next train', 'when', 'time'];
    const isArrivalQuery = arrivalKeywords.some((keyword) =>
      lowerQuery.includes(keyword),
    );

    let stationName = null;
    const commonStations = ['Waterloo', 'Bank'];

    for (const station of commonStations) {
      if (lowerQuery.includes(station.toLowerCase())) {
        stationName = station;
        break;
      }
    }

    return { isArrivalQuery, stationName };
  }
}

module.exports = { WaterlooCityAgent };