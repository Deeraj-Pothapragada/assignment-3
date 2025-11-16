# Architecture Summary: Reusable Multi-Agent Game Framework

## What We Built

A **clean, reusable architecture** for multi-agent LLM games with isolated contexts and human-in-the-loop support.

### Core Innovation

**Problem**: In multi-agent games, agents need isolated contexts (can't leak information), but the orchestrator needs to intelligently interpret human input and coordinate complex game flows.

**Solution**: Separation of concerns into reusable base classes + game-specific logic.

---

## Architecture Layers

### Layer 1: IsolatedAgent (Already Existed)
**File**: `lib/agents/IsolatedAgent.ts`

- Each agent maintains its own `conversationHistory`
- Provably isolated (tested with impossible tasks)
- Supports structured JSON output with reasoning
- Works for both LLM and human agents (human = null instance)

```typescript
const agent = new IsolatedAgent('Alice', 'You are Alice...');
const { text, reasoning } = await agent.respond('Pick a number', true);
```

### Layer 2: GameOrchestrator (NEW - Reusable Base Class)
**File**: `lib/orchestrators/GameOrchestrator.ts`

**Handles ALL LLM/agent communication patterns:**

1. **Agent Registration**
   ```typescript
   orchestrator.registerAgent('Alice', 'llm', systemPrompt);
   orchestrator.registerAgent('Finn', 'human'); // No LLM needed
   ```

2. **Messaging Patterns**
   ```typescript
   // One agent
   await orchestrator.promptAgent('Alice', 'Pick a number');

   // Multiple agents, different messages
   await orchestrator.promptAgents([
     { agentName: 'Alice', message: 'You are murderer...' },
     { agentName: 'Bob', message: 'You are innocent...' }
   ], humanResponseMap);

   // Broadcast same message to all
   await orchestrator.broadcastToAgents('Night phase begins!');
   ```

3. **Smart Input Interpretation** (Fuzzy matching via LLM!)
   ```typescript
   const result = await orchestrator.interpretInput(
     'haanzo', // User typed this
     'Interpret as player name',
     { type: 'STRING' }
   );
   // result.interpreted = 'Hanzo'
   // result.reasoning = 'Appears to be typo of Hanzo'
   ```

**Key insight**: The orchestrator uses an LLM to interpret raw input. No regex, no fuzzy matching libraries - just ask the LLM "what did they mean?"

### Layer 3: Game-Specific Orchestrator (NEW - Murder Mystery Example)
**File**: `lib/orchestrators/MurderMysteryOrchestrator.ts`

**Extends GameOrchestrator with pure game logic:**

- Role assignment
- Night resolution (locations → kills → observations)
- Vote counting
- Win condition checking

**NO LLM calls in game logic** - just pure TypeScript:

```typescript
resolveNight(actions: NightAction[]): {
  deaths: string[];
  observations: Map<string, string[]>;
  murdererBlocked: boolean;
} {
  // Pure logic - no LLM
  // Build locations, check kill rules, return results
}
```

Only 2 methods use LLM (via base class):
- `interpretNightAction()` - "i visit bob" → `{ action: 'visit', target: 'Bob' }`
- `interpretVote()` - "bobby" → `{ vote: 'Bob' }`

---

## How It All Works Together

### Example: Murder Mystery Night Phase

```typescript
// 1. Orchestrator asks all agents for night actions
const nightPrompts = aliveAgents.map(name => ({
  agentName: name,
  message: `Choose: stay home or visit another player`
}));

// 2. Collect responses (LLMs respond, human provides input)
const responses = await orchestrator.promptAgents(
  nightPrompts,
  humanResponseMap,
  includeReasoning: true
);

// 3. Interpret each response using LLM
const actions = await Promise.all(
  responses.map(r =>
    orchestrator.interpretNightAction(r.agentName, r.response)
  )
);
// "i visit bobby" → { action: 'visit', target: 'Bob' }
// "haanzo" → { action: 'visit', target: 'Hanzo' }

// 4. Resolve with pure game logic (no LLM)
const result = orchestrator.resolveNight(actions);
// returns: { deaths: ['Bob'], observations: {...} }

// 5. Send private observations to each agent
observations.forEach((saw, agentName) => {
  orchestrator.promptAgent(
    agentName,
    `You saw: ${saw.join(', ')}`
  );
});
```

---

## API Layer

**File**: `app/api/murder-mystery/route.ts`

Simple stateful API that:
- Initializes game
- Processes each phase (day_0, night_1, day_1_discussion, day_1_voting, etc.)
- Returns results to frontend

```typescript
POST /api/murder-mystery
{
  phase: 'night_1',
  humanResponses: { Finn: 'visit bob' }
}

Response:
{
  nightActions: [...],
  deaths: ['Bob'],
  observations: [...],
  nextPhase: 'day_1_discussion'
}
```

---

## Frontend Layer

**Strategic Sharing** (working prototype): `components/MultiAgentView.tsx`
- 5-column layout (4 agents + debug)
- Frontend orchestration (collects human input, calls API per step)
- Real-time display of messages + reasoning

**Murder Mystery** (API ready, UI TODO): Would use similar pattern
- Display role privately to Finn
- Show night/day phases
- Collect votes/actions
- Display deaths/hangings

---

## Key Design Wins

### ✅ Reusability
- `GameOrchestrator` can be used for ANY multi-agent game
- Just extend it and add your game logic
- No hardcoding for specific agents/games

### ✅ LLM for Intent, Not Logic
- LLM interprets human input: "bobby" → "Bob", "i wanna kill charlie" → `{ intent: true }`
- Game logic is pure TypeScript: deterministic, testable, fast
- Best of both worlds

### ✅ Human = Agent
- Frontend just treats Finn like any other agent
- Backend doesn't know who's human
- No special casing needed

### ✅ Testability
- Pure game logic tested separately (no LLM calls)
- LLM interpretation tested separately
- API tested end-to-end

### ✅ Information Isolation
- Each `IsolatedAgent` has own context
- Orchestrator controls who sees what
- Provably secure (tested with impossible tasks)

---

## Tests Created

1. **`test-murder-mystery-logic.ts`** - Pure game logic (no LLM)
   - ✅ Night resolution with kills
   - ✅ Night resolution with blocked kills
   - ✅ Vote counting and thresholds
   - ✅ Win conditions

2. **`test-murder-mystery-llm.ts`** - LLM interpretation
   - ✅ Fuzzy name matching ("bobby" → "Bob")
   - ✅ Intent recognition ("i want to kill" → `intent: true`)
   - ✅ Action interpretation ("stay home" → `{ action: 'stay' }`)

3. **`test-murder-mystery-api.ts`** - Full API flow (requires dev server)

---

## What's Left for Full Murder Mystery Game

### Backend (Done ✅)
- ✅ GameOrchestrator base class
- ✅ MurderMysteryOrchestrator with all game logic
- ✅ API route handling all phases
- ✅ Tests for logic and LLM interpretation

### Frontend (TODO)
- [ ] Create `MurderMysteryView` component (similar to `MultiAgentView`)
- [ ] Show role privately to human player
- [ ] Display phase transitions (Day 0 → Night 1 → Day 1, etc.)
- [ ] Show death announcements
- [ ] Show voting results + role reveals

**Estimated work**: ~200 lines (mostly UI, same patterns as Strategic Sharing)

---

## How to Build a New Game

1. **Extend GameOrchestrator**
   ```typescript
   class MyGameOrchestrator extends GameOrchestrator {
     // Add game state
     gameState: MyGameState;

     // Add pure game logic methods
     resolveAction(actions) { /* pure logic */ }

     // Add LLM interpretation methods (using base class)
     async interpretAction(input) {
       return this.interpretInput(input, prompt, schema);
     }
   }
   ```

2. **Create API route**
   ```typescript
   // app/api/my-game/route.ts
   const game = new MyGameOrchestrator();
   // Handle phases, return results
   ```

3. **Create Frontend**
   - Use same patterns as MultiAgentView
   - Call API per phase
   - Display results

---

## Summary

**We solved the hard problems:**
- ✅ Isolated agent contexts
- ✅ Human-in-the-loop without serverless headaches
- ✅ Reusable orchestration patterns
- ✅ LLM-powered input interpretation (no regex/fuzzy matching)
- ✅ Clean separation: LLM for intent, logic for rules

**Murder Mystery is 90% done.** The architecture is complete and tested. Just need UI glue.

**Any new game** can reuse `GameOrchestrator` and follow the same pattern.
