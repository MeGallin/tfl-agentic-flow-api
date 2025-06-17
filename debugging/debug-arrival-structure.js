const https = require('https');

async function checkArrivalStructure() {
  console.log('Checking arrival object structure...');

  const stationId = '940GZZLUNHG'; // Notting Hill Gate
  const url = `https://api.tfl.gov.uk/StopPoint/${stationId}/Arrivals`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const arrivals = JSON.parse(data);

            // Find a Circle Line arrival and examine its structure
            const circleArrival = arrivals.find(
              (arrival) => arrival.lineName === 'Circle',
            );

            if (circleArrival) {
              console.log('=== CIRCLE LINE ARRIVAL OBJECT STRUCTURE ===');
              console.log('Keys:', Object.keys(circleArrival));
              console.log('lineId:', circleArrival.lineId);
              console.log('lineName:', circleArrival.lineName);
              console.log('timeToStation:', circleArrival.timeToStation);
              console.log('destinationName:', circleArrival.destinationName);
              console.log('towards:', circleArrival.towards);
              console.log('stationName:', circleArrival.stationName);
              console.log('\nFull object:');
              console.log(JSON.stringify(circleArrival, null, 2));
            } else {
              console.log('No Circle Line arrivals found');
            }

            resolve();
          } catch (error) {
            console.error('Error parsing JSON:', error.message);
            reject(error);
          }
        });
      })
      .on('error', (error) => {
        console.error('Error making request:', error.message);
        reject(error);
      });
  });
}

checkArrivalStructure().catch(console.error);
