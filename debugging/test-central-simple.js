const { RouterAgent } = require('../src/agents/routerAgent.js');
const { CentralAgent } = require('../src/agents/centralAgent.js');

async function testCentralSimple() {
  console.log('=== Testing Central Line Components ===');

  try {
    // Test 1: Router routing to Central
    console.log('\n--- Test 1: Router Routing ---');
    const router = new RouterAgent();

    const routeResult1 = await router.routeQuery('next train at Oxford Circus');
    console.log(
      'Oxford Circus query -> Agent:',
      routeResult1.agent,
      'Confidence:',
      routeResult1.confidence,
    );

    const routeResult2 = await router.routeQuery('Central line status');
    console.log(
      'Central line status -> Agent:',
      routeResult2.agent,
      'Confidence:',
      routeResult2.confidence,
    );

    const routeResult3 = await router.routeQuery('arrivals at Bond Street');
    console.log(
      'Bond Street query -> Agent:',
      routeResult3.agent,
      'Confidence:',
      routeResult3.confidence,
    );

    // Test 2: Central Agent station detection
    console.log('\n--- Test 2: Central Agent Station Detection ---');
    const centralAgent = new CentralAgent();

    const detection1 = centralAgent.detectArrivalQuery(
      'next train at Oxford Circus',
    );
    console.log('Oxford Circus detection:', detection1);

    const detection2 = centralAgent.detectArrivalQuery(
      'arrivals at Bond Street',
    );
    console.log('Bond Street detection:', detection2);

    const detection3 = centralAgent.detectArrivalQuery(
      'when is the next Central line train at Bank',
    );
    console.log('Bank detection:', detection3);

    console.log('\n=== Simple Test Complete ===');
  } catch (error) {
    console.error('Test error:', error);
  }
}

testCentralSimple();
