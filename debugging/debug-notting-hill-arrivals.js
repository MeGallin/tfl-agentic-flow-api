const https = require('https');

async function testNottingHillArrivals() {
  console.log('Testing direct TFL API call for Notting Hill Gate arrivals...');

  // Test the direct TFL API call
  const stationId = '940GZZLUNHG'; // Notting Hill Gate station code
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
            console.log(
              `Found ${arrivals.length} total arrivals at Notting Hill Gate`,
            );

            // Filter by line
            const circleArrivals = arrivals.filter(
              (arrival) => arrival.lineName === 'Circle',
            );
            const districtArrivals = arrivals.filter(
              (arrival) => arrival.lineName === 'District',
            );
            const centralArrivals = arrivals.filter(
              (arrival) => arrival.lineName === 'Central',
            );

            console.log(`Circle Line arrivals: ${circleArrivals.length}`);
            console.log(`District Line arrivals: ${districtArrivals.length}`);
            console.log(`Central Line arrivals: ${centralArrivals.length}`);

            if (circleArrivals.length > 0) {
              console.log('\n=== CIRCLE LINE ARRIVALS ===');
              circleArrivals.slice(0, 3).forEach((arrival, index) => {
                const minutes = Math.round(arrival.timeToStation / 60);
                console.log(
                  `${index + 1}. ${minutes} mins to ${
                    arrival.destinationName || arrival.towards
                  }`,
                );
              });
            }

            if (districtArrivals.length > 0) {
              console.log('\n=== DISTRICT LINE ARRIVALS ===');
              districtArrivals.slice(0, 3).forEach((arrival, index) => {
                const minutes = Math.round(arrival.timeToStation / 60);
                console.log(
                  `${index + 1}. ${minutes} mins to ${
                    arrival.destinationName || arrival.towards
                  }`,
                );
              });
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

testNottingHillArrivals().catch(console.error);
