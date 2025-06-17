const { CircleLineTools } = require('../src/tools/circleTools');

async function debugCircleTools() {
  console.log('=== DEBUGGING CIRCLE TOOLS DETAILED ===');

  const tools = new CircleLineTools();

  try {
    console.log('1. Testing getStationInfo for Notting Hill Gate...');
    const stationInfo = await tools.getStationInfo('Notting Hill Gate');

    console.log('2. Station info result:');
    console.log('   Station ID:', stationInfo.station?.id);
    console.log('   Station Name:', stationInfo.station?.commonName);
    console.log('   Arrivals count:', stationInfo.arrivals?.length || 0);

    if (stationInfo.station?.id) {
      console.log('\n3. Testing direct getArrivals with found station ID...');
      const directArrivals = await tools.getArrivals(stationInfo.station.id);
      console.log(
        '   Direct arrivals count:',
        directArrivals.arrivals?.length || 0,
      );

      if (directArrivals.arrivals && directArrivals.arrivals.length > 0) {
        console.log('   First arrival:', {
          timeToStation: directArrivals.arrivals[0].timeToStation,
          destination: directArrivals.arrivals[0].destinationName,
          lineId: directArrivals.arrivals[0].lineId,
          lineName: directArrivals.arrivals[0].lineName,
        });
      }
    }

    // Test with the known working station ID
    console.log('\n4. Testing with known working station ID (940GZZLUNHG)...');
    const knownStationArrivals = await tools.getArrivals('940GZZLUNHG');
    console.log(
      '   Known station arrivals count:',
      knownStationArrivals.arrivals?.length || 0,
    );

    if (
      knownStationArrivals.arrivals &&
      knownStationArrivals.arrivals.length > 0
    ) {
      console.log('   First arrival from known station:', {
        timeToStation: knownStationArrivals.arrivals[0].timeToStation,
        destination: knownStationArrivals.arrivals[0].destinationName,
        lineId: knownStationArrivals.arrivals[0].lineId,
        lineName: knownStationArrivals.arrivals[0].lineName,
      });
    }
  } catch (error) {
    console.error('Error in debugging:', error.message);
  }
}

debugCircleTools();
