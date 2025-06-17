# Conversation Context Implementation Guide

## Overview

This document describes the implementation of conversation context management in the TFL Underground AI Assistant. The system uses persistent memory, context summarization, and intelligent handling of London Underground queries, with a focus on modularity, scalability, and user control.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   SQLite DB     │
│   (React)       │◄──►│   (Express)      │◄──►│   (Memory)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌──────────────────┐               │
         └──────────────│   Shared LLM     │───────────────┘
                        │   (Start Node)   │
                        └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌───────▼───┐ ┌─────▼─────┐ ┌─▼─────┐
            │ Router    │ │ Circle    │ │Bakerloo│
            │ Agent     │ │ Agent     │ │Agent   │
            └───────────┘ └───────────┘ └────────┘
                                │
                        ┌───────▼───┐
                        │ District  │
                        │ Agent     │
                        └───────────┘
```

### Key Architecture Components

1. **Shared LLM Pattern**: A single OpenAI instance is initialized in the start node and passed to all agents via the graph state.
2. **Custom Memory System**: SQLite is used for persistent conversation storage, supporting thread/message separation and cascade deletion.
3. **State Management**: Centralized graph state utilities ensure consistent workflow and error handling.
4. **Agent Integration**: All TFL agents (Circle, Bakerloo, District, Router) receive the shared LLM and memory context.

## Implementation Components

### 1. Shared LLM Pattern

- The shared LLM is created in the start node and injected into all agent nodes via the graph state.
- Agents use the provided LLM instance, falling back to a default if not present.

### 2. Database Schema

- **Threads Table**: Stores conversation threads with metadata and timestamps.
- **Messages Table**: Stores messages linked to threads, with agent type and TFL data.

### 3. Backend Implementation

- **ChatMemory**: Handles thread/message CRUD, cascade deletion, and TFL data storage.
- **ConversationUtils**: Prepares context (recent messages, summary), generates summaries, and extracts key context (lines, stations, topics).

### 4. API Endpoints

- `/thread/:threadId/context`: Returns recent messages, summary, and key context for a thread.
- `/thread/:threadId`: Deletes a thread and all associated messages.

### 5. Frontend Implementation

- **API Service**: Methods for fetching context and deleting threads.
- **ConversationHistory Component**: Loads and displays context previews, handles deletion, and manages UI state.

### 6. LangGraph Integration

- **State Management**: Uses annotations for messages, threadId, conversation history, and summary.
- **TFLUndergroundGraph**: Handles query processing, context preparation, and message persistence.

### 7. Graph State Management

- **Default State**: Contains query, LLM, memory, context, conversation history, summary, agent info, TFL data, errors, and metadata.
- **Utilities**: Functions for creating, updating, and validating state, as well as error handling.

### 8. Utils Integration

- Centralized exports for all utility functions, including state management and agent enums.

## Best Practices

- **Summarization**: Summarize conversations exceeding a threshold (e.g., 20 messages).
- **Context Window**: Maintain a window of recent messages (e.g., last 10).
- **Cascade Deletion**: Ensure thread deletion removes all related messages.
- **Caching**: Cache conversation contexts for performance.
- **Error Handling**: Graceful degradation, retry logic, clear user feedback, and logging.
- **Security**: Input validation, parameterized queries, access control, and privacy compliance.

## Testing Strategy

- **Unit Tests**: Cover ChatMemory and context extraction.
- **Integration Tests**: Validate full conversation lifecycle, including context retrieval and deletion.

## Monitoring and Analytics

- Track conversation length, context usage, agent distribution, performance, and error rates.
- Use enhanced logging for context operations and deletions.

## Conclusion

The TFL Underground AI Assistant provides robust conversation context management with persistent memory, intelligent summarization, efficient retrieval, and user control. The architecture is modular and production-ready, ensuring reliability and privacy for transport queries.
