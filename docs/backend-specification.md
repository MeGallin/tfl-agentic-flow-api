# TFL Underground AI Assistant - Backend Specification

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [LangGraph Implementation](#langgraph-implementation)
4. [Agent System](#agent-system)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Middleware & Security](#middleware--security)
8. [Environment Configuration](#environment-configuration)
9. [Error Handling](#error-handling)
10. [Deployment](#deployment)

## Overview

The TFL Underground AI Assistant backend is a Node.js/Express.js application built with LangGraph.js for intelligent conversation routing and multi-agent AI interactions. It provides specialized transport information through dedicated agents for Circle, Bakerloo, and District line services.

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **AI Framework**: LangChain.js with @langchain/langgraph
- **Database**: SQLite with sqlite3
- **LLM**: OpenAI GPT-4o-mini
- **Environment**: dotenv
- **Utilities**: uuid, cors

### Core Features

- Multi-agent conversation routing with LangGraph state machines
- TFL API integration for real-time transport data
- SQLite-based conversation persistence
- RESTful API with CORS support
- Comprehensive error handling and logging
- Thread-based conversation management

## Architecture

### Current Project Structure

```
api/
├── src/
│   ├── agents/
│   │   ├── routerAgent.js          # Query routing logic
│   │   ├── circleAgent.js          # Circle line specialist
│   │   ├── bakerlooAgent.js        # Bakerloo line specialist
│   │   └── districtAgent.js        # District line specialist
│   ├── memory/
│   │   ├── chatMemory.js           # SQLite conversation storage
│   │   └── conversationUtils.js    # Context management utilities
│   ├── tools/
│   │   ├── circleTools.js          # Circle line TFL API tools
│   │   ├── bakerlooTools.js        # Bakerloo line TFL API tools
│   │   └── districtTools.js        # District line TFL API tools
│   ├── routes/
│   │   └── index.js                # Express route definitions
│   ├── app.js                      # LangGraph implementation
│   └── server.js                   # Express server setup
├── database/
│   └── chatHistory.sqlite          # SQLite database file
├── package.json
├── .env
└── README.md
```

## LangGraph Implementation

### State Definition (`src/app.js`)

**Current TFL State Schema**:

```javascript
import { Annotation } from '@langchain/langgraph';

const TFLUndergroundState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  currentQuery: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  routedAgent: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  routingConfidence: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  routingReasoning: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
  threadId: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  userContext: Annotation({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),
  tflData: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  response: Annotation({
    reducer: (x, y) => y ?? x,
    default: () => '',
  }),
});
```

### Graph Construction

**Current Flow**:

```javascript
class TFLUndergroundGraph {
  constructor() {
    this.chatMemory = new ChatMemory();
    this.conversationUtils = new ConversationUtils();
    this.routerAgent = new RouterAgent();
    this.circleAgent = new CircleAgent();
    this.bakerlooAgent = new BakerlooAgent();
    this.districtAgent = new DistrictAgent();
    this.graph = this.createGraph();
  }

  createGraph() {
    const graph = new StateGraph(TFLUndergroundState)
      .addNode('router', this.routerNode.bind(this))
      .addNode('circle', this.circleNode.bind(this))
      .addNode('bakerloo', this.bakerlooNode.bind(this))
      .addNode('district', this.districtNode.bind(this))
      .addNode('saveResponse', this.saveResponseNode.bind(this))
      .addEdge(START, 'router')
      .addConditionalEdges('router', this.routeToAgent.bind(this), {
        CIRCLE: 'circle',
        BAKERLOO: 'bakerloo',
        DISTRICT: 'district',
      })
      .addEdge('circle', 'saveResponse')
      .addEdge('bakerloo', 'saveResponse')
      .addEdge('district', 'saveResponse')
      .addEdge('saveResponse', END);

    return graph.compile();
  }
}
```

### Node Implementations

#### Router Node

```javascript
async routerNode(state) {
  console.log("🚇 Router processing query:", state.currentQuery);

  try {
    const routingResult = await this.routerAgent.routeQuery(
      state.currentQuery,
      state.userContext
    );

    return {
      routedAgent: routingResult.agent,
      routingConfidence: routingResult.confidence,
      routingReasoning: routingResult.reasoning,
    };
  } catch (error) {
    console.error("Router error:", error);
    return {
      routedAgent: "CIRCLE", // Default fallback
      routingConfidence: 0.5,
      routingReasoning: "Fallback routing due to error",
    };
  }
}
```

#### Agent Nodes (Circle/Bakerloo/District)

```javascript
async circleNode(state) {
  console.log("🟡 Circle Agent processing query");

  try {
    const response = await this.circleAgent.processQuery(
      state.currentQuery,
      state.userContext
    );

    // Fetch TFL data if needed
    const tflData = await this.fetchTFLData('circle', state.currentQuery);

    return {
      response: response.content,
      tflData: tflData,
    };
  } catch (error) {
    console.error("Circle agent error:", error);
    return {
      response: "I apologize, but I'm having trouble accessing Circle line information right now.",
      tflData: null,
    };
  }
}
```

## Agent System

### RouterAgent (`src/agents/routerAgent.js`)

**Current Implementation**:

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class RouterAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 10,
    });
  }

  async routeQuery(query, userContext = {}) {
    const systemPrompt = `You are a TFL Underground routing assistant. 
    Analyze the user's query and determine which London Underground line they are asking about.

    ROUTING RULES:
    - If query relates to Bakerloo line → respond "BAKERLOO"
    - If query relates to Circle line → respond "CIRCLE"  
    - If query relates to District line → respond "DISTRICT"
    - If unclear → default to "CIRCLE"

    Respond with only: BAKERLOO, CIRCLE, or DISTRICT`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`User Query: ${query}`),
      ]);

      const agent = response.content.trim().toUpperCase();
      const confidence = this.calculateConfidence(query, agent);
      const reasoning = this.generateReasoning(query, agent);

      return { agent, confidence, reasoning };
    } catch (error) {
      console.error('Router agent error:', error);
      return {
        agent: 'CIRCLE',
        confidence: 0.5,
        reasoning: 'Default routing due to processing error',
      };
    }
  }

  calculateConfidence(query, agent) {
    const keywords = {
      CIRCLE: ['circle', 'baker street', "king's cross", 'liverpool street'],
      BAKERLOO: ['bakerloo', 'oxford circus', 'waterloo', 'elephant castle'],
      DISTRICT: ['district', 'westminster', 'victoria', "earl's court"],
    };

    const queryLower = query.toLowerCase();
    const matchCount =
      keywords[agent]?.filter((keyword) => queryLower.includes(keyword))
        .length || 0;

    if (matchCount >= 2) return 0.9;
    if (matchCount === 1) return 0.7;
    return 0.5;
  }

  generateReasoning(query, agent) {
    const queryLower = query.toLowerCase();

    if (queryLower.includes(agent.toLowerCase())) {
      return `Direct mention of ${agent} line in query`;
    }

    // Station-based routing logic
    const stationMentions = {
      'baker street': 'CIRCLE',
      'oxford circus': 'BAKERLOO',
      westminster: 'DISTRICT',
    };

    for (const [station, line] of Object.entries(stationMentions)) {
      if (queryLower.includes(station) && line === agent) {
        return `Query mentions ${station} station (${agent} line)`;
      }
    }

    return `Query content suggests ${agent} line relevance`;
  }
}
```

### Line Agents

#### CircleAgent (`src/agents/circleAgent.js`)

```javascript
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export class CircleAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 500,
    });
    this.agentType = 'CIRCLE';
  }

  async processQuery(query, context = {}) {
    const systemPrompt = `You are a Circle line specialist for London Underground.
    
    CIRCLE LINE EXPERTISE:
    - Stations: Baker Street, King's Cross, Liverpool Street, Paddington, etc.
    - Service information and delays
    - Platform details and accessibility
    - Journey planning within Circle line network
    
    Provide helpful, accurate information about Circle line services.
    Keep responses concise and user-friendly.`;

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`Circle Line Query: ${query}`),
      ]);

      return response;
    } catch (error) {
      console.error('Circle agent processing error:', error);
      throw error;
    }
  }
}
```

## Database Schema

### Current SQLite Implementation

**Threads Table**:

```sql
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);
```

**Messages Table**:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('human', 'assistant')),
  content TEXT NOT NULL,
  agent_type TEXT CHECK (agent_type IN ('CIRCLE', 'BAKERLOO', 'DISTRICT')),
  tfl_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES threads (id) ON DELETE CASCADE
);
```

### ChatMemory Class (`src/memory/chatMemory.js`)

**Current Implementation**:

```javascript
import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

export class ChatMemory {
  constructor(dbPath = './database/chatHistory.sqlite') {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createThread(metadata = {}) {
    const threadId = uuidv4();
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO threads (id, metadata) VALUES (?, ?)',
        [threadId, JSON.stringify(metadata)],
        function (err) {
          if (err) reject(err);
          else resolve(threadId);
        },
      );
    });
  }

  async saveMessage(threadId, role, content, agentType = null, tflData = null) {
    const messageId = uuidv4();
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO messages (id, thread_id, role, content, agent_type, tfl_data) VALUES (?, ?, ?, ?, ?, ?)',
        [
          messageId,
          threadId,
          role,
          content,
          agentType,
          JSON.stringify(tflData),
        ],
        function (err) {
          if (err) reject(err);
          else {
            // Update thread timestamp
            this.db.run(
              'UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [threadId],
            );
            resolve(messageId);
          }
        },
      );
    });
  }

  async getMessages(threadId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?',
        [threadId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        },
      );
    });
  }
}
```

## API Endpoints

### Current Express Routes (`src/routes/index.js`)

```javascript
import express from 'express';
import { TFLUndergroundGraph } from '../app.js';

const router = express.Router();
const tflGraph = new TFLUndergroundGraph();

// Main chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { query, threadId, userContext = {} } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    const result = await tflGraph.processUserQuery(
      query,
      threadId,
      userContext,
    );

    res.json(result);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Get conversation history
router.get('/conversations/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    const messages = await tflGraph.chatMemory.getMessages(threadId);

    res.json({
      success: true,
      threadId,
      messages,
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history',
    });
  }
});

// Delete conversation thread
router.delete('/conversations/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    await tflGraph.chatMemory.deleteThread(threadId);

    res.json({
      success: true,
      message: 'Thread deleted successfully',
    });
  } catch (error) {
    console.error('Delete thread error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete thread',
    });
  }
});

export default router;
```

### Server Setup (`src/server.js`)

```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  }),
);
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'TFL Underground AI Assistant API' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`🚇 TFL Underground AI Assistant API running on port ${PORT}`);
});
```

## Environment Configuration

### Required Environment Variables (`.env`)

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Server Configuration
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DATABASE_PATH=./database/chatHistory.sqlite

# Optional: TFL API Key (for future direct TFL API integration)
TFL_API_KEY=your-tfl-api-key

# Optional: LangSmith Tracing
LANGCHAIN_API_KEY=ls__your-langsmith-key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=TFL-Underground-AI
```

## Current Implementation Status

### Completed Features

- ✅ LangGraph state machine with multi-agent routing
- ✅ SQLite conversation persistence
- ✅ OpenAI integration with specialized agents
- ✅ Express API with CORS support
- ✅ Thread-based conversation management
- ✅ Error handling and logging
- ✅ Agent confidence scoring and reasoning

### In Development

- 🔄 TFL API integration tools
- 🔄 Real-time data fetching
- 🔄 Advanced conversation context management
- 🔄 Performance monitoring and analytics

### Planned Features

- 📋 WebSocket support for real-time updates
- 📋 Advanced caching mechanisms
- 📋 Rate limiting and security enhancements
- 📋 Comprehensive test suite
- 📋 Docker containerization
- 📋 Production deployment configuration

This specification accurately reflects the current backend implementation as of the latest codebase analysis.
