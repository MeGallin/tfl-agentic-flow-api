# TFL Underground AI Assistant - Project Setup Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Database Configuration](#database-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Development Workflow](#development-workflow)
8. [Testing Setup](#testing-setup)
9. [Deployment Guide](#deployment-guide)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0 or higher
- **npm**: Version 8.0 or higher (or yarn/pnpm equivalent)
- **Git**: Latest version for version control
- **OpenAI API Key**: Required for AI agent functionality
- **Code Editor**: VS Code recommended with extensions

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag",
    "christian-kohler.npm-intellisense"
  ]
}
```

### TFL API Access

- The TFL API is free for basic usage
- Rate limits apply: 500 requests per hour per key
- Register at [TFL Developer Portal](https://api.tfl.gov.uk) if enhanced rate limits needed
- Basic endpoints used don't require authentication

## Project Structure

Create the following directory structure:

```
TFL-agentic-flow/
├── backend/                        # Node.js/Express API
│   ├── src/
│   │   ├── agents/                 # TFL Agent implementations
│   │   ├── memory/                 # Conversation persistence
│   │   ├── utils/                  # Workflow utilities
│   │   ├── prompts/               # LLM prompt templates
│   │   ├── tools/                 # TFL API integration tools
│   │   ├── routes/                # API route definitions
│   │   ├── app.js                 # LangGraph implementation
│   │   └── server.js              # Express server setup
│   ├── database/                  # SQLite database files
│   ├── package.json
│   └── .env
├── frontend/                      # React application
│   ├── src/
│   │   ├── components/            # React components
│   │   ├── contexts/              # React Context providers
│   │   ├── services/              # API services
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── types/                 # TypeScript definitions
│   │   ├── utils/                 # Utility functions
│   │   └── styles/                # CSS/styling files
│   ├── public/                    # Static assets
│   ├── package.json
│   └── .env
├── docs/                          # Documentation
│   ├── backend-specification.md
│   ├── frontend-specification.md
│   └── project-setup-guide.md
└── README.md                      # Project overview
```

## Backend Setup

### Step 1: Initialize Backend Project

```bash
# Navigate to project directory
cd TFL-agentic-flow

# Create backend directory
mkdir backend
cd backend

# Initialize Node.js project
npm init -y

# Install core dependencies
npm install express cors dotenv uuid sqlite3

# Install LangChain and AI dependencies
npm install langchain @langchain/openai @langchain/community

# Install LangGraph (if available) or state machine alternative
npm install @langchain/langgraph

# Install development dependencies
npm install --save-dev nodemon eslint prettier

# Create src directory structure
mkdir -p src/{agents,memory,utils,prompts/{router,circle,bakerloo,district},tools,routes}
mkdir database
```

### Step 2: Create Package.json Scripts

```json
{
  "name": "tfl-underground-ai-backend",
  "version": "1.0.0",
  "description": "TFL Underground AI Assistant Backend",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  },
  "keywords": ["tfl", "ai", "transport", "langgraph", "nodejs"],
  "author": "Your Name",
  "license": "MIT"
}
```

### Step 3: Create Core Backend Files

#### Express Server (`src/server.js`)

```javascript
// filepath: backend/src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { TFLUndergroundGraph } = require('./app');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

// Initialize TFL Underground Graph
const tflGraph = new TFLUndergroundGraph();

// Routes
app.post('/api/chat', async (req, res) => {
  try {
    const { query, threadId, userContext } = req.body;

    const result = await tflGraph.invoke({
      messages: [{ role: 'user', content: query }],
      currentQuery: query,
      threadId: threadId || null,
      userContext: userContext || {},
    });

    res.json({
      success: true,
      response: result.response,
      threadId: result.threadId,
      agent: result.routedAgent,
      confidence: result.routingConfidence,
      reasoning: result.routingReasoning,
      tflData: result.tflData,
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// TFL endpoints
app.get('/api/tfl/lines', (req, res) => {
  res.json({
    success: true,
    lines: ['circle', 'bakerloo', 'district'],
    supportedServices: ['status', 'stations', 'arrivals', 'journey-planning'],
  });
});

app.listen(PORT, () => {
  console.log(`TFL Underground AI Assistant Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
```

#### Environment Configuration (`.env`)

```bash
# filepath: backend/.env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Server Configuration
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DATABASE_PATH=./database/chatHistory.sqlite

# TFL API Configuration
TFL_API_BASE_URL=https://api.tfl.gov.uk

# Optional: LangSmith Tracing
LANGCHAIN_API_KEY=your-langsmith-key-if-needed
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=TFL-Underground-AI-Assistant
```

### Step 4: Create Essential Backend Components

#### Basic Router Agent (`src/agents/routerAgent.js`)

```javascript
// filepath: backend/src/agents/routerAgent.js
const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');

class RouterAgent {
  constructor() {
    this.model = 'gpt-4o-mini';
    this.temperature = 0.1;
    this.maxTokens = 10;
  }

  async routeQuery(query, sharedLLM = null) {
    const llm =
      sharedLLM ||
      new ChatOpenAI({
        model: this.model,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });

    const routerPrompt = `
You are a TFL Underground routing assistant. Analyze the user's query and determine which London Underground line they are asking about.

ROUTING RULES:
1. If the user's query is related to the Bakerloo line, respond with: "BAKERLOO"
2. If the user's query is related to the Circle line, respond with: "CIRCLE"  
3. If the user's query is related to the District line, respond with: "DISTRICT"

Look for keywords like:
- Circle line stations: Baker Street, King's Cross, Liverpool Street, etc.
- Bakerloo line stations: Oxford Circus, Waterloo, Elephant & Castle, etc.
- District line stations: Westminster, Victoria, Earl's Court, etc.

If the query mentions multiple lines, choose the most prominent one.
If unclear, default to "CIRCLE".

User Query: ${query}

Respond with only the line name: CIRCLE, BAKERLOO, or DISTRICT
`;

    try {
      const response = await llm.invoke([
        new SystemMessage(routerPrompt),
        new HumanMessage(query),
      ]);

      const routedAgent = response.content.trim().toUpperCase();
      const validAgents = ['CIRCLE', 'BAKERLOO', 'DISTRICT'];

      return {
        agent: validAgents.includes(routedAgent) ? routedAgent : 'CIRCLE',
        confidence: this.calculateConfidence(query, routedAgent),
        reasoning: `Query routed to ${routedAgent} based on content analysis`,
      };
    } catch (error) {
      console.error('Router error:', error);
      return {
        agent: 'CIRCLE',
        confidence: 0.5,
        reasoning: 'Fallback routing due to error',
      };
    }
  }

  calculateConfidence(query, routedAgent) {
    const keywords = {
      CIRCLE: ['circle', 'baker street', "king's cross", 'liverpool street'],
      BAKERLOO: ['bakerloo', 'oxford circus', 'waterloo', 'elephant'],
      DISTRICT: ['district', 'westminster', 'victoria', "earl's court"],
    };

    const queryLower = query.toLowerCase();
    const matchCount =
      keywords[routedAgent]?.filter((keyword) => queryLower.includes(keyword))
        .length || 0;

    if (matchCount >= 2) return 0.9;
    if (matchCount === 1) return 0.7;
    return 0.5;
  }
}

module.exports = { RouterAgent };
```

## Frontend Setup

### Step 1: Initialize React Project

```bash
# Navigate back to project root
cd ../

# Create React project with Vite
npm create vite@latest frontend -- --template react-ts
cd frontend

# Install additional dependencies
npm install axios react-router-dom

# Install UI and styling dependencies
npm install tailwindcss @tailwindcss/forms @tailwindcss/typography
npm install react-icons

# Install development dependencies
npm install --save-dev @types/node

# Initialize Tailwind CSS
npx tailwindcss init -p

# Create src directory structure
mkdir -p src/{components/{chat,tfl,layout,common},contexts,services,hooks,types,utils,styles}
```

### Step 2: Configure Tailwind CSS

```javascript
// filepath: frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tfl: {
          red: '#DC241F',
          blue: '#0019A8',
          navy: '#113B92',
        },
        lines: {
          circle: '#FFD329',
          bakerloo: '#894E24',
          district: '#007D32',
        },
        status: {
          good: '#00782A',
          minor: '#FF6600',
          severe: '#DC241F',
          suspended: '#000000',
        },
      },
      fontFamily: {
        tfl: ['Johnston', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};
```

### Step 3: Create Basic Frontend Structure

#### Main App Component (`src/App.tsx`)

```typescript
// filepath: frontend/src/App.tsx
import React from 'react';
import { ConversationProvider } from './contexts/ConversationContext';
import { TFLProvider } from './contexts/TFLContext';
import { ChatContainer } from './components/chat/ChatContainer';
import { Header } from './components/layout/Header';
import './styles/globals.css';

function App() {
  return (
    <div className="App min-h-screen bg-gray-50">
      <TFLProvider>
        <ConversationProvider>
          <Header />
          <main className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl font-bold text-center mb-8 text-tfl-navy">
                TFL Underground AI Assistant
              </h1>
              <ChatContainer />
            </div>
          </main>
        </ConversationProvider>
      </TFLProvider>
    </div>
  );
}

export default App;
```

#### Environment Configuration (`frontend/.env`)

```bash
# filepath: frontend/.env
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
VITE_APP_TITLE=TFL Underground AI Assistant
VITE_ENABLE_DEBUG=true
```

## Database Configuration

### SQLite Setup

The backend uses SQLite for conversation storage. The database is automatically created when the server starts.

#### Database Schema (`backend/src/memory/chatMemory.js`)

```javascript
// filepath: backend/src/memory/chatMemory.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ChatMemory {
  constructor(dbPath = './database/chatHistory.sqlite') {
    this.dbPath = dbPath;
    this.db = null;
    this.initializeDatabase();
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

  async createTables() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        agent TEXT,
        confidence REAL,
        tfl_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (thread_id) REFERENCES conversations (thread_id)
      );

      CREATE INDEX IF NOT EXISTS idx_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON messages(created_at);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTableSQL, (err) => {
        if (err) {
          console.error('Table creation error:', err);
          reject(err);
        } else {
          console.log('Database tables created/verified');
          resolve();
        }
      });
    });
  }

  async saveMessage(
    threadId,
    role,
    content,
    agent = null,
    confidence = null,
    tflData = null,
  ) {
    const sql = `
      INSERT INTO messages (thread_id, role, content, agent, confidence, tfl_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        [
          threadId,
          role,
          content,
          agent,
          confidence,
          tflData ? JSON.stringify(tflData) : null,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        },
      );
    });
  }

  async getConversationHistory(threadId, limit = 50) {
    const sql = `
      SELECT * FROM messages 
      WHERE thread_id = ? 
      ORDER BY created_at ASC 
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [threadId, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const messages = rows.map((row) => ({
            ...row,
            tfl_data: row.tfl_data ? JSON.parse(row.tfl_data) : null,
          }));
          resolve(messages);
        }
      });
    });
  }
}

module.exports = { ChatMemory };
```

## Development Workflow

### Starting the Development Environment

```bash
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend
cd frontend
npm run dev

# Terminal 3: Watch for changes (optional)
cd TFL-agentic-flow
git status
```

### Development Scripts

#### Backend Scripts

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest",
    "test:agents": "jest src/agents/",
    "test:tools": "jest src/tools/",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "db:reset": "rm -f database/chatHistory.sqlite && node src/server.js"
  }
}
```

#### Frontend Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src/",
    "format": "prettier --write src/",
    "type-check": "tsc --noEmit"
  }
}
```

### Code Quality Configuration

#### ESLint Configuration (`backend/.eslintrc.js`)

```javascript
// filepath: backend/.eslintrc.js
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
  },
};
```

## Testing Setup

### Backend Testing

```bash
# Install testing dependencies
cd backend
npm install --save-dev jest supertest

# Create test directory
mkdir -p src/__tests__/{agents,tools,integration}
```

#### Example Test (`backend/src/agents/__tests__/routerAgent.test.js`)

```javascript
// filepath: backend/src/agents/__tests__/routerAgent.test.js
const { RouterAgent } = require('../routerAgent');

describe('RouterAgent', () => {
  let router;

  beforeEach(() => {
    router = new RouterAgent();
  });

  test('should route Circle line queries correctly', async () => {
    const result = await router.routeQuery(
      'What is the status of Circle line?',
    );

    expect(result.agent).toBe('CIRCLE');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('should route Bakerloo line queries correctly', async () => {
    const result = await router.routeQuery(
      'Oxford Circus station delays on Bakerloo line',
    );

    expect(result.agent).toBe('BAKERLOO');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('should handle ambiguous queries with fallback', async () => {
    const result = await router.routeQuery('Hello there');

    expect(result.agent).toBe('CIRCLE');
    expect(result.confidence).toBeLessThan(0.7);
  });
});
```

### Frontend Testing

```bash
# Install testing dependencies
cd frontend
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

## Deployment Guide

### Production Environment Variables

#### Backend Production (`.env.production`)

```bash
# filepath: backend/.env.production
NODE_ENV=production
PORT=8000
OPENAI_API_KEY=your-production-openai-key
DATABASE_PATH=/app/data/chatHistory.sqlite
CORS_ORIGIN=https://your-frontend-domain.com
```

#### Frontend Production (`.env.production`)

```bash
# filepath: frontend/.env.production
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com/ws
VITE_APP_TITLE=TFL Underground AI Assistant
```

### Docker Configuration

#### Backend Dockerfile

```dockerfile
# filepath: backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY database/ ./database/

EXPOSE 8000

CMD ["npm", "start"]
```

#### Frontend Dockerfile

```dockerfile
# filepath: frontend/Dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
# filepath: docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - '8000:8000'
    environment:
      - NODE_ENV=production
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data

  frontend:
    build: ./frontend
    ports:
      - '80:80'
    depends_on:
      - backend
```

## Troubleshooting

### Common Issues

#### 1. OpenAI API Key Issues

**Problem**: `Error: OpenAI API key not found`

**Solution**:

```bash
# Check environment variable
echo $OPENAI_API_KEY

# Set in .env file
OPENAI_API_KEY=sk-your-actual-key-here

# Restart servers after changing .env
```

#### 2. Database Connection Issues

**Problem**: `SQLITE_CANTOPEN: unable to open database file`

**Solution**:

```bash
# Create database directory
mkdir -p backend/database

# Check permissions
chmod 755 backend/database

# Reset database
npm run db:reset
```

#### 3. CORS Issues

**Problem**: `Access to fetch blocked by CORS policy`

**Solution**:

```javascript
// backend/src/server.js
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }),
);
```

#### 4. TFL API Rate Limiting

**Problem**: `429 Too Many Requests`

**Solution**:

- Implement request caching
- Add retry logic with exponential backoff
- Consider upgrading to authenticated TFL API access

### Debug Mode

Enable debug logging:

```bash
# Backend
DEBUG=true npm run dev

# Frontend
VITE_ENABLE_DEBUG=true npm run dev
```

### Health Checks

Test system health:

```bash
# Backend health
curl http://localhost:8000/api/health

# Test chat endpoint
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "Circle line status"}'

# Test TFL endpoints
curl http://localhost:8000/api/tfl/lines
```

This comprehensive setup guide provides everything needed to get the TFL Underground AI Assistant up and running in both development and production environments.
