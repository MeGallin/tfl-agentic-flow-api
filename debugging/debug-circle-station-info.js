// Debug script to test Circle tools getStationInfo method
const { CircleLineTools } = require('../src/tools/circleTools');

async function testStationInfo() {
  const tools = new CircleLineTools();

  console.log('Testing getStationInfo for Victoria...');

  try {
    const result = await tools.getStationInfo('Victoria');

    console.log('\n=== STATION INFO RESULT ===');
    console.log('Station found:', !!result.station);
    if (result.station) {
      console.log('Station ID:', result.station.id);
      console.log('Station Name:', result.station.commonName);
    }

    console.log('Arrivals found:', !!result.arrivals);
    if (result.arrivals) {
      console.log('Number of arrivals:', result.arrivals.length);
      if (result.arrivals.length > 0) {
        console.log('First arrival:', {
          timeToStation: result.arrivals[0].timeToStation,
          minutes: Math.round(result.arrivals[0].timeToStation / 60),
          destinationName: result.arrivals[0].destinationName,
          towards: result.arrivals[0].towards,
          lineId: result.arrivals[0].lineId,
        });
      }
    }

    console.log('\n=== FULL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error testing station info:', error);
  }
}

testStationInfo();
