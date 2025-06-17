const { TFLUndergroundApp } = require('../src/app.js');

async function testCentralIntegration() {
  console.log('=== Testing Central Line Integration ===');

  try {
    const app = new TFLUndergroundApp();

    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test 1: Oxford Circus query (should route to Central)
    console.log('\n--- Test 1: Oxford Circus Query ---');
    const result1 = await app.processQuery(
      'next train at Oxford Circus',
      'test-central-1',
    );
    console.log('Agent:', result1.agent);
    console.log('Confidence:', result1.confidence);
    console.log(
      'Response preview:',
      result1.response.substring(0, 100) + '...',
    );
    console.log('Has TFL Data:', !!result1.tflData);
    console.log(
      'Has Arrivals:',
      !!(result1.tflData && result1.tflData.arrivals),
    );

    // Test 2: Explicit Central line mention
    console.log('\n--- Test 2: Explicit Central Line Mention ---');
    const result2 = await app.processQuery(
      'Central line status',
      'test-central-2',
    );
    console.log('Agent:', result2.agent);
    console.log('Confidence:', result2.confidence);
    console.log(
      'Response preview:',
      result2.response.substring(0, 100) + '...',
    );

    // Test 3: Bond Street query (Central line station)
    console.log('\n--- Test 3: Bond Street Query ---');
    const result3 = await app.processQuery(
      'arrivals at Bond Street',
      'test-central-3',
    );
    console.log('Agent:', result3.agent);
    console.log('Confidence:', result3.confidence);
    console.log(
      'Response preview:',
      result3.response.substring(0, 100) + '...',
    );

    console.log('\n=== Integration Test Complete ===');

    await app.shutdown();
  } catch (error) {
    console.error('Test error:', error);
  }
}

testCentralIntegration();
