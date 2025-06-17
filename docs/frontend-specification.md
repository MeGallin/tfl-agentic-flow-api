# TFL Underground AI Assistant - Frontend Specification

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component System](#component-system)
4. [State Management](#state-management)
5. [TFL Integration](#tfl-integration)
6. [UI/UX Design](#uiux-design)
7. [Real-time Features](#real-time-features)
8. [API Integration](#api-integration)
9. [Testing Strategy](#testing-strategy)
10. [Deployment](#deployment)

## Overview

The TFL Underground AI Assistant frontend is a modern React application that provides an intuitive interface for interacting with London Underground transport information through specialized AI agents. Users can query Circle, Bakerloo, and District line information through natural language conversations.

### Technology Stack

- **Framework**: React 18 with JavaScript (ES6+)
- **Build Tool**: Vite
- **State Management**: React Context API + useReducer
- **Styling**: Tailwind CSS with custom TFL theming
- **HTTP Client**: Fetch API with custom service layer
- **Icons**: React Icons with London Underground iconography
- **Testing**: Jest + React Testing Library (planned)

### Core Features

- **Single-Page Chat Interface**: Centralized conversation experience
- **Multi-Agent Interaction**: Visual indication of active TFL agent (Circle/Bakerloo/District)
- **Real-time Transport Data**: Integration with TFL API through backend
- **Conversation Management**: Thread-based conversations with history
- **Responsive Design**: Mobile-first approach for commuter usage
- **TFL Branding**: Authentic London Underground visual identity

## Architecture

### Current Project Structure

```
frontend/
├── public/
│   ├── vite.svg
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatContainer.jsx      # Main chat interface
│   │   │   ├── ChatHeader.jsx         # Chat header with agent info
│   │   │   ├── ChatMessages.jsx       # Message list container
│   │   │   ├── ChatMessage.jsx        # Individual message component
│   │   │   ├── ChatInput.jsx          # Message input form
│   │   │   └── AgentIndicator.jsx     # Current agent display
│   │   ├── Layout/
│   │   │   ├── Header.jsx             # App header
│   │   │   └── Footer.jsx             # App footer
│   │   └── UI/
│   │       ├── Button.jsx             # Custom button component
│   │       ├── LoadingSpinner.jsx     # Loading indicator
│   │       └── ErrorMessage.jsx       # Error display
│   ├── contexts/
│   │   └── ChatContext.jsx            # Chat state management
│   ├── services/
│   │   └── chatService.js             # API communication layer
│   ├── hooks/
│   │   ├── useChat.js                 # Chat functionality hook
│   │   └── useLocalStorage.js         # Persistent storage hook
│   ├── utils/
│   │   ├── constants.js               # App constants
│   │   └── helpers.js                 # Utility functions
│   ├── styles/
│   │   ├── index.css                  # Global styles with Tailwind
│   │   └── components.css             # Component-specific styles
│   ├── App.jsx                        # Main application component
│   ├── main.jsx                       # Application entry point
│   └── App.css                        # Additional app styles
├── package.json
├── vite.config.js
├── tailwind.config.js
└── .env                               # Environment variables
```

## Component System

### Chat Components

#### ChatContainer (`src/components/Chat/ChatContainer.jsx`)

**Purpose**: Main chat interface container with TFL agent routing visualization

```javascript
import React from 'react';
import { useChat } from '../../hooks/useChat';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import AgentIndicator from './AgentIndicator';

const ChatContainer = () => {
  const {
    messages,
    isLoading,
    currentAgent,
    confidence,
    sendMessage,
    threadId,
  } = useChat();

  return (
    <div className="chat-container flex flex-col h-full">
      <ChatHeader agent={currentAgent} confidence={confidence} />
      <ChatMessages messages={messages} isLoading={isLoading} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
      <AgentIndicator agent={currentAgent} />
    </div>
  );
};

export default ChatContainer;
```

#### ChatMessage (`src/components/Chat/ChatMessage.jsx`)

**Purpose**: Individual message display with agent identification and TFL data

```javascript
import React from 'react';

const ChatMessage = ({ message }) => {
  const isUser = message.sender === 'user';
  const agentColors = {
    CIRCLE: 'border-yellow-500 bg-yellow-50',
    BAKERLOO: 'border-amber-700 bg-amber-50',
    DISTRICT: 'border-green-600 bg-green-50',
  };

  return (
    <div className={`message ${isUser ? 'user-message' : 'agent-message'}`}>
      {!isUser && message.agent && (
        <div className={`agent-badge ${agentColors[message.agent]}`}>
          {message.agent} LINE
        </div>
      )}
      <div className="message-content">
        {message.content}
        {message.tflData && (
          <div className="tfl-data-display">{/* TFL data visualization */}</div>
        )}
      </div>
      <div className="message-timestamp">
        {new Date(message.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default ChatMessage;
```

### State Management

#### ChatContext (`src/contexts/ChatContext.jsx`)

**Current Implementation**:

```javascript
import React, { createContext, useReducer, useContext } from 'react';
import { chatService } from '../services/chatService';

const ChatContext = createContext();

const initialState = {
  messages: [],
  threadId: null,
  isLoading: false,
  error: null,
  currentAgent: null,
  confidence: 0,
  reasoning: '',
};

const chatReducer = (state, action) => {
  switch (action.type) {
    case 'SEND_MESSAGE_START':
      return { ...state, isLoading: true, error: null };

    case 'SEND_MESSAGE_SUCCESS':
      return {
        ...state,
        messages: [
          ...state.messages,
          action.payload.userMessage,
          action.payload.assistantMessage,
        ],
        threadId: action.payload.threadId,
        currentAgent: action.payload.agent,
        confidence: action.payload.confidence,
        reasoning: action.payload.reasoning,
        isLoading: false,
      };

    case 'SEND_MESSAGE_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'CLEAR_CHAT':
      return initialState;

    default:
      return state;
  }
};

export const ChatProvider = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const sendMessage = async (query) => {
    dispatch({ type: 'SEND_MESSAGE_START' });

    const userMessage = {
      id: Date.now().toString(),
      content: query,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await chatService.sendMessage({
        query,
        threadId: state.threadId,
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        sender: 'assistant',
        agent: response.agent,
        confidence: response.confidence,
        tflData: response.tflData,
        timestamp: response.timestamp,
      };

      dispatch({
        type: 'SEND_MESSAGE_SUCCESS',
        payload: {
          userMessage,
          assistantMessage,
          threadId: response.threadId,
          agent: response.agent,
          confidence: response.confidence,
          reasoning: response.reasoning,
        },
      });
    } catch (error) {
      dispatch({ type: 'SEND_MESSAGE_ERROR', payload: error.message });
    }
  };

  return (
    <ChatContext.Provider value={{ ...state, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};
```

### API Integration

#### ChatService (`src/services/chatService.js`)

**Current Implementation**:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const chatService = {
  async sendMessage(data) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat service error:', error);
      throw new Error('Failed to send message');
    }
  },

  async getConversationHistory(threadId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${threadId}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      throw new Error('Failed to fetch conversation history');
    }
  },

  async deleteThread(threadId) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations/${threadId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting thread:', error);
      throw new Error('Failed to delete conversation');
    }
  },
};
```

## Styling and Theming

### Tailwind Configuration (`tailwind.config.js`)

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tfl: {
          blue: '#0019A8',
          red: '#DC241F',
        },
        lines: {
          circle: '#FFD329',
          bakerloo: '#894E24',
          district: '#007D32',
        },
      },
      fontFamily: {
        tfl: ['Johnston', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

### Global Styles (`src/styles/index.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* TFL-specific component styles */
.chat-container {
  @apply max-w-4xl mx-auto h-screen flex flex-col;
}

.message {
  @apply mb-4 p-3 rounded-lg;
}

.user-message {
  @apply bg-blue-100 ml-auto max-w-xs;
}

.agent-message {
  @apply bg-gray-100 mr-auto max-w-md;
}

.agent-badge {
  @apply text-xs font-semibold px-2 py-1 rounded-full border-2 mb-2 inline-block;
}

.tfl-data-display {
  @apply mt-2 p-2 bg-white rounded border;
}
```

## Environment Configuration

### Environment Variables (`.env`)

```bash
VITE_API_URL=http://localhost:8000
VITE_APP_TITLE=TFL Underground AI Assistant
VITE_ENABLE_DEBUG=true
```

### Vite Configuration (`vite.config.js`)

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
```

## Current Implementation Status

### Completed Features

- ✅ Basic chat interface with message display
- ✅ Agent routing visualization (Circle/Bakerloo/District)
- ✅ API integration with backend
- ✅ Basic state management with Context API
- ✅ Responsive layout with Tailwind CSS
- ✅ TFL brand colors and theming

### Planned Features

- 🔄 Conversation history management
- 🔄 Real-time updates via WebSocket
- 🔄 Enhanced TFL data visualization
- 🔄 Offline support with service worker
- 🔄 Advanced error handling and retry logic
- 🔄 Accessibility improvements (WCAG 2.1 AA)

### Technical Debt

- Message persistence in localStorage
- Error boundary implementation
- Loading state improvements
- Input validation and sanitization
- Performance optimizations for large conversations

This specification accurately reflects the current state of the TFL Underground AI Assistant frontend implementation.
