const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { ElizabethLineTools } = require('../tools/elizabethTools');
const { createElizabethPrompt } = require('../prompts/elizabethPrompt');

class ElizabethAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0.3;
    this.tools = new ElizabethLineTools();
    this.lineColor = '#7156A5'; // TFL Elizabeth line purple
  }

  async processQuery(query, sharedLLM = null, context = {}) {
    console.log('[ElizabethAgent] Starting to process query...');

    let tflData = null;

    try {
      const llm =
        sharedLLM ||
        new ChatOpenAI({
          model: this.model,
          temperature: this.temperature,
          timeout: 10000,
        });
      console.log('[ElizabethAgent] LLM initialized, fetching TFL data...');

      const rawTflData = await this.tools.getLineInfo(query);
      const arrivalQuery = this.detectArrivalQuery(query);
      let arrivalData = null;

      if (arrivalQuery.isArrivalQuery && arrivalQuery.stationName) {
        console.log(
          `[ElizabethAgent] Detected arrival query for station: ${arrivalQuery.stationName}`,
        );

        const stationInfo = await this.tools.getStationInfo(
          arrivalQuery.stationName,
        );

        if (stationInfo.station && stationInfo.arrivals) {
          arrivalData = {
            stationId: stationInfo.station.id,
            line: 'Elizabeth',
            arrivals: stationInfo.arrivals,
            count: stationInfo.arrivals.length,
            lastUpdated: new Date().toISOString(),
          };
        }
      }

      tflData = {
        line: {
          name: rawTflData.line?.name || 'Elizabeth Line',
          id: rawTflData.line?.id || 'elizabeth',
        },
        status: rawTflData.status?.slice(0, 3) || [
          { statusSeverityDescription: 'Good Service' },
        ],
        stationCount: rawTflData.stationCount || 41,
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

      const systemPrompt = createElizabethPrompt(tflData, arrivalInfo);
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(query),
      ]);

      return {
        response: response.content,
        agent: 'ELIZABETH',
        tflData: tflData,
        lineColor: this.lineColor,
        specialization: 'Elizabeth Line Underground Services',
      };
    } catch (error) {
      console.error('[ElizabethAgent] Elizabeth Agent error:', error);

      return {
        response:
          "I apologize, but I'm experiencing technical difficulties. As your Elizabeth Line specialist, I'm unable to provide information at the moment. Please try again shortly.",
        agent: 'ELIZABETH',
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
    const commonStations = [
      'Reading',
      'Twyford',
      'Maidenhead',
      'Taplow',
      'Burnham',
      'Slough',
      'Langley',
      'Iver',
      'West Drayton',
      'Hayes & Harlington',
      'Southall',
      'Hanwell',
      'West Ealing',
      'Ealing Broadway',
      'Acton Main Line',
      'Paddington',
      'Bond Street',
      'Tottenham Court Road',
      'Farringdon',
      'Liverpool Street',
      'Whitechapel',
      'Canary Wharf',
      'Custom House',
      'Abbey Wood',
      'Woolwich',
      'Stratford',
      'Maryland',
      'Forest Gate',
      'Manor Park',
      'Ilford',
      'Seven Kings',
      'Goodmayes',
      'Chadwell Heath',
      'Romford',
      'Gidea Park',
      'Harold Wood',
      'Brentwood',
      'Shenfield',
      'Heathrow Terminals 2 & 3',
      'Heathrow Terminal 4',
      'Heathrow Terminal 5',
    ];

    for (const station of commonStations) {
      if (lowerQuery.includes(station.toLowerCase())) {
        stationName = station;
        break;
      }
    }

    return { isArrivalQuery, stationName };
  }
}

module.exports = { ElizabethAgent };