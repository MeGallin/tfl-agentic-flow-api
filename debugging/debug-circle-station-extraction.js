// Debug script to test Circle agent station name extraction
const query = 'When is the next Circle line train arriving at Victoria?';

function detectArrivalQuery(query) {
  const lowerQuery = query.toLowerCase();
  console.log('Query:', query);
  console.log('Lower query:', lowerQuery);

  // Keywords that indicate arrival time queries
  const arrivalKeywords = ['arrive', 'arrival', 'next train', 'when', 'time'];
  const isArrivalQuery = arrivalKeywords.some((keyword) =>
    lowerQuery.includes(keyword),
  );

  console.log('Is arrival query:', isArrivalQuery);

  // Extract station name - look for common station patterns
  let stationName = null;

  // Common patterns for station mentions
  const stationPatterns = [
    /(?:arrival|train|service|stop)s?\s+(?:at|from)\s+([a-zA-Z\s&'-]+?)(?:\s+station)?(?:\s|$)/i,
    /\b(?:at|from)\s+([a-zA-Z\s&'-]+?)(?:\s+(?:station|underground|tube)|$)/i,
    /to\s+([a-zA-Z\s]+?)(?:\s+station)?(?:\s|$)/i,
    /from\s+([a-zA-Z\s]+?)(?:\s+station)?(?:\s|$)/i,
  ];

  console.log('\nTesting regex patterns:');
  for (let i = 0; i < stationPatterns.length; i++) {
    const pattern = stationPatterns[i];
    const match = query.match(pattern);
    console.log(`Pattern ${i + 1}:`, pattern);
    console.log(`Match:`, match);
    if (match) {
      stationName = match[1].trim();
      console.log(`Extracted station name: "${stationName}"`);
      break;
    }
  }

  // If no pattern match, look for specific station names
  if (!stationName) {
    console.log('\nNo regex match, checking common stations...');
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
      console.log(`Checking: "${station}" in "${lowerQuery}"`);
      if (lowerQuery.includes(station.toLowerCase())) {
        stationName = station;
        console.log(`Found station: "${stationName}"`);
        break;
      }
    }
  }

  return {
    isArrivalQuery,
    stationName,
  };
}

// Test the function
const result = detectArrivalQuery(query);
console.log('\nFinal result:', result);
