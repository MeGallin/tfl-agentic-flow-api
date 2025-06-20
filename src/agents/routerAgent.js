const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const { traceable } = require('langsmith/traceable');
const { routerPrompt } = require('../prompts/routerPrompt');

class RouterAgent {
  constructor() {
    this.model = 'gpt-4o';
    this.temperature = 0;
    this.maxTokens = 50;
  }

  async processQuery(query, sharedLLM = null, context = {}) {
    const routeResult = await this.routeQuery(query, sharedLLM);

    return {
      selectedAgent: routeResult.agent.toLowerCase(),
      confidence: routeResult.confidence,
      reasoning: routeResult.reasoning,
      timestamp: new Date().toISOString(),
    };
  }

  routeQuery = traceable(async (query, sharedLLM = null) => {
    const llm =
      sharedLLM ||
      new ChatOpenAI({
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });
    
    // Ensure routerPrompt is available
    if (!routerPrompt) {
      throw new Error('Router prompt is not defined. Check routerPrompt.js export.');
    }
    
    const prompt = routerPrompt.replace('{{query}}', query);

    try {
      const response = await llm.invoke([
        new SystemMessage(prompt),
        new HumanMessage(query),
      ]);

      const routedAgent = response.content.trim().toUpperCase();
      
      // Handle content filtering responses
      if (routedAgent === 'OFF_TOPIC') {
        return {
          agent: 'OFF_TOPIC',
          confidence: 1.0,
          reasoning: 'Query rejected - not related to London Underground/TfL',
          message: 'I\'m here to help with London Underground (Tube) and TfL queries only. Please ask me about train arrivals, station information, line status, journey planning, or other Underground-related topics!'
        };
      }
      
      if (routedAgent === 'INAPPROPRIATE') {
        return {
          agent: 'INAPPROPRIATE',
          confidence: 1.0,
          reasoning: 'Query rejected - inappropriate content detected',
          message: 'I\'m here to provide helpful London Underground information in a friendly and respectful manner. Please ask me about Tube services, stations, or journey planning!'
        };
      }
      
      const validAgents = [
        'CIRCLE', 'BAKERLOO', 'DISTRICT', 'CENTRAL', 
        'NORTHERN', 'PICCADILLY', 'VICTORIA', 'JUBILEE',
        'METROPOLITAN', 'HAMMERSMITH_CITY', 'WATERLOO_CITY', 'ELIZABETH'
      ];

      return {
        agent: validAgents.includes(routedAgent) ? routedAgent : 'CENTRAL',
        confidence: this.calculateConfidence(query, routedAgent),
        reasoning: `Query routed to ${routedAgent} based on content analysis`,
      };
    } catch (error) {
      console.error('Router error:', error);
      return {
        agent: 'CENTRAL',
        confidence: 0.5,
        reasoning: 'Fallback routing due to error',
      };
    }
  }, {
    name: 'RouterAgent_routeQuery',
    project_name: process.env.LANGCHAIN_PROJECT || 'TFL-Underground-AI-Assistant'
  });

  calculateConfidence(query, routedAgent) {
    const keywords = {
      CIRCLE: [
        'circle',
        'baker street',
        "king's cross",
        'victoria',
        'embankment',
        'monument',
        'westminster',
        'aldgate',
      ],
      BAKERLOO: [
        'bakerloo',
        'paddington',
        'waterloo',
        'elephant & castle',
        'elephant and castle',
        'harrow',
        'wealdstone',
        'piccadilly circus',
      ],
      DISTRICT: [
        'district',
        "earl's court",
        'wimbledon',
        'richmond',
        'upminster',
        'ealing broadway',
        'south kensington',
        'gloucester road',
        'high street kensington',
        'sloane square',
        'fulham broadway',
        'parsons green',
        'putney bridge',
        'east putney',
        'southfields',
        'wimbledon park',
        'barking',
        'dagenham',
        'hornchurch',
        'elm park',
        'upney',
        'becontree',
        'upminster bridge',
      ],
      CENTRAL: [
        'central',
        'oxford circus',
        'bond street',
        'tottenham court road',
        'bank',
        'liverpool street',
        'stratford',
        'notting hill gate',
        'mile end',
        'bethnal green',
        'epping',
        'west ruislip',
      ],
      NORTHERN: [
        'northern',
        'morden',
        'edgware',
        'high barnet',
        'mill hill east',
        'london bridge',
        'old street',
        'angel',
        'camden town',
        'euston',
        'kennington',
        'stockwell',
        'moorgate',
        'borough',
        'charing cross',
        'leicester square',
        'tottenham court road',
        'goodge street',
        'warren street',
      ],
      PICCADILLY: [
        'piccadilly',
        'heathrow',
        'cockfosters',
        'uxbridge',
        'leicester square',
        'piccadilly circus',
        'green park',
        'hyde park corner',
        'knightsbridge',
        'south kensington',
        'hammersmith',
        'acton town',
        'hounslow',
        'finsbury park',
        'arsenal',
        'manor house',
        'turnpike lane',
        'wood green',
        'bounds green',
        'arnos grove',
        'southgate',
        'oakwood',
      ],
      VICTORIA: [
        'victoria',
        'brixton',
        'walthamstow central',
        'oxford circus',
        'green park',
        'euston',
        'finsbury park',
        'highbury & islington',
        'pimlico',
        'vauxhall',
        'stockwell',
        'warren street',
        'tottenham hale',
        'blackhorse road',
        'seven sisters',
      ],
      JUBILEE: [
        'jubilee',
        'stanmore',
        'stratford',
        'canary wharf',
        'north greenwich',
        'london bridge',
        'westminster',
        'green park',
        'bond street',
        'baker street',
        'finchley road',
        'swiss cottage',
        'wembley park',
        'waterloo',
        'southwark',
        'bermondsey',
        'canada water',
        'canning town',
        'west ham',
      ],
      METROPOLITAN: [
        'metropolitan',
        'aldgate',
        'amersham',
        'chesham',
        'uxbridge',
        'watford',
        'harrow-on-the-hill',
        'moor park',
        'rickmansworth',
        'chorleywood',
        'chalfont & latimer',
        'wembley park',
        'preston road',
        'northwick park',
        'northwood',
        'northwood hills',
        'pinner',
        'rayners lane',
        'eastcote',
        'ruislip manor',
        'ruislip',
        'ickenham',
        'hillingdon',
        'croxley',
      ],
      HAMMERSMITH_CITY: [
        'hammersmith & city',
        'hammersmith city',
        'hammersmith',
        'barking',
        'goldhawk road',
        'shepherd\'s bush market',
        'wood lane',
        'latimer road',
        'ladbroke grove',
        'westbourne park',
        'royal oak',
        'edgware road',
        'aldgate east',
        'whitechapel',
        'stepney green',
        'bow road',
        'bromley-by-bow',
        'west ham',
        'plaistow',
        'upton park',
        'east ham',
      ],
      WATERLOO_CITY: [
        'waterloo & city',
        'waterloo city',
        'waterloo',
        'bank',
      ],
      ELIZABETH: [
        'elizabeth',
        'crossrail',
        'reading',
        'heathrow',
        'abbey wood',
        'shenfield',
        'paddington',
        'bond street',
        'tottenham court road',
        'farringdon',
        'liverpool street',
        'whitechapel',
        'canary wharf',
        'custom house',
        'woolwich',
        'stratford',
        'romford',
        'ilford',
        'forest gate',
        'maryland',
        'slough',
        'maidenhead',
        'twyford',
        'ealing broadway',
        'west ealing',
        'hanwell',
        'southall',
        'hayes & harlington',
        'west drayton',
        'iver',
        'langley',
        'burnham',
        'taplow',
      ],
    };

    // Multi-line stations that can be served by multiple agents
    const multiLineStations = {
      westminster: ['CIRCLE', 'DISTRICT'],
      victoria: ['CIRCLE', 'DISTRICT'],
      embankment: ['CIRCLE', 'DISTRICT'],
      monument: ['CIRCLE', 'DISTRICT'],
      'baker street': ['CIRCLE', 'BAKERLOO'],
      paddington: ['CIRCLE', 'DISTRICT', 'BAKERLOO'],
      'notting hill gate': ['CIRCLE', 'DISTRICT', 'CENTRAL'],
      'oxford circus': ['BAKERLOO', 'CENTRAL'],
      'bond street': ['CENTRAL'],
      'tottenham court road': ['CENTRAL'],
      bank: ['CIRCLE', 'CENTRAL'],
      'liverpool street': ['CIRCLE', 'CENTRAL'],
      'south kensington': ['CIRCLE', 'DISTRICT'],
      'gloucester road': ['CIRCLE', 'DISTRICT'],
      'high street kensington': ['CIRCLE', 'DISTRICT'],
      'sloane square': ['CIRCLE', 'DISTRICT'],
    };

    // Preferred agents for arrival queries at multi-line stations
    const arrivalPreferences = {
      westminster: 'CIRCLE',
      victoria: 'DISTRICT',
      embankment: 'CIRCLE',
      monument: 'CIRCLE',
      'baker street': 'BAKERLOO',
      paddington: 'BAKERLOO',
      'notting hill gate': 'CENTRAL', // Prefer Central for Notting Hill Gate arrivals (more frequent)
      'oxford circus': 'CENTRAL',
      'bond street': 'CENTRAL',
      'tottenham court road': 'CENTRAL',
      bank: 'CENTRAL',
      'liverpool street': 'CENTRAL',
      'south kensington': 'DISTRICT', // Prefer District for South Kensington arrivals
      'gloucester road': 'DISTRICT',
      'high street kensington': 'DISTRICT',
      'sloane square': 'DISTRICT',
    };

    const queryLower = query.toLowerCase();

    // Check for explicit line mentions - these take precedence
    const explicitLineMentions = {
      CIRCLE: /\b(circle\s*line|circle)\b/i,
      BAKERLOO: /\b(bakerloo\s*line|bakerloo)\b/i,
      DISTRICT: /\b(district\s*line|district)\b/i,
      CENTRAL: /\b(central\s*line|central)\b/i,
      NORTHERN: /\b(northern\s*line|northern)\b/i,
      PICCADILLY: /\b(piccadilly\s*line|piccadilly)\b/i,
      VICTORIA: /\b(victoria\s*line|victoria)\b/i,
      JUBILEE: /\b(jubilee\s*line|jubilee)\b/i,
      METROPOLITAN: /\b(metropolitan\s*line|metropolitan)\b/i,
      HAMMERSMITH_CITY: /\b(hammersmith\s*&?\s*city\s*line|hammersmith\s*city)\b/i,
      WATERLOO_CITY: /\b(waterloo\s*&?\s*city\s*line|waterloo\s*city)\b/i,
      ELIZABETH: /\b(elizabeth\s*line|elizabeth|crossrail)\b/i,
    };

    // If query explicitly mentions a line, give high confidence if routed correctly
    for (const [line, pattern] of Object.entries(explicitLineMentions)) {
      if (pattern.test(query) && routedAgent === line) {
        return 0.95; // Very high confidence for explicit line mentions
      }
    }

    // Check for arrival time queries
    const isArrivalQuery =
      /\b(next|when|arrival|train.*time|time.*train)\b/i.test(query);

    // Check for multi-line stations
    const mentionedMultiLineStation = Object.keys(multiLineStations).find(
      (station) => queryLower.includes(station),
    );

    if (mentionedMultiLineStation && isArrivalQuery) {
      // For arrival queries at multi-line stations, use preferences
      const preferredAgent = arrivalPreferences[mentionedMultiLineStation];
      if (routedAgent === preferredAgent) {
        return 0.9; // High confidence for preferred agent
      }
      if (multiLineStations[mentionedMultiLineStation].includes(routedAgent)) {
        return 0.6; // Lower confidence for other valid lines
      }
    }

    // Standard keyword matching
    const matchCount =
      keywords[routedAgent]?.filter((keyword) => queryLower.includes(keyword))
        .length || 0;

    if (matchCount >= 2) return 0.9;
    if (matchCount === 1) return 0.7;
    return 0.5;
  }
}

module.exports = { RouterAgent };
