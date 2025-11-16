import { geminiGenerate } from '../gemini';

/**
 * IsolatedAgent - An agent with its own isolated conversation context.
 *
 * Each instance maintains:
 * - Its own name/identity
 * - Its own conversation history (what it has seen)
 * - Its own system prompt/persona
 *
 * The agent only responds when explicitly prompted by an orchestrator.
 */
export class IsolatedAgent {
  name: string;
  systemPrompt: string;
  model: string;
  conversationHistory: any[]; // Array of Gemini message format

  constructor(name: string, systemPrompt: string, model: string = 'gemini-2.5-flash') {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.model = model;
    this.conversationHistory = [];
  }

  /**
   * Add a message to this agent's conversation history.
   * This is what the agent "sees" and "remembers".
   */
  addToHistory(message: { role: 'user' | 'model'; parts: { text: string }[] }) {
    this.conversationHistory.push(message);
  }

  /**
   * Generate a response based on the orchestrator's instruction and this agent's isolated context.
   *
   * @param instruction - The specific task/prompt from the orchestrator (e.g., "Introduce yourself to Bob")
   * @param includeReasoning - Whether to use structured output with reasoning (default: false)
   * @returns The agent's generated response (and optionally reasoning)
   */
  async respond(instruction: string, includeReasoning: boolean = false) {
    // Add the orchestrator's instruction to the conversation history
    const instructionMessage = {
      role: 'user' as const,
      parts: [{ text: instruction }]
    };

    let text = '';
    let reasoning = '';

    if (includeReasoning) {
      // Use structured JSON output to get both answer and reasoning
      const RESPONSE_SCHEMA = {
        type: 'OBJECT',
        properties: {
          reasoning: { type: 'STRING', description: 'Your internal thought process and rationale -- be concise' },
          answer: { type: 'STRING', description: 'Your final answer' }
        },
        required: ['reasoning', 'answer']
      };

      const result = await geminiGenerate({
        contents: [...this.conversationHistory, instructionMessage],
        systemPrompt: this.systemPrompt,
        model: this.model,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      });

      try {
        const parsed = JSON.parse(result.text);
        reasoning = String(parsed?.reasoning || '');
        text = String(parsed?.answer || '');
      } catch (e) {
        // Fallback if JSON parsing fails
        text = result.text;
        reasoning = 'Failed to parse reasoning';
      }
    } else {
      // Regular text response
      const result = await geminiGenerate({
        contents: [...this.conversationHistory, instructionMessage],
        systemPrompt: this.systemPrompt,
        model: this.model
      });
      text = result.text;
    }

    // Add the instruction and response to this agent's history
    this.addToHistory(instructionMessage);
    this.addToHistory({
      role: 'model',
      parts: [{ text }]
    });

    return { text, reasoning };
  }

  /**
   * Get a read-only view of this agent's conversation history.
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Clear this agent's conversation history (useful for resetting).
   */
  clearHistory() {
    this.conversationHistory = [];
  }
}
