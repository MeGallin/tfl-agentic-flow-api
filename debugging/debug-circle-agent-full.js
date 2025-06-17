// Debug script to test full Circle agent flow
const { CircleAgent } = require('../src/agents/circleAgent');

async function testCircleAgent() {
  const agent = new CircleAgent();

  console.log('Testing full Circle agent with Victoria query...');

  try {
    const query = 'When is the next Circle line train arriving at Victoria?';
    const result = await agent.processQuery(query);

    console.log('\n=== CIRCLE AGENT RESULT ===');
    console.log('Response:', result.response);
    console.log('Agent:', result.agent);
    console.log('Line Color:', result.lineColor);

    console.log('\n=== TFL DATA ===');
    if (result.tflData) {
      console.log('Line:', result.tflData.line);
      console.log('Status:', result.tflData.status);
      console.log('Arrivals present:', !!result.tflData.arrivals);

      if (result.tflData.arrivals) {
        console.log('Arrivals data:');
        console.log('- Station ID:', result.tflData.arrivals.stationId);
        console.log('- Line:', result.tflData.arrivals.line);
        console.log('- Count:', result.tflData.arrivals.count);
        console.log(
          '- Arrivals array length:',
          result.tflData.arrivals.arrivals?.length,
        );

        if (
          result.tflData.arrivals.arrivals &&
          result.tflData.arrivals.arrivals.length > 0
        ) {
          console.log('- First arrival:', {
            timeToStation: result.tflData.arrivals.arrivals[0].timeToStation,
            minutes: Math.round(
              result.tflData.arrivals.arrivals[0].timeToStation / 60,
            ),
            destinationName:
              result.tflData.arrivals.arrivals[0].destinationName,
            towards: result.tflData.arrivals.arrivals[0].towards,
          });
        }
      } else {
        console.log('No arrivals data in tflData');
      }
    } else {
      console.log('No tflData in result');
    }

    console.log('\n=== FULL RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error testing Circle agent:', error);
  }
}

testCircleAgent();
