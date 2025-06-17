// Simulate the exact API call and response processing that happens in the frontend
const axios = require('axios');

async function testFrontendFlow() {
  console.log('=== TESTING FRONTEND API FLOW ===\n');

  try {
    // Step 1: Make the same API call as the frontend
    console.log('1. Making API call to backend...');
    const response = await axios.post('http://localhost:8000/api/chat', {
      query: 'Circle line status',
    });

    console.log('2. Raw API response status:', response.status);
    console.log('3. Raw API response data:', response.data);

    // Step 2: Extract data the same way as ChatInput.jsx
    const apiData = response.data;
    console.log('\n=== SIMULATING CHATINPUT PROCESSING ===');
    console.log('4. apiData.response:', apiData.response);
    console.log('5. typeof apiData.response:', typeof apiData.response);
    console.log(
      '6. apiData.response length:',
      apiData.response ? apiData.response.length : 'undefined',
    );

    // Step 3: Create message object the same way as ChatInput.jsx
    const messageToAdd = {
      role: 'assistant',
      content: apiData.response,
      agent: apiData.agent,
      metadata: apiData.metadata,
      tflData: apiData.tflData,
      lineColor: apiData.lineColor,
      timestamp: apiData.timestamp || new Date().toISOString(),
    };

    console.log('\n=== MESSAGE OBJECT CREATED ===');
    console.log('7. messageToAdd.content:', messageToAdd.content);
    console.log('8. typeof messageToAdd.content:', typeof messageToAdd.content);
    console.log('9. messageToAdd.content truthy?', !!messageToAdd.content);

    // Step 4: Simulate what ChatMessage.jsx would do
    console.log('\n=== SIMULATING CHATMESSAGE RENDERING ===');
    const message = messageToAdd; // This is what ChatMessage receives

    console.log('10. message.content in ChatMessage:', message.content);
    console.log('11. typeof message.content:', typeof message.content);

    if (message.content) {
      console.log('12. Content split test:');
      const lines = message.content.split('\n');
      console.log('    - Number of lines:', lines.length);
      console.log('    - First line:', lines[0]);
      console.log('    - Should render successfully: YES');
    } else {
      console.log(
        '12. ERROR: Content is falsy, would show "No content available"',
      );
    }

    console.log('\n=== EXPECTED FRONTEND DISPLAY ===');
    if (message.content) {
      console.log('Should display:', message.content);
    } else {
      console.log('Should display: ERROR - No content available');
    }
  } catch (error) {
    console.error('Error in test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFrontendFlow();
