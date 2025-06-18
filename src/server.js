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

// Get conversation history
app.get('/api/conversations/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit } = req.query;

    const history = await tflApp.getConversationHistory(
      threadId,
      parseInt(limit) || 50,
    );

    res.json({
      success: true,
      threadId,
      history,
      count: history.length,
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
