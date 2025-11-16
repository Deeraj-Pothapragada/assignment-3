# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Assignment 3 for 6.S061: a multi-agent conversational system demonstrating different orchestration patterns. Built with Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, and the Google Gemini API.

The system implements two distinct multi-agent patterns:
- **Murder Mystery Mode**: Dynamic agents with isolated contexts - demonstrates flexible game orchestrator pattern
- **Strategic Sharing Mode**: Hybrid pattern with fixed agents but isolated contexts - demonstrates step-based orchestration

## Commands

### Development
```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint with Next.js ESLint
```

### Environment Setup
1. Create `.env` file in project root
2. Set `GEMINI_API_KEY=your_api_key_here` (from [Google AI Studio](https://aistudio.google.com/))
3. Restart dev server after changing `.env`

**Important**:
- `.env` is gitignored
- The model is **hardcoded** to `gemini-2.5-flash` in [lib/gemini.ts](lib/gemini.ts) (no env var used)
- For Vercel deployment, set `GEMINI_API_KEY` in Vercel Project Settings

## Architecture

### Agent Initialization Patterns

The codebase implements a single **Isolated Agent** architecture used across all game modes:

#### Isolated Agents (FLEXIBLE PATTERN)

**Base Class**: [lib/agents/IsolatedAgent.ts](lib/agents/IsolatedAgent.ts)

**Implementation**:
- **Stateful** - maintains own `conversationHistory: Content[]` array
- System prompt set via constructor: `new IsolatedAgent(name, systemPrompt)`
- `respond(instruction)` automatically adds to history
- Optional `includeReasoning` parameter for structured JSON output with reasoning
- Methods: `addToHistory()`, `getHistory()`, `clearHistory()`

**Initialization** (Dynamic at runtime):
```typescript
// Murder Mystery: Dynamic registration
playerNames.forEach(name => {
  this.registerAgent(
    name,
    isHuman ? 'human' : 'llm',
    '' // System prompt updated after role assignment
  );
});

// Strategic Sharing: Module-level singleton
let agents = {
  Genji: new IsolatedAgent('Genji', 'You are Genji...'),
  Hanzo: new IsolatedAgent('Hanzo', 'You are Hanzo...'),
  // ...
};
```

**Rigidity**:
- ✅ Agent set can be determined at runtime
- ✅ System prompts passed as constructor parameters (configurable)
- ✅ Agents can be added/removed dynamically via `registerAgent()`
- ✅ Number of agents is not fixed
- ⚠️ Strategic Sharing still uses fixed names due to module-level initialization

### Orchestrator Patterns

#### Pattern A: Game Orchestrator (Flexible)

**Base Class**: [lib/orchestrators/GameOrchestrator.ts](lib/orchestrators/GameOrchestrator.ts)

**Key Features**:
- `agents: Map<string, Agent>` - dynamic agent registry
- `registerAgent(name, type: 'llm'|'human', systemPrompt)` - runtime agent creation
- `promptAgent(name, instruction)` - prompt single agent
- `promptAgents(prompts, humanResponses?)` - parallel multi-agent prompting
- `notifyAgent(name, observation)` - add to agent history without response
- `broadcastToAgents(observation, agentNames?)` - notify multiple agents
- `interpretInput<T>(userInput, schema)` - **LLM-based fuzzy input parsing**

**Agent Types**:
- `'llm'`: `IsolatedAgent` instance with conversation history
- `'human'`: `null` instance, responses provided via `humanResponses` map

**Information Flow Control**:
```typescript
// Private message - only one agent sees it
orchestrator.notifyAgent('Alice', 'You see Bob enter your room');

// Public message - all agents see it
orchestrator.broadcastToAgents('The lights suddenly turn off', ['Alice', 'Bob']);

// Parallel prompting with human input
const responses = await orchestrator.promptAgents(
  { Alice: 'What do you do?', Bob: 'What do you do?' },
  { Finn: 'I stay home' } // Human response
);
```

**Flexibility**:
- ✅ Fully dynamic - agents can be added/removed at runtime
- ✅ Supports hybrid human-LLM agent configurations
- ✅ Fine-grained control over information visibility (isolated contexts)
- ✅ Generic `interpretInput()` with runtime JSON schema definition

#### Pattern B: Murder Mystery Orchestrator (Game-Specific)

**Implementation**: [lib/orchestrators/MurderMysteryOrchestrator.ts](lib/orchestrators/MurderMysteryOrchestrator.ts)

**Extends**: `GameOrchestrator` + game state machine

**Game State**:
```typescript
{
  phase: Phase;           // 'day-0' | 'night' | 'day' | 'game-over'
  dayNumber: number;
  roles: Map<string, Role>; // 'murderer' | 'innocent'
  alive: string[];
  dead: string[];
  murdererHadIntentLastNight: boolean;
}
```

**Key Methods**:
- `setupGame(playerNames, humanPlayerName)` - register agents, assign roles
- `resolveNight(actions)` - **deterministic** game logic (NOT LLM-based)
- `resolveVoting(votes)` - **deterministic** voting resolution
- `interpretNightAction()` / `interpretVote()` - uses `interpretInput()` for fuzzy parsing
- `checkWinCondition()` - rule-based win detection

**Dynamic System Prompt Updates**:
```typescript
// After role assignment
agent.instance!.systemPrompt = role === 'murderer'
  ? murdererPrompt  // Includes secret role info
  : innocentPrompt; // Generic innocent perspective
```

**Characteristics**:
- Combines flexible agent system with rigid game rules
- Role assignment randomized at runtime
- System prompts updated dynamically based on game state
- Game logic is rule-based, NOT LLM-determined

### Information Flow Architecture

#### Isolated Context Pattern (All Game Modes)

```
Frontend: POST /api/murder-mystery { phase: 'night', humanResponses: { Finn: 'visit Bob' } }
  ↓
Route → gameInstance.promptAgents(
  { Alice: 'Where do you go tonight?', Bob: '...', Charlie: '...' },
  { Finn: 'visit Bob' },
  includeReasoning: true
)
  ↓
GameOrchestrator: Promise.all([
  Alice.respond('Where do you go tonight?'),  // Uses Alice's isolated history
  Bob.respond('Where do you go tonight?'),    // Uses Bob's isolated history
  Charlie.respond('Where do you go tonight?') // Uses Charlie's isolated history
  // Finn: Human response returned directly
])
  ↓
← [
  { agentName: 'Alice', response: 'visit Charlie', reasoning: '...' },
  { agentName: 'Bob', response: 'stay home', reasoning: '...' },
  ...
]
  ↓
Route: Call orchestrator.resolveNight(actions) → Apply game rules
  ↓
Route: Call orchestrator.broadcastToAgents('Night summary: ...') → Update all agent histories
  ↓
← JSON response { gameState, observations }
  ↓
Frontend MultiAgentView: Parse and display in 5-column layout
```

**Key Properties**:
- ✅ Each agent maintains **separate conversation history**
- ✅ Agents see ONLY what orchestrator explicitly shows via `notifyAgent()` / `broadcastToAgents()`
- ✅ Information asymmetry - enables hidden information games
- ✅ Human player (Finn) treated as special case - no LLM, responses passed directly
- ⚠️ More complex debugging - must track each agent's isolated view

**Privacy Model**:
```typescript
// Private: Only Alice's history updated
orchestrator.notifyAgent('Alice', 'You found a clue!');

// Public: All agents' histories updated
orchestrator.broadcastToAgents('Someone screamed in the night!');

// Prompt: Gets response AND updates history
const response = await orchestrator.promptAgent('Bob', 'What did you see?');
```

### Gemini Integration

**Core Function**: [lib/gemini.ts](lib/gemini.ts) - `geminiGenerate()`

```typescript
geminiGenerate({
  contents: [{ role: 'user'|'model', parts: [{ text: string }] }],
  systemPrompt?: string,  // Optional persona
  config?: {
    responseMimeType: 'application/json',  // For structured output
    responseSchema: { type: 'OBJECT', properties: {...} }
  }
})
```

**Configuration**:
- Model: **Hardcoded** to `gemini-2.5-flash` (env var `GEMINI_MODEL` is NOT used)
- API Key: `process.env.GEMINI_API_KEY`
- Supports both text and JSON structured output modes

**Message Format Conversion**:
```typescript
// Frontend format (Next.js convention)
[{ role: 'user'|'assistant', content: string }]

// Gemini format (internal API)
[{ role: 'user'|'model', parts: [{ text: string }] }]

// Conversion in API routes:
const geminiContents = messages.map(msg => ({
  role: msg.role === 'assistant' ? 'model' : msg.role,
  parts: [{ text: msg.content }]
}));
```

### Frontend Architecture

**Routes**:
- [app/api/murder-game/route.ts](app/api/murder-game/route.ts) - Murder Mystery (isolated context)
- [app/api/strategic-sharing-step/route.ts](app/api/strategic-sharing-step/route.ts) - Strategic Sharing (step-based)

**Components**:
- [app/page.tsx](app/page.tsx) - Main UI with mode toggle
- [components/MultiAgentView.tsx](components/MultiAgentView.tsx) - 5-column layout for Murder Mystery

**State Management**:
- Frontend: React `useState` hooks (no global state)
- Backend Murder Mystery: Module-level `gameInstance` singleton
- Backend Strategic Sharing: Module-level `agents` and `gameState` closures

### TypeScript Configuration

- Path alias: `@/*` maps to root directory
- Module resolution: `bundler` (Next.js default)
- Target: ES2017
- Strict mode enabled

## Implementation Guidelines

### Adding New Agents

#### For Game Orchestrator Pattern:

**No code changes needed!** Simply register at runtime:

```typescript
// In your game setup
orchestrator.registerAgent('NewPlayer', 'llm', 'You are NewPlayer...');

// Or dynamically based on user input
playerNames.forEach(name => {
  orchestrator.registerAgent(name, 'llm', generatePrompt(name));
});
```

### Creating Custom Orchestrators

```typescript
import { GameOrchestrator } from '@/lib/orchestrators/GameOrchestrator';

class MyGameOrchestrator extends GameOrchestrator {
  private gameState: MyGameState;

  async setupGame(players: string[]) {
    players.forEach(name => {
      this.registerAgent(name, 'llm', this.generatePrompt(name));
    });
  }

  async handleTurn(humanResponses: Record<string, string>) {
    // 1. Prompt all agents in parallel
    const responses = await this.promptAgents(
      { player1: 'What do you do?', player2: 'What do you do?' },
      humanResponses,
      true  // includeReasoning
    );

    // 2. Apply game logic (deterministic)
    const result = this.resolveActions(responses);

    // 3. Broadcast observations to update agent histories
    this.broadcastToAgents(result.publicInfo);
    result.privateInfo.forEach(({ player, info }) => {
      this.notifyAgent(player, info);
    });

    return result;
  }

  private resolveActions(responses: AgentResponse[]) {
    // Deterministic game rules - NOT LLM-based
    // Return game state updates
  }
}
```

### Gemini API Patterns

**Text Generation**:
```typescript
const result = await geminiGenerate({
  contents: [
    { role: 'user', parts: [{ text: 'Hello!' }] }
  ],
  systemPrompt: "You are a helpful assistant"
});
console.log(result.text); // "Hi there! How can I help?"
```

**Structured JSON Output**:
```typescript
const schema = {
  type: 'OBJECT',
  properties: {
    decision: { type: 'STRING', enum: ['option1', 'option2'] },
    confidence: { type: 'NUMBER' },
    reasoning: { type: 'STRING' }
  },
  required: ['decision']
};

const result = await geminiGenerate({
  contents: [...],
  systemPrompt: "Analyze the situation and decide...",
  config: {
    responseMimeType: 'application/json',
    responseSchema: schema
  }
});

const parsed = JSON.parse(result.text);
// { decision: 'option1', confidence: 0.8, reasoning: '...' }
```

**Isolated Agent with History**:
```typescript
const agent = new IsolatedAgent('Alice', 'You are Alice...');

// First turn
const response1 = await agent.respond('What is your name?');
// agent.conversationHistory now has user message + response

// Second turn - agent remembers previous conversation
const response2 = await agent.respond('What did I just ask you?');
// Agent can reference previous question

// Manual history manipulation
agent.addToHistory([
  { role: 'user', parts: [{ text: 'Secret information' }] }
]);
```

### UI Components

Uses Shadcn UI components ([components/ui/](components/ui/)):
- `Button`, `Input`, `Card` imported from `@/components/ui/*`
- Tailwind CSS for styling
- Components are client-side (`'use client'` directive)

### Key Design Principles

1. **Isolated Contexts**: All agents use `IsolatedAgent` with separate conversation histories
2. **LLM vs Deterministic Logic**: Use LLMs for selection/generation, deterministic code for game rules
3. **Privacy Control**: Use `notifyAgent()` for private info, `broadcastToAgents()` for public info
4. **Parallel Processing**: Use `promptAgents()` with `Promise.all()` for simultaneous agent responses
5. **Human Integration**: Register human agents as `'human'` type, provide responses via `humanResponses` map

## Project Context

- **Course**: MIT 6.S061
- **Assignment**: A3 - Multi-agent Interaction
- **Goal**: Demonstrate multiple orchestration patterns with isolated agent contexts (dynamic vs fixed initialization)
- **Deployment**: Vercel (set `GEMINI_API_KEY` in project settings)

## Game Modes

### Murder Mystery Mode
4-player social deduction game with isolated agent contexts. Full rules in [GAME_RULES.md](GAME_RULES.md):
- Roles: 1 Murderer, 3 Innocents
- Phases: Day 0 → Night (actions) → Day (discussion + voting) → repeat
- Night actions: Stay home or visit another player
- Killing: 2 people at location + murderer with intent = kill; 3+ people = safe
- Win: Innocents hang murderer OR murderer kills all innocents

Implementation: [lib/orchestrators/MurderMysteryOrchestrator.ts](lib/orchestrators/MurderMysteryOrchestrator.ts)

### Strategic Sharing Mode
Multi-step negotiation game with 4 agents (Finn, Genji, Hanzo, Kendrick) sharing information strategically. See [app/api/strategic-sharing-step/route.ts](app/api/strategic-sharing-step/route.ts).

## Quick Reference: Pattern Comparison

| Feature | Murder Mystery | Strategic Sharing |
|---------|----------------|-------------------|
| **Agent Base Class** | `IsolatedAgent` | `IsolatedAgent` |
| **Orchestrator** | `MurderMysteryOrchestrator` (extends `GameOrchestrator`) | Custom route logic |
| **Agent Initialization** | Dynamic (`registerAgent()`) | Fixed (module-level) |
| **Number of Agents** | 4 (configurable) | 4 (Finn, Genji, Hanzo, Kendrick) |
| **Context Pattern** | Isolated - each agent has separate history | Isolated - each agent has separate history |
| **State Management** | Stateful (module singleton) | Stateful (module closures) |
| **Human Integration** | Yes (Finn player) | Yes (Finn player) |
| **Agent Selection** | N/A (all agents respond) | N/A (step-based sequencing) |
| **Information Flow** | Orchestrator controls via `notifyAgent()` / `broadcastToAgents()` | Custom per-step logic |
| **Flexibility** | Flexible - runtime agent registration | Semi-rigid - fixed names, configurable prompts |
| **Use Case** | Hidden information games | Structured negotiation |
