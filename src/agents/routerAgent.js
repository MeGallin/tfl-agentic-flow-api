const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

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

  async routeQuery(query, sharedLLM = null) {
    const llm =
      sharedLLM ||
      new ChatOpenAI({
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });
    const routerPrompt = `You are a TFL Underground routing assistant. Analyze the user's query and determine which London Underground line they are asking about.

PRIORITY ROUTING RULES (in order of precedence):

1. EXPLICIT LINE MENTIONS (HIGHEST PRIORITY):
   - If query contains "Circle line" or "Circle" → respond with: "CIRCLE"
   - If query contains "Bakerloo line" or "Bakerloo" → respond with: "BAKERLOO"  
   - If query contains "District line" or "District" → respond with: "DISTRICT"
   - If query contains "Central line" or "Central" → respond with: "CENTRAL"
   - Explicit line mentions ALWAYS override station preferences

2. STATION ROUTING PRIORITY (for multi-line stations when no explicit line mentioned):
   - Westminster: prefer CIRCLE for arrival times
   - Victoria: prefer DISTRICT for arrival times  
   - Embankment: prefer CIRCLE for arrival times
   - Monument: prefer CIRCLE for arrival times
   - Baker Street: prefer BAKERLOO for arrival times
   - Paddington: prefer BAKERLOO for arrival times
   - South Kensington: prefer DISTRICT for arrival times
   - Gloucester Road: prefer DISTRICT for arrival times
   - Notting Hill Gate: prefer CENTRAL for arrival times (Central has more frequent service)
   - Oxford Circus: prefer CENTRAL for arrival times
   - Bond Street: prefer CENTRAL for arrival times
   - Bank: prefer CENTRAL for arrival times
   - Liverpool Street: prefer CENTRAL for arrival times

3. LINE-SPECIFIC STATIONS:
   - Circle line exclusive: King's Cross, Aldgate
   - Bakerloo line exclusive: Waterloo, Elephant & Castle, Harrow & Wealdstone, Piccadilly Circus
   - District line exclusive: Earl's Court, Wimbledon, Richmond, Upminster, Ealing Broadway
   - Central line exclusive: Stratford, Mile End, Bethnal Green, Epping, West Ruislip

EXAMPLES:
- "next train at Victoria for the Circle line" → CIRCLE (explicit line mention)
- "Circle line arrivals at Victoria" → CIRCLE (explicit line mention)
- "when is next train at Victoria" → DISTRICT (station preference, no explicit line)
- "arrivals at Oxford Circus" → CENTRAL (station preference, no explicit line)

If unclear about specific line, default to "CENTRAL".

User Query: ${query}

Respond with only the line name: CIRCLE, BAKERLOO, DISTRICT, or CENTRAL`;

    try {
      const response = await llm.invoke([
        new SystemMessage(routerPrompt),
        new HumanMessage(query),
      ]);

      const routedAgent = response.content.trim().toUpperCase();
      const validAgents = ['CIRCLE', 'BAKERLOO', 'DISTRICT', 'CENTRAL'];

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
  }
  calculateConfidence(query, routedAgent) {
    const keywords = {
      CIRCLE: [
        'circle',
        'baker street',
        "king's cross",
        'victoria',
        'embankment',
        'monument',
        'westminster', // Multi-line station - Circle preferred for arrivals
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
        'notting hill gate', // Multi-line station - Central preferred for arrivals
        'mile end',
        'bethnal green',
        'epping',
        'west ruislip',
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
