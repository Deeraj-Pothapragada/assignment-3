import { geminiGenerate } from '../gemini';
import { ExampleAgent } from '../agents/Agent';

const SELECTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    agent: { type: 'STRING' },
    reasons: { type: 'STRING' }
  },
  required: ['agent']
};

export class ExampleOrchestrator {
  name: string;
  exampleAgent: ExampleAgent;

  constructor() {
    this.name = 'example';
    this.exampleAgent = new ExampleAgent();
  }

  async respondWithAgent(contents: any[]) {
    const res = await this.exampleAgent.respond(contents);
    return res?.text || '';
  }

  async orchestrate(contents: any[]) {
    const orchestratorPrompt = `
        //TODO: Replace the prompt with your orchestrator's guidance.
    `;

    const result = await geminiGenerate({
      contents,
      systemPrompt: orchestratorPrompt,
      config: { responseMimeType: 'application/json', responseSchema: SELECTION_SCHEMA }
    });

    let agent = 'example';
    let reasons = 'Defaulted to example';

    try {
      let orchestratorResponseText = result.text;
      const parsed = JSON.parse(orchestratorResponseText);
      const rawAgent = String(parsed?.agent || '').toLowerCase();

      if (rawAgent === 'example') agent = 'example';
      if (parsed?.reasons) reasons = String(parsed.reasons);
    } catch (_) {}

    const text = await this.respondWithAgent(contents);

    const frameSet = { frames: { persona: { value: agent, rationale: [reasons] } } };
    return { assistantMessage: text || '', frameSet, agent, reasons };
  }
}
