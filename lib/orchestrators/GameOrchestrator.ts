import { IsolatedAgent } from '../agents/IsolatedAgent';
import { geminiGenerate } from '../gemini';

/**
 * GameOrchestrator - Reusable orchestrator for multi-agent games with isolated contexts
 *
 * This class handles:
 * - Managing multiple agents (LLM and human)
 * - Collecting input from agents with structured interpretation
 * - Broadcasting/sending messages to specific agents
 * - Using LLM to interpret user input intelligently (fuzzy matching, intent recognition)
 */

export type AgentType = 'llm' | 'human';

export interface Agent {
  name: string;
  type: AgentType;
  instance: IsolatedAgent | null; // null for human players
}

export interface OrchestratorPrompt {
  agentName: string;
  message: string;
}

export interface AgentResponse {
  agentName: string;
  response: string;
  reasoning?: string;
}

export interface InterpretedInput<T = any> {
  raw: string;
  interpreted: T;
  reasoning: string;
}

export class GameOrchestrator {
  agents: Map<string, Agent>;
  systemPrompt: string;

  constructor(systemPrompt: string) {
    this.agents = new Map();
    this.systemPrompt = systemPrompt;
  }

  /**
   * Register an agent (LLM or human)
   */
  registerAgent(name: string, type: AgentType, systemPrompt?: string, model?: string) {
    const agent: Agent = {
      name,
      type,
      instance: type === 'llm' ? new IsolatedAgent(name, systemPrompt || '', model || 'gemini-2.5-flash') : null
    };
    this.agents.set(name, agent);
  }

  /**
   * Get list of all agent names
   */
  getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get list of all LLM agent names
   */
  getLLMAgentNames(): string[] {
    return Array.from(this.agents.values())
      .filter(a => a.type === 'llm')
      .map(a => a.name);
  }

  /**
   * Send an informational message to an agent without requiring a response.
   * This adds the message to the agent's conversation history.
   *
   * @param agentName - The agent to notify
   * @param message - The informational message
   */
  notifyAgent(agentName: string, message: string) {
    const agent = this.agents.get(agentName);
    if (!agent || agent.type !== 'llm') {
      return; // Only LLM agents have conversation history
    }

    agent.instance!.addToHistory({
      role: 'user',
      parts: [{ text: message }]
    });
  }

  /**
   * Send a message to a specific agent and get their response
   *
   * @param agentName - The agent to send the message to
   * @param message - The message/prompt to send
   * @param includeReasoning - Whether to request reasoning in response
   * @param humanResponse - For human agents, their typed response
   */
  async promptAgent(
    agentName: string,
    message: string,
    includeReasoning: boolean = false,
    humanResponse?: string
  ): Promise<AgentResponse> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    if (agent.type === 'human') {
      if (!humanResponse) {
        throw new Error(`Human response required for agent ${agentName}`);
      }
      return {
        agentName,
        response: humanResponse,
        reasoning: ''
      };
    }

    // LLM agent
    const result = await agent.instance!.respond(message, includeReasoning);
    return {
      agentName,
      response: result.text,
      reasoning: result.reasoning
    };
  }

  /**
   * Prompt multiple agents in parallel (LLMs respond, humans need their responses provided)
   *
   * @param prompts - Array of { agentName, message } objects
   * @param humanResponses - Map of human agent names to their responses
   * @param includeReasoning - Whether to request reasoning in responses
   */
  async promptAgents(
    prompts: OrchestratorPrompt[],
    humanResponses: Map<string, string>,
    includeReasoning: boolean = false
  ): Promise<AgentResponse[]> {
    const responsePromises = prompts.map(({ agentName, message }) => {
      const humanResponse = humanResponses.get(agentName);
      return this.promptAgent(agentName, message, includeReasoning, humanResponse);
    });

    return Promise.all(responsePromises);
  }

  /**
   * Broadcast the same message to all agents (or a subset)
   *
   * @param message - The message to broadcast
   * @param agentNames - Optional list of specific agents to message (defaults to all)
   * @param humanResponses - Map of human agent responses
   * @param includeReasoning - Whether to request reasoning
   */
  async broadcastToAgents(
    message: string,
    agentNames?: string[],
    humanResponses?: Map<string, string>,
    includeReasoning: boolean = false
  ): Promise<AgentResponse[]> {
    const targets = agentNames || this.getAgentNames();
    const prompts = targets.map(name => ({ agentName: name, message }));
    return this.promptAgents(prompts, humanResponses || new Map(), includeReasoning);
  }

  /**
   * Use the orchestrator's LLM to interpret raw user input into structured data
   *
   * This is where fuzzy matching, intent recognition, etc. happens via LLM
   *
   * @param rawInput - The raw user input (e.g., "haanzo" or "i want to visit bob")
   * @param interpretationPrompt - Instructions for how to interpret the input
   * @param schema - JSON schema for the interpreted output
   */
  async interpretInput<T>(
    rawInput: string,
    interpretationPrompt: string,
    schema: any
  ): Promise<InterpretedInput<T>> {
    const fullPrompt = `${interpretationPrompt}

Raw user input: "${rawInput}"

Interpret this input according to the schema. Provide reasoning for your interpretation.`;

    const INTERPRETATION_SCHEMA = {
      type: 'OBJECT',
      properties: {
        interpreted: schema,
        reasoning: { type: 'STRING', description: 'Explain how you interpreted the input' }
      },
      required: ['interpreted', 'reasoning']
    };

    const result = await geminiGenerate({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      systemPrompt: this.systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: INTERPRETATION_SCHEMA
      }
    });

    const parsed = JSON.parse(result.text);

    return {
      raw: rawInput,
      interpreted: parsed.interpreted as T,
      reasoning: parsed.reasoning
    };
  }

  /**
   * Reset all LLM agent histories (useful for new game)
   */
  resetAllAgents() {
    this.agents.forEach(agent => {
      if (agent.type === 'llm' && agent.instance) {
        agent.instance.clearHistory();
      }
    });
  }

  /**
   * Remove all agents (useful for new game)
   */
  clearAgents() {
    this.agents.clear();
  }
}
