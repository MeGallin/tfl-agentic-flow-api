# TFL Underground AI Assistant - Project Requirements

## Table of Contents

1. [Project Overview](#project-overview)
2. [Stakeholders](#stakeholders)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Technical Requirements](#technical-requirements)
6. [User Stories](#user-stories)
7. [System Constraints](#system-constraints)
8. [Acceptance Criteria](#acceptance-criteria)
9. [Risk Assessment](#risk-assessment)
10. [Success Metrics](#success-metrics)

## Project Overview

### Project Purpose

The TFL Underground AI Assistant is an intelligent conversational system designed to provide London Underground commuters with real-time transport information through specialized AI agents. The system routes user queries to line-specific agents (Circle, Bakerloo, and District lines) using advanced LangGraph.js orchestration and delivers personalized transport assistance.

### Project Scope

**In Scope:**

- Multi-agent AI conversation system with intelligent routing
- Real-time TFL API integration for live transport data
- Circle, Bakerloo, and District line specialization
- Web-based React frontend with responsive design
- Conversation persistence and context management
- Journey planning and station information services
- Service status monitoring and disruption alerts

**Out of Scope:**

- Mobile native applications (Phase 1)
- Other London Underground lines beyond Circle, Bakerloo, District
- Bus, DLR, or other TFL transport modes
- Payment integration or ticket purchasing
- User authentication and personal accounts
- Multi-language support beyond English

### Project Goals

1. **Enhance Commuter Experience**: Provide instant, accurate transport information through natural language interaction
2. **Demonstrate AI Innovation**: Showcase advanced multi-agent AI systems in real-world transport applications
3. **Improve Information Accessibility**: Make TFL data more accessible through conversational interfaces
4. **Reduce Information Search Time**: Enable quick access to transport data without navigating complex websites

## Stakeholders

### Primary Stakeholders

1. **London Underground Commuters**

   - Role: End users of the system
   - Interest: Quick, accurate transport information
   - Influence: High (user adoption determines success)

2. **Project Development Team**

   - Role: System designers, developers, and maintainers
   - Interest: Successful project delivery and technical excellence
   - Influence: High (control implementation)

3. **TFL (Transport for London)**
   - Role: Data provider and potential partner
   - Interest: Improved passenger experience and data utilization
   - Influence: Medium (API access and data policies)

### Secondary Stakeholders

1. **System Administrators**

   - Role: Infrastructure management and monitoring
   - Interest: System reliability and performance
   - Influence: Medium

2. **Data Analysts**
   - Role: Usage analytics and system optimization
   - Interest: Data insights and user behavior patterns
   - Influence: Low to Medium

## Functional Requirements

### Core Functionality

#### FR-001: Multi-Agent Query Routing

**Priority**: Critical
**Description**: The system must intelligently route user queries to appropriate line-specific AI agents based on content analysis.

**Requirements**:

- Analyze incoming natural language queries for line-specific keywords
- Route to Circle, Bakerloo, or District line agents with confidence scoring
- Provide routing reasoning for transparency
- Handle ambiguous queries with fallback mechanisms
- Support manual agent switching by users

#### FR-002: Real-Time Transport Data Integration

**Priority**: Critical
**Description**: The system must fetch and display live TFL transport data for supported lines.

**Requirements**:

- Integrate with TFL API for real-time line status
- Display current service conditions (Good Service, Minor Delays, Severe Delays, Suspended)
- Show station information and facilities
- Provide live arrival times when available
- Handle API rate limiting and error conditions gracefully

#### FR-003: Conversational Interface

**Priority**: Critical
**Description**: The system must provide a natural language chat interface for user interactions.

**Requirements**:

- Accept text input in natural language
- Provide context-aware responses
- Maintain conversation history within sessions
- Support follow-up questions and clarifications
- Display agent identification and confidence scores

#### FR-004: Journey Planning

**Priority**: High
**Description**: The system must assist users in planning journeys on supported lines.

**Requirements**:

- Accept origin and destination inputs
- Provide route suggestions using supported lines
- Estimate journey times when possible
- Suggest alternative routes during disruptions
- Integrate with TFL journey planning APIs

#### FR-005: Service Status Monitoring

**Priority**: High
**Description**: The system must monitor and report service status for Circle, Bakerloo, and District lines.

**Requirements**:

- Display current line status with visual indicators
- Show disruption details and expected resolution times
- Provide alternative travel suggestions during service issues
- Alert users to relevant service changes
- Archive historical status information

### Data Management

#### FR-006: Conversation Persistence

**Priority**: Medium
**Description**: The system must store and retrieve conversation history for user sessions.

**Requirements**:

- Generate unique thread IDs for conversation sessions
- Store message history with timestamps and agent information
- Retrieve conversation context for follow-up queries
- Support conversation deletion and privacy controls
- Implement data retention policies

#### FR-007: User Context Management

**Priority**: Medium
**Description**: The system must maintain user context to provide personalized responses.

**Requirements**:

- Track user preferences and frequent queries
- Remember recently discussed stations and routes
- Adapt responses based on user behavior patterns
- Respect user privacy and data protection requirements

### Integration Requirements

#### FR-008: TFL API Integration

**Priority**: Critical
**Description**: The system must integrate with official TFL APIs for transport data.

**Requirements**:

- Connect to TFL Unified API endpoints
- Handle authentication if required
- Implement rate limiting compliance
- Cache frequently requested data
- Provide fallback for API unavailability

#### FR-009: WebSocket Real-Time Updates

**Priority**: Medium
**Description**: The system should provide real-time updates through WebSocket connections.

**Requirements**:

- Establish persistent WebSocket connections
- Push live service updates to connected clients
- Handle connection failures and reconnection
- Optimize bandwidth usage for mobile users

## Non-Functional Requirements

### Performance Requirements

#### NFR-001: Response Time

**Priority**: High
**Description**: The system must provide fast response times for user queries.

**Requirements**:

- Chat responses within 3 seconds for 95% of queries
- TFL data retrieval within 2 seconds
- Frontend page load time under 2 seconds
- Agent routing decision within 500ms

#### NFR-002: Throughput

**Priority**: Medium
**Description**: The system must handle concurrent users efficiently.

**Requirements**:

- Support minimum 100 concurrent users
- Handle 1000 requests per hour per user
- Maintain performance under peak load conditions
- Scale horizontally as needed

#### NFR-003: Availability

**Priority**: High
**Description**: The system must maintain high availability for users.

**Requirements**:

- 99.5% uptime during business hours (5 AM - 11 PM)
- Graceful degradation during TFL API outages
- Automatic failover for critical components
- Maximum 5 minutes recovery time from failures

### Usability Requirements

#### NFR-004: User Experience

**Priority**: High
**Description**: The system must provide an intuitive and accessible user interface.

**Requirements**:

- Mobile-responsive design for all screen sizes
- WCAG 2.1 AA accessibility compliance
- Maximum 3 clicks to access any feature
- Clear visual feedback for user actions
- Consistent TFL branding and color schemes

#### NFR-005: Language and Communication

**Priority**: Medium
**Description**: The system must communicate clearly and naturally with users.

**Requirements**:

- Use plain English suitable for all education levels
- Provide clear error messages and guidance
- Offer help and usage instructions
- Support transport terminology and abbreviations
- Maintain professional and helpful tone

### Security Requirements

#### NFR-006: Data Protection

**Priority**: High
**Description**: The system must protect user data and privacy.

**Requirements**:

- Encrypt data transmission using HTTPS/WSS
- Implement input validation and sanitization
- Store minimal user data with consent
- Comply with GDPR and UK data protection laws
- Regular security audits and updates

#### NFR-007: API Security

**Priority**: Medium
**Description**: The system must securely integrate with external APIs.

**Requirements**:

- Secure API key management
- Rate limiting and abuse prevention
- Input validation for all external data
- Monitoring for suspicious activity
- Backup authentication methods

### Reliability Requirements

#### NFR-008: Error Handling

**Priority**: High
**Description**: The system must handle errors gracefully and provide meaningful feedback.

**Requirements**:

- Comprehensive error logging and monitoring
- User-friendly error messages
- Automatic retry mechanisms for transient failures
- Fallback responses when services are unavailable
- Error recovery without data loss

#### NFR-009: Data Accuracy

**Priority**: High
**Description**: The system must provide accurate and up-to-date information.

**Requirements**:

- Real-time data synchronization with TFL systems
- Data validation and consistency checks
- Clear timestamps for all transport information
- Disclaimer for estimated or predicted data
- Regular data quality monitoring

## Technical Requirements

### Backend Technical Requirements

#### TR-001: Backend Technology Stack

**Priority**: Critical
**Requirements**:

- Node.js 18+ runtime environment
- Express.js 4.21+ web framework
- LangChain.js with LangGraph.js for AI orchestration
- SQLite database for conversation storage
- OpenAI GPT-4o-mini for language model
- RESTful API architecture

#### TR-002: AI and ML Requirements

**Priority**: Critical
**Requirements**:

- Multi-agent system with shared LLM pattern
- Intelligent query routing with confidence scoring
- Context-aware conversation management
- Prompt engineering for transport domain
- Agent specialization for tube lines

### Frontend Technical Requirements

#### TR-003: Frontend Technology Stack

**Priority**: Critical
**Requirements**:

- React 18.3+ with JavaScript
- Vite 5.4+ build tool
- Tailwind CSS for styling
- Axios for HTTP communication
- React Context API for state management
- Jest and React Testing Library for testing

#### TR-004: Browser Compatibility

**Priority**: High
**Requirements**:

- Support for Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Progressive Web App (PWA) capabilities
- Responsive design for mobile devices
- Accessibility features for screen readers
- Offline functionality for basic features

### Infrastructure Requirements

#### TR-005: Hosting and Deployment

**Priority**: High
**Requirements**:

- Cloud hosting with auto-scaling capabilities
- Container-based deployment (Docker)
- CI/CD pipeline for automated deployment
- Environment separation (development, staging, production)
- Monitoring and logging infrastructure

#### TR-006: Database Requirements

**Priority**: Medium
**Requirements**:

- SQLite for development and small-scale deployment
- Migration path to PostgreSQL for production scaling
- Regular backup and recovery procedures
- Data retention and archival policies
- Database performance monitoring

## User Stories

### Epic 1: Basic Transport Information

#### US-001: Get Line Status

**As a** London commuter
**I want to** ask about the current status of my tube line
**So that** I can plan my journey accordingly

**Acceptance Criteria:**

- User can ask "What's the status of the Circle line?" in natural language
- System routes query to Circle line agent
- Response includes current service status and any disruptions
- Response time is under 3 seconds
- Agent identification is clearly displayed

#### US-002: Find Station Information

**As a** tube user
**I want to** get information about a specific station
**So that** I can understand facilities and accessibility options

**Acceptance Criteria:**

- User can ask about station facilities
- System provides step-free access information
- Station opening hours are displayed when available
- Platform information is included where relevant

### Epic 2: Journey Planning

#### US-003: Plan Simple Journey

**As a** commuter
**I want to** plan a journey between two stations on supported lines
**So that** I can understand my travel options

**Acceptance Criteria:**

- User can specify origin and destination
- System suggests routes using Circle, Bakerloo, or District lines
- Journey time estimates are provided
- Alternative routes are suggested when available

#### US-004: Get Disruption Alternatives

**As a** traveler
**I want to** receive alternative route suggestions during service disruptions
**So that** I can still reach my destination

**Acceptance Criteria:**

- System detects service disruptions affecting planned route
- Alternative routes are automatically suggested
- Expected delays are communicated clearly
- Updates are provided as situation changes

### Epic 3: Real-Time Updates

#### US-005: Receive Live Updates

**As a** frequent commuter
**I want to** receive real-time updates about my regular routes
**So that** I can adjust my travel plans immediately

**Acceptance Criteria:**

- System provides live arrival times when available
- Service status changes are communicated immediately
- Notifications are relevant to user's interests
- Update frequency balances accuracy with performance

### Epic 4: Conversation Management

#### US-006: Continue Previous Conversation

**As a** user
**I want to** continue my previous conversation with the system
**So that** I don't have to repeat context

**Acceptance Criteria:**

- Conversation history is maintained within session
- Context from previous queries influences responses
- User can reference earlier discussion points
- Thread continuity is preserved across page refreshes

## System Constraints

### Technical Constraints

1. **TFL API Limitations**

   - Rate limits: 500 requests per hour for free tier
   - Data availability varies by line and time
   - Real-time data may have delays or gaps
   - API endpoints subject to TFL maintenance windows

2. **OpenAI API Constraints**

   - Token limits per request and per month
   - Rate limiting based on subscription tier
   - Cost implications for high-volume usage
   - Model availability and version dependencies

3. **Browser Limitations**
   - WebSocket connection limits
   - Local storage capacity constraints
   - Cross-origin resource sharing restrictions
   - JavaScript execution limits on mobile devices

### Business Constraints

1. **Budget Limitations**

   - OpenAI API costs must remain within budget
   - Infrastructure costs should scale linearly with usage
   - Development time is limited to project timeline
   - Third-party service dependencies introduce ongoing costs

2. **Legal and Compliance**
   - Must comply with TFL API terms of service
   - GDPR compliance for user data handling
   - Accessibility requirements under UK law
   - Intellectual property considerations for TFL data

### Operational Constraints

1. **Maintenance Windows**

   - TFL API may be unavailable during maintenance
   - System updates must minimize user disruption
   - Backup procedures must be regularly tested
   - Support coverage during operational hours

2. **Scalability Limitations**
   - SQLite database limits for high-concurrency scenarios
   - Single-server deployment constraints
   - WebSocket connection scaling challenges
   - Memory usage optimization requirements

## Acceptance Criteria

### System-Wide Acceptance Criteria

#### AC-001: Core Functionality

- [ ] All three agents (Circle, Bakerloo, District) respond to appropriate queries
- [ ] Query routing achieves >85% accuracy in agent selection
- [ ] Real-time TFL data is successfully retrieved and displayed
- [ ] Conversation history is properly maintained and retrievable
- [ ] Error handling provides meaningful feedback to users

#### AC-002: Performance Standards

- [ ] 95% of chat responses delivered within 3 seconds
- [ ] Frontend loads completely within 2 seconds
- [ ] System supports 100 concurrent users without degradation
- [ ] Database queries execute within 500ms average
- [ ] Memory usage remains stable under continuous operation

#### AC-003: User Experience

- [ ] Interface is fully responsive on mobile, tablet, and desktop
- [ ] All interactive elements are keyboard accessible
- [ ] Screen reader compatibility verified with testing
- [ ] Visual design follows TFL brand guidelines
- [ ] Error messages are clear and actionable

#### AC-004: Integration Requirements

- [ ] TFL API integration handles all supported endpoints
- [ ] WebSocket connections maintain stability for 30+ minutes
- [ ] OpenAI API integration provides consistent response quality
- [ ] Database operations maintain ACID compliance
- [ ] All external API failures have appropriate fallback behavior

## Risk Assessment

### High-Risk Items

#### R-001: TFL API Dependency

**Risk Level**: High
**Description**: System heavily dependent on TFL API availability and reliability
**Impact**: Core functionality unavailable during TFL API outages
**Mitigation**: Implement caching, fallback data sources, and graceful degradation
**Contingency**: Offline mode with cached data and clear service status communication

#### R-002: OpenAI API Costs

**Risk Level**: High
**Description**: Unexpected high usage could lead to significant API costs
**Impact**: Budget overrun or service suspension
**Mitigation**: Implement usage monitoring, rate limiting, and cost alerts
**Contingency**: Request optimization and potential model downgrade

#### R-003: Agent Routing Accuracy

**Risk Level**: Medium
**Description**: Poor routing decisions could frustrate users and reduce system value
**Impact**: User dissatisfaction and reduced adoption
**Mitigation**: Extensive testing, user feedback collection, and continuous improvement
**Contingency**: Manual agent selection override and routing confidence display

### Medium-Risk Items

#### R-004: Performance Scalability

**Risk Level**: Medium
**Description**: System may not scale adequately under high user load
**Impact**: Slow response times and poor user experience
**Mitigation**: Performance testing, optimization, and infrastructure scaling plans
**Contingency**: Load balancing and database optimization

#### R-005: Data Privacy Compliance

**Risk Level**: Medium
**Description**: Potential GDPR or privacy regulation violations
**Impact**: Legal issues and user trust damage
**Mitigation**: Privacy-by-design approach and regular compliance audits
**Contingency**: Immediate data handling review and policy updates

### Low-Risk Items

#### R-006: Browser Compatibility

**Risk Level**: Low
**Description**: Some users may experience compatibility issues
**Impact**: Limited user base access
**Mitigation**: Progressive enhancement and polyfill implementation
**Contingency**: Graceful degradation and alternative access methods

## Success Metrics

### User Engagement Metrics

1. **Daily Active Users (DAU)**

   - Target: 500+ users within 3 months of launch
   - Measurement: Unique users per day using the system

2. **Session Duration**

   - Target: Average 5+ minutes per session
   - Measurement: Time from first query to session end

3. **Query Success Rate**

   - Target: 90% of queries receive satisfactory responses
   - Measurement: User satisfaction feedback and completion rates

4. **Return User Rate**
   - Target: 40% of users return within 7 days
   - Measurement: User retention analytics

### Technical Performance Metrics

1. **System Availability**

   - Target: 99.5% uptime during operational hours
   - Measurement: Server monitoring and downtime tracking

2. **Response Time**

   - Target: 95% of responses under 3 seconds
   - Measurement: API response time monitoring

3. **Agent Routing Accuracy**

   - Target: 85% correct agent selection
   - Measurement: Manual evaluation and user feedback

4. **Error Rate**
   - Target: <2% of queries result in system errors
   - Measurement: Error logging and tracking

### Business Impact Metrics

1. **User Satisfaction**

   - Target: 4.0+ stars average rating
   - Measurement: User feedback surveys and ratings

2. **Information Accuracy**

   - Target: 95% accuracy in transport information
   - Measurement: Comparison with official TFL sources

3. **Cost Efficiency**

   - Target: Operating costs under £0.10 per user session
   - Measurement: Infrastructure and API cost tracking

4. **Feature Adoption**
   - Target: 70% of users try journey planning feature
   - Measurement: Feature usage analytics

This requirements document provides a comprehensive foundation for developing the TFL Underground AI Assistant, ensuring all stakeholder needs are addressed while maintaining technical feasibility and business viability.
