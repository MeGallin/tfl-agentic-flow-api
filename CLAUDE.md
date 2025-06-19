# TFL Underground AI Assistant - Claude Memory

## Project Overview
This is a multi-agent conversational AI system for London Underground transport information using LangGraph.js. The system routes user queries to specialized line agents and provides real-time TFL data.

## Architecture & Patterns
- **Multi-Agent System**: Router agent directs queries to 13 specialized line agents
- **LangGraph Workflow**: Uses StateGraph pattern with traceable execution
- **Agent Structure**: Each line has dedicated Agent, Tools, and Prompt classes
- **Shared Components**: Common LLM instance, memory system, and utilities
- **Real-time Data**: TFL API integration with error handling and fallbacks

## Code Style & Standards
- Use CommonJS modules (`require`/`module.exports`)
- No TypeScript - pure JavaScript ES6+
- 2-space indentation
- Use `const` for immutable values, `let` for variables
- Prefer template literals over string concatenation
- Use async/await over Promises
- Add console.log statements for debugging agent flows
- No inline comments unless absolutely necessary

## File Structure Conventions
```
src/
├── agents/           # Line-specific agents (e.g., circleAgent.js)
├── tools/           # TFL API integration tools (e.g., circleTools.js)
├── prompts/         # System prompts (e.g., circlePrompt.js)
├── memory/          # Chat history persistence
├── utils/           # Shared utilities (GraphState, StartNode)
└── app.js          # Main TFLUndergroundApp class
```

## Agent Development Pattern
Each Underground line follows this pattern:
1. **Agent Class**: Processes queries, handles arrivals, calls LLM
2. **Tools Class**: TFL API integration with proper error handling
3. **Prompt Function**: System prompt with current time and line info

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

# LangSmith Tracing
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=lsv2_pt_...
LANGCHAIN_PROJECT=TFL-Underground-AI-Assistant
```

## LangSmith Integration
- Main `processQuery` method wrapped with `traceable()`
- Agent methods use `traceable()` for observability
- Project name: "TFL-Underground-AI-Assistant"
- Metadata includes agent types and line information

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

## Testing & Debugging
- Create test files in project root (clean up after testing)
- Use console.log with agent prefixes for tracing
- Test both successful and error scenarios
- Verify London time display is correct

## Database
- SQLite database at `./database/chatHistory.sqlite`
- Conversation persistence with thread IDs
- Memory management through ChatMemory class

## Key Classes
- `TFLUndergroundApp` - Main orchestrator
- `RouterAgent` - Query routing logic  
- `GraphState` - Workflow state management
- `ChatMemory` - Conversation persistence
- `DateTimeTools` - London timezone utilities

## API Integration Notes
- TFL API has rate limits - implement timeouts
- Station searches require fuzzy matching
- Arrival times in seconds, convert to minutes for display
- Filter API responses to prevent token overflow
- Handle both hub stations and individual platforms