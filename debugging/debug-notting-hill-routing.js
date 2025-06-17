const { RouterAgent } = require('../src/agents/routerAgent');

async function testNottingHillRouting() {
  console.log('Testing Notting Hill Gate routing...');

  const router = new RouterAgent();
  const query = 'when does the next train arrive at Notting Hill Gate';

  try {
    // Test the confidence calculation directly
    const confidence = router.calculateConfidence(query, 'CIRCLE');
    console.log('Confidence for CIRCLE routing:', confidence);

    // Test the full routing
    const result = await router.processQuery(query);
    console.log('Routing result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error testing routing:', error.message);
  }
}

testNottingHillRouting();
