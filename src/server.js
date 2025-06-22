require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { TFLUndergroundApp } = require('./app');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests from localhost:3000, localhost:5173, or no origin (like Postman)
      const allowedOrigins = [
        process.env.CORS_ORIGIN,
        'http://localhost:3000',
        'http://localhost:5173',
        'https://tfl.livenotice.co.uk',
        'https://www.tfl.livenotice.co.uk',
      ];
      if (
        !origin ||
        allowedOrigins.some((allowed) => allowed && origin?.includes(allowed))
      ) {
        callback(null, true);
      } else {
        console.log('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());

// Initialize TFL Underground App
const tflApp = new TFLUndergroundApp();

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { query, threadId, userContext } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    const result = await tflApp.processQuery(query, threadId, userContext);

    res.json({
      success: true,
      response: result.response,
      threadId: result.threadId,
      agent: result.agent,
      lineColor: result.lineColor,
      confidence: result.confidence,
      tflData: result.tflData,
      requiresConfirmation: result.requiresConfirmation,
      awaitingConfirmation: result.awaitingConfirmation,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request',
      message: error.message,
    });
  }
});

// Enhanced chat endpoint with confirmation support
app.post('/api/chat/confirm', async (req, res) => {
  try {
    const { query, threadId, userContext, userConfirmation } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    if (userConfirmation === undefined || userConfirmation === null) {
      return res.status(400).json({
        success: false,
        error: 'User confirmation is required for this endpoint',
      });
    }

    const result = await tflApp.processQueryWithConfirmation(query, threadId, userContext, userConfirmation);

    res.json({
      success: true,
      response: result.response,
      threadId: result.threadId,
      agent: result.agent,
      lineColor: result.lineColor,
      confidence: result.confidence,
      tflData: result.tflData,
      requiresConfirmation: result.requiresConfirmation,
      awaitingConfirmation: result.awaitingConfirmation,
      metadata: result.metadata,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Chat confirmation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process confirmation request',
      message: error.message,
    });
  }
});

// Streaming chat endpoint
app.get('/api/chat/stream/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { query, userContext } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Stream the query processing
    try {
      for await (const update of tflApp.streamQuery(query, threadId, JSON.parse(userContext || '{}'))) {
        res.write(`data: ${JSON.stringify(update)}\n\n`);
      }
      res.write('data: {"done": true}\n\n');
    } catch (streamError) {
      res.write(`data: ${JSON.stringify({ error: true, message: streamError.message })}\n\n`);
    } finally {
      res.end();
    }
  } catch (error) {
    console.error('Streaming chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stream chat',
      message: error.message,
    });
  }
});

// Get conversation history
app.get('/api/conversations/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit, includeContext } = req.query;

    const history = await tflApp.getConversationHistory(
      threadId,
      parseInt(limit) || 50,
    );

    res.json({
      success: true,
      threadId,
      history,
      count: Array.isArray(history) ? history.length : history.recentMessages?.length || 0,
      enhanced: !Array.isArray(history),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Conversation history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history',
      message: error.message,
    });
  }
});

// Get conversation insights
app.get('/api/conversations/:threadId/insights', async (req, res) => {
  try {
    const { threadId } = req.params;

    const insights = await tflApp.getConversationInsights(threadId);

    if (!insights) {
      return res.status(404).json({
        success: false,
        error: 'No insights available for this conversation',
      });
    }

    res.json({
      success: true,
      threadId,
      insights,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Conversation insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation insights',
      message: error.message,
    });
  }
});

// Trigger manual summarization
app.post('/api/conversations/:threadId/summarize', async (req, res) => {
  try {
    const { threadId } = req.params;

    const summaryId = await tflApp.triggerSummarization(threadId);

    if (!summaryId) {
      return res.status(400).json({
        success: false,
        error: 'Unable to create summary - no messages to summarize or feature not available',
      });
    }

    res.json({
      success: true,
      threadId,
      summaryId,
      message: 'Conversation summary created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual summarization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation summary',
      message: error.message,
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const healthStatus = await tflApp.getHealthStatus();

    res.status(healthStatus.healthy ? 200 : 503).json({
      ...healthStatus,
      service: 'TFL Underground AI Assistant Backend',
    });
  } catch (error) {
    res.status(503).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      service: 'TFL Underground AI Assistant Backend',
    });
  }
});

// App info
app.get('/api/info', (req, res) => {
  res.json(tflApp.getInfo());
});

// TFL endpoints
app.get('/api/tfl/lines', (req, res) => {
  res.json({
    success: true,
    lines: ['circle', 'bakerloo', 'district'],
    supportedServices: ['status', 'stations', 'arrivals', 'journey-planning'],
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`TFL Underground AI Assistant Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Chat endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`App info: http://localhost:${PORT}/api/info`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await tflApp.shutdown();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(async () => {
    await tflApp.shutdown();
    process.exit(0);
  });
});

module.exports = app;
