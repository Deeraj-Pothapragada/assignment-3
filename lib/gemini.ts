import { GoogleGenAI } from '@google/genai';

export function hasGemini(overrideKey?: string): boolean {
  return Boolean(overrideKey || process.env.GEMINI_API_KEY);
}

export async function geminiGenerate({
  contents,
  systemPrompt = '',
  model = 'gemini-2.5-flash',
  config = {}
}: {
  contents: any[];
  systemPrompt?: string;
  model?: string;
  config?: any;
}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey: key });
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  const request = {
    model: model,
    contents: contents,
    config: config
  };

  const response = await ai.models.generateContent(request);
  const text = typeof response?.text === 'string' ? response.text : '';
  return { text, raw: response };
}
