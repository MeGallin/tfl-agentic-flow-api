# TFL Underground AI Assistant - Claude Memory

## Project Overview
This is an advanced multi-agent conversational AI system for London Underground transport information using **LangGraph.js**. The system implements enterprise-grade workflow patterns with StateGraph execution, human-in-the-loop integration, and real-time streaming capabilities.

## Architecture & Patterns
- **LangGraph StateGraph Workflow**: Complete workflow orchestration with conditional routing
- **Multi-Agent System**: Router agent directs queries to 13 specialized line agents
- **Human-in-the-Loop**: User confirmation workflows for complex journey planning
- **Multi-Agent Collaboration**: Agents work together on complex multi-line queries
- **Streaming Responses**: Real-time workflow progress with Server-Sent Events (SSE)
- **Enhanced Memory**: AI-powered conversation summarization with GPT-4o-mini
- **Agent Structure**: Each line has dedicated Agent, Tools, and Prompt classes
- **Shared Components**: Common LLM instance, memory system, and utilities
- **Real-time Data**: TFL API integration with error handling and fallbacks
- **Frontend**: React client with local Whisper-based speech recognition

## LangGraph Workflow Implementation

### StateGraph Architecture
The system uses LangGraph's StateGraph pattern with the following workflow nodes:
- `input_validation` → Validates and sanitizes user queries
- `route_query` → RouterAgent determines appropriate TFL line agent
- `process_agent` → Specialized agent processes query with TFL API data
- `check_confirmation` → Evaluates if user confirmation is required
- `await_confirmation` → Human-in-the-loop confirmation dialog
- `fallback_handler` → Error recovery and fallback responses
- `save_memory` → Enhanced memory with conversation summarization
- `finalize_response` → Response preparation and formatting

### Workflow State Management
```javascript
// GraphState channels for workflow execution
{
  query: null,                    // User query string
  threadId: null,                 // Conversation thread identifier
  selectedAgent: null,            // Chosen TFL line agent
  agentResponse: null,            // Agent processing result
  confidence: null,               // Response confidence level
  tflData: null,                  // Real-time TFL API data
  conversationHistory: null,      // Chat context and history
  requiresConfirmation: null,     // Human-in-the-loop flag
  userConfirmation: null,         // User confirmation response
  fallbackRequired: null,         // Error fallback indicator
  streamingEnabled: null,         // Real-time streaming mode
  metadata: null                  // Workflow execution metadata
}
```

## Advanced Features

### Human-in-the-Loop Integration
- **Confirmation Workflows**: Complex journey planning triggers user confirmation
- **Interactive Dialogs**: React-based confirmation UI with journey metadata
- **Conditional Execution**: Workflow pauses for user input when required
- **Smart Triggers**: Automatic detection of confirmation-worthy queries

### Multi-Agent Collaboration
- **Agent Coordination**: Multiple agents work together on complex queries
- **Response Synthesis**: Combines outputs from multiple TFL line agents
- **Conflict Resolution**: Handles conflicting information between agents
- **Collaborative Workflows**: Special workflow paths for multi-agent execution

### Streaming Responses & Real-Time Updates
- **Server-Sent Events**: Live workflow progress streaming to frontend
- **Step-by-Step Visualization**: Real-time display of workflow execution
- **Progressive Response Display**: Partial responses during processing
- **Automatic Detection**: Smart activation for complex queries (journey planning, multi-line)
- **Manual Override**: User can force streaming mode with ⚡ button

### Enhanced Memory System
- **AI-Powered Summarization**: GPT-4o-mini automatically summarizes conversations
- **Intelligent Triggers**: Summarization activates every 20 messages
- **Topic Extraction**: Automatic identification of key conversation topics
- **Sentiment Analysis**: Overall conversation sentiment tracking
- **Structured Storage**: Enhanced database schema with summaries table

## Code Style & Standards
- Use CommonJS modules (`require`/`module.exports`)
- No TypeScript - pure JavaScript ES6+
- 2-space indentation
- Use `const` for immutable values, `let` for variables
- Prefer template literals over string concatenation
- Use async/await over Promises
- Add console.log statements for debugging agent flows
- No inline comments unless absolutely necessary
- **No LangSmith Tracing**: All tracing dependencies removed for performance

## File Structure Conventions
```
src/
├── agents/           # Line-specific agents (e.g., circleAgent.js)
├── tools/           # TFL API integration + LangGraph tools
│   └── langGraphTools.js    # DynamicTool wrappers for TFL API
├── prompts/         # System prompts (e.g., circlePrompt.js)
├── memory/          # Enhanced memory system
│   ├── chatMemory.js        # Base SQLite persistence
│   └── enhancedMemory.js    # AI-powered summarization
├── workflows/       # LangGraph workflow definitions
│   ├── tflWorkflow.js       # Main StateGraph workflow
│   └── collaborativeWorkflow.js # Multi-agent collaboration
├── utils/           # Shared utilities (GraphState, StartNode)
└── app.js          # Main TFLUndergroundApp class
```

## Agent Development Pattern
Each Underground line follows this enhanced pattern:
1. **Agent Class**: Processes queries, handles arrivals, calls LLM
2. **Tools Class**: TFL API integration with proper error handling
3. **Prompt Function**: System prompt with current time and line info
4. **LangGraph Integration**: DynamicTool wrappers for workflow compatibility
5. **Collaboration Support**: Multi-agent workflow participation

## Time & Date Handling
- **ALWAYS** use `DateTimeTools.getTFLTimestamp()` for all `lastUpdated` fields
- **ALWAYS** import `todays_date_time` from `../tools/dateTimeTools` in agents
- **NEVER** use `new Date().toISOString()` - use centralized time functions
- London timezone is automatically handled (GMT/BST transitions)

## Commands
- `npm run dev` - Start development server with nodemon
- `npm run lint` - Run ESLint on src/ directory  
- `npm run format` - Format code with Prettier
- `npm start` - Start production server

## Environment Variables
```bash
# Required
OPENAI_API_KEY=sk-proj-...
TFL_API_BASE_URL=https://api.tfl.gov.uk

# Server Configuration
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database Configuration
DATABASE_PATH=./database/chatHistory.sqlite

# LangSmith Tracing - DISABLED
LANGSMITH_TRACING=false
LANGCHAIN_TRACING_V2=false
LANGCHAIN_CALLBACKS_BACKGROUND=false
```

## Tracing & Observability
- **LangSmith Integration**: Removed for performance optimization
- **Console Logging**: Comprehensive workflow step logging
- **Debug Output**: Detailed agent processing information
- **Error Tracking**: Structured error handling and reporting

## Underground Lines Supported
- Circle (Yellow #FFD329)
- Bakerloo (Brown #B36305) 
- District (Green #00782A)
- Central (Red #E32017)
- Northern (Black #000000)
- Piccadilly (Dark Blue #003688)
- Victoria (Light Blue #0098D4)
- Jubilee (Grey #A0A5A9)
- Metropolitan (Magenta #9B0056)
- Hammersmith & City (Pink #F3A9BB)
- Waterloo & City (Turquoise #95CDBA)
- Elizabeth (Purple #6950A1)

## Error Handling
- Always provide fallback responses when TFL API fails
- Include error messages in return objects
- Use try-catch blocks around all API calls
- Log errors with appropriate agent prefixes (e.g., `[CircleAgent]`)
- **Graceful Degradation**: Streaming falls back to regular mode on errors
- **User Experience**: Never show raw errors to users

## Testing & Debugging
- Create test files in project root (clean up after testing)
- Use console.log with agent prefixes for tracing
- Test both successful and error scenarios
- Verify London time display is correct
- **Workflow Testing**: Test all StateGraph execution paths
- **Streaming Testing**: Verify SSE connections and data flow
- **Memory Testing**: Validate conversation summarization triggers

## Database Schema

### Core Tables
- **conversations**: Thread management and metadata
- **messages**: Individual chat messages with agent attribution
- **conversation_summaries**: AI-generated conversation summaries

### Enhanced Memory Schema
```sql
CREATE TABLE conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  start_timestamp TEXT NOT NULL,
  end_timestamp TEXT NOT NULL,
  important_topics TEXT,  -- JSON array of key topics
  sentiment TEXT,         -- overall conversation sentiment
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Key Classes

### Backend Classes
- `TFLUndergroundApp` - Main orchestrator with LangGraph integration
- `TFLWorkflow` - StateGraph workflow implementation
- `CollaborativeWorkflow` - Multi-agent coordination
- `RouterAgent` - Query routing logic with LangGraph tools
- `EnhancedMemory` - AI-powered conversation summarization
- `ChatMemory` - Base SQLite persistence layer
- `DateTimeTools` - London timezone utilities

### Frontend Classes
- `ConversationContext` - React state management
- `ChatInput` - Message input with streaming mode toggle
- `ChatMessages` - Message display with typing indicators
- `ConfirmationDialog` - Human-in-the-loop UI component
- `StreamingIndicator` - Real-time workflow progress display
- `AgentIndicator` - Active TFL line agent display

## API Integration Notes
- TFL API has rate limits - implement timeouts
- Station searches require fuzzy matching
- Arrival times in seconds, convert to minutes for display
- Filter API responses to prevent token overflow
- Handle both hub stations and individual platforms
- **LangGraph Tools**: All TFL API calls wrapped in DynamicTool format
- **Error Resilience**: Comprehensive fallback mechanisms

## Frontend Integration

### Advanced UI Components
- **Speech Recognition**: Local Whisper-Web processing (no server requests)
- **Streaming Mode Toggle**: ⚡ button for real-time workflow visualization
- **Agent Typing Indicators**: "Assistant is typing" with bouncing dots
- **Confirmation Dialogs**: Interactive journey approval workflows
- **New Chat Functionality**: Complete conversation clearing and reset
- **Progress Visualization**: Step-by-step workflow execution display

### State Management
- **Context-Based**: React Context for global state management
- **Loading States**: Comprehensive UI loading and typing indicators
- **Error Boundaries**: Graceful error handling and user feedback
- **Local Storage**: Conversation persistence across browser sessions

### Technology Stack
- **React**: Modern functional components with hooks
- **Whisper-Web**: @xenova/transformers for local speech processing
- **Lucide Icons**: Consistent icon system throughout UI
- **Tailwind CSS**: Responsive design with mobile-first approach
- **Server-Sent Events**: Real-time streaming communication

## Performance Optimizations
- **No LangSmith Overhead**: Removed all tracing for faster execution
- **Efficient Memory Usage**: Smart conversation summarization triggers
- **Streaming Fallbacks**: Graceful degradation when streaming unavailable
- **API Rate Limiting**: Intelligent TFL API usage with caching
- **Frontend Optimizations**: Lazy loading and component optimization

## Security & Privacy
- **Local Speech Processing**: No audio data sent to servers
- **Environment Variables**: Secure API key management
- **CORS Configuration**: Proper cross-origin request handling
- **Input Validation**: Comprehensive query sanitization
- **Error Information**: No sensitive data exposed in error messages

## Workflow Execution Examples

### Simple Query Flow
1. User: "Circle line status"
2. `input_validation` → validates query
3. `route_query` → selects Circle agent
4. `process_agent` → fetches TFL data, generates response
5. `save_memory` → stores conversation
6. `finalize_response` → returns formatted answer

### Complex Journey Planning Flow
1. User: "Plan journey from North Greenwich to Edgware Road"
2. `input_validation` → validates complex journey query
3. `route_query` → detects multi-line journey requirement
4. `process_agent` → collaborative workflow with multiple agents
5. `check_confirmation` → determines user confirmation needed
6. `await_confirmation` → shows confirmation dialog to user
7. User confirms → workflow continues
8. `save_memory` → enhanced memory with journey details
9. `finalize_response` → comprehensive journey plan

## Recent Updates & Fixes
- ✅ **LangSmith Tracing Removed**: Complete removal for performance
- ✅ **UI Loading States Fixed**: Proper state management in ChatInput
- ✅ **Agent Typing Indicators**: Restored "Assistant is typing" functionality  
- ✅ **New Chat Button**: Re-enabled conversation clearing
- ✅ **Streaming Workflow**: Fixed method calls and error handling
- ✅ **Duplicate Messages**: Resolved message duplication in streaming mode
- ✅ **Enhanced Memory**: Temporary summarization disable for stability
- ✅ **Human-in-the-Loop**: Complete confirmation workflow implementation