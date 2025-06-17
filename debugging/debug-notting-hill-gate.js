const { CircleLineTools } = require('../src/tools/circleTools');

async function testNottingHillGate() {
  console.log('Testing Notting Hill Gate station lookup...');

  const tools = new CircleLineTools();

  try {
    const stationInfo = await tools.getStationInfo('Notting Hill Gate');
    console.log('Station info result:', JSON.stringify(stationInfo, null, 2));

    if (stationInfo.station) {
      console.log('\n=== STATION DETAILS ===');
      console.log('Station Name:', stationInfo.station.commonName);
      console.log('Station ID:', stationInfo.station.id);
      console.log(
        'Lines served:',
        stationInfo.station.lines?.map((line) => line.name) || 'No line info',
      );
    }

    if (stationInfo.arrivals && stationInfo.arrivals.length > 0) {
      console.log('\n=== ARRIVALS ===');
      stationInfo.arrivals.forEach((arrival, index) => {
        console.log(
          `${index + 1}. Line: ${arrival.lineName}, Time: ${Math.round(
            arrival.timeToStation / 60,
          )} mins, To: ${arrival.towards || arrival.destinationName}`,
        );
      });
    }
  } catch (error) {
    console.error('Error testing Notting Hill Gate:', error.message);
  }
}

testNottingHillGate();
