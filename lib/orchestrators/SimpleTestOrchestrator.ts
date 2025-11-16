import { IsolatedAgent } from '../agents/IsolatedAgent';

/**
 * SimpleTestOrchestrator - Controls conversation flow between isolated agents.
 *
 * The orchestrator:
 * - Decides which agent speaks and when
 * - Routes messages between agents
 * - Maintains game state / turn order
 * - Does NOT participate in conversations (no back-and-forth with agents)
 *
 * Example flow:
 * 1. Orchestrator tells Agent A: "Introduce yourself to Bob"
 * 2. Agent A generates response
 * 3. Orchestrator tells Agent B: "Alice said: '[message]'. Respond to her."
 * 4. Agent B generates response
 * 5. Orchestrator stops (or continues based on logic)
 */
export class SimpleTestOrchestrator {
  agents: Map<string, IsolatedAgent>;
  conversationLog: { speaker: string; message: string; timestamp: Date }[];

  constructor(agents: IsolatedAgent[]) {
    // Store agents in a map for easy lookup by name
    this.agents = new Map();
    agents.forEach(agent => {
      this.agents.set(agent.name, agent);
    });
    this.conversationLog = [];
  }

  /**
   * Get an agent by name.
   */
  getAgent(name: string): IsolatedAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Execute a simple test conversation flow.
   * This is a hardcoded flow for testing - in the future, this logic will be more dynamic.
   */
  async runTestConversation() {
    const agentNames = Array.from(this.agents.keys());
    if (agentNames.length < 2) {
      throw new Error('Need at least 2 agents for test conversation');
    }

    const [agentAName, agentBName] = agentNames;
    const agentA = this.agents.get(agentAName)!;
    const agentB = this.agents.get(agentBName)!;

    const results = [];

    // Step 1: Orchestrator asks Agent A to introduce themselves to Agent B
    console.log(`\n[Orchestrator] Asking ${agentAName} to introduce themselves to ${agentBName}...`);
    const responseA = await agentA.respond(
      `Introduce yourself to ${agentBName}. Keep it brief (1-2 sentences).`
    );
    this.logMessage(agentAName, responseA.text);
    results.push({
      speaker: agentAName,
      message: responseA.text
    });

    // Step 2: Orchestrator tells Agent B what Agent A said, and asks them to respond
    console.log(`\n[Orchestrator] Telling ${agentBName} what ${agentAName} said and asking for response...`);
    const responseB = await agentB.respond(
      `${agentAName} said: "${responseA.text}"\n\nRespond to ${agentAName}. Keep it brief (1-2 sentences).`
    );
    this.logMessage(agentBName, responseB.text);
    results.push({
      speaker: agentBName,
      message: responseB.text
    });

    // Step 3: Orchestrator could continue, but we'll stop here for testing
    console.log(`\n[Orchestrator] Conversation complete. Stopping here.`);

    return {
      conversationLog: this.conversationLog,
      results
    };
  }

  /**
   * Log a message in the orchestrator's conversation log.
   * This is the orchestrator's view of what happened (not part of any agent's context).
   */
  private logMessage(speaker: string, message: string) {
    this.conversationLog.push({
      speaker,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Get the full conversation log (orchestrator's view).
   */
  getConversationLog() {
    return [...this.conversationLog];
  }
}
