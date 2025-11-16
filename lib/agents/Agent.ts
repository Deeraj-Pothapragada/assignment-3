import { geminiGenerate } from '../gemini';

export class ExampleAgent {
  name: string;

  constructor() {
    this.name = 'example';
  }

  /**
   * Respond to the user with your agent's persona.
   *
   * TODO: Replace the systemPrompt with your persona's guidance.
   */
  async respond(contents: any[]) {
    const systemPrompt = `TODO: Describe your agent's persona, goals, and style here.`;
    const { text } = await geminiGenerate({ contents, systemPrompt });
    return { text };
  }
}
