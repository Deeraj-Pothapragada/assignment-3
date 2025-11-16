import { NextRequest, NextResponse } from 'next/server';
import { IsolatedAgent } from '@/lib/agents/IsolatedAgent';

/**
 * API endpoint that processes ONE step of the game.
 * Frontend calls this with Finn's response, backend gets LLM responses.
 */

// Store agent instances and game state in memory (persist across requests in dev mode)
let agents: {
  Finn: null;
  Genji: IsolatedAgent;
  Hanzo: IsolatedAgent;
  Kendrick: IsolatedAgent;
} | null = null;

let gameState: {
  numbers?: number[];
  reveals?: { from: string; to: string; number: number }[];
} = {};

function getOrCreateAgents() {
  if (!agents) {
    agents = {
      Finn: null,
      Genji: new IsolatedAgent('Genji', 'You are Genji. Use all information available to you. Be clever and thorough in your answers.'),
      Hanzo: new IsolatedAgent('Hanzo', 'You are Hanzo. Use all information available to you. Be clever and thorough in your answers.'),
      Kendrick: new IsolatedAgent('Kendrick', 'You are Kendrick. Use all information available to you. Be clever and thorough in your answers.')
    };
  }
  return agents;
}

export async function POST(req: NextRequest) {
  try {
    const { step, finnResponse } = await req.json();

    if (!step || !finnResponse) {
      return NextResponse.json(
        { error: 'step and finnResponse are required' },
        { status: 400 }
      );
    }

    const agentInstances = getOrCreateAgents();
    const agentNames = ['Finn', 'Genji', 'Hanzo', 'Kendrick'];

    let results: any = {
      step,
      responses: []
    };

    // Step 1: Pick numbers
    if (step === 1) {
      // Finn already responded
      const finnNum = parseInt(finnResponse.match(/\d+/)?.[0] || '0');

      // Get LLM responses in parallel
      const [genjiResp, hanzoResp, kendrickResp] = await Promise.all([
        agentInstances.Genji.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.'),
        agentInstances.Hanzo.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.'),
        agentInstances.Kendrick.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.')
      ]);

      const genjiNum = parseInt(genjiResp.text.match(/\d+/)?.[0] || '0');
      const hanzoNum = parseInt(hanzoResp.text.match(/\d+/)?.[0] || '0');
      const kendrickNum = parseInt(kendrickResp.text.match(/\d+/)?.[0] || '0');

      results.responses = [
        { agent: 'Finn', response: finnResponse, number: finnNum },
        { agent: 'Genji', response: genjiResp.text, number: genjiNum },
        { agent: 'Hanzo', response: hanzoResp.text, number: hanzoNum },
        { agent: 'Kendrick', response: kendrickResp.text, number: kendrickNum }
      ];
      results.numbers = [finnNum, genjiNum, hanzoNum, kendrickNum];

      // Store numbers for later steps
      gameState.numbers = [finnNum, genjiNum, hanzoNum, kendrickNum];
    }

    // Step 2: Choose who to reveal to
    else if (step === 2) {
      // Get LLM responses with reasoning (all agents can choose from all other agents including Finn)
      const [genjiResp, hanzoResp, kendrickResp] = await Promise.all([
        agentInstances.Genji.respond(
          `You picked a number. The other agents are: ${agentNames.filter(n => n !== 'Genji').join(', ')}. Choose ONE agent to reveal your number to. Respond with just their name, nothing else.`,
          true
        ),
        agentInstances.Hanzo.respond(
          `You picked a number. The other agents are: ${agentNames.filter(n => n !== 'Hanzo').join(', ')}. Choose ONE agent to reveal your number to. Respond with just their name, nothing else.`,
          true
        ),
        agentInstances.Kendrick.respond(
          `You picked a number. The other agents are: ${agentNames.filter(n => n !== 'Kendrick').join(', ')}. Choose ONE agent to reveal your number to. Respond with just their name, nothing else.`,
          true
        )
      ]);

      // Parse who revealed to whom
      const reveals: { from: string; to: string; number: number }[] = [];
      const [finnNum, genjiNum, hanzoNum, kendrickNum] = gameState.numbers || [0, 0, 0, 0];

      reveals.push({ from: 'Finn', to: finnResponse.trim(), number: finnNum });
      reveals.push({ from: 'Genji', to: genjiResp.text.trim(), number: genjiNum });
      reveals.push({ from: 'Hanzo', to: hanzoResp.text.trim(), number: hanzoNum });
      reveals.push({ from: 'Kendrick', to: kendrickResp.text.trim(), number: kendrickNum });

      // Store reveals for step 3
      gameState.reveals = reveals;

      results.responses = [
        { agent: 'Finn', response: finnResponse, reasoning: '' },
        { agent: 'Genji', response: genjiResp.text, reasoning: genjiResp.reasoning },
        { agent: 'Hanzo', response: hanzoResp.text, reasoning: hanzoResp.reasoning },
        { agent: 'Kendrick', response: kendrickResp.text, reasoning: kendrickResp.reasoning }
      ];
      results.reveals = reveals;
    }

    // Step 3: Guess the sum
    else if (step === 3) {
      const reveals = gameState.reveals || [];

      // Build reveal messages for each agent
      const getRevealMessage = (agentName: string) => {
        const revealsToMe = reveals.filter(r => r.to === agentName);
        if (revealsToMe.length > 0) {
          return revealsToMe.map(r => `${r.from} revealed their number: ${r.number}`).join('. ') + '. ';
        }
        return 'No one revealed their number to you. ';
      };

      // Get LLM responses with reasoning (include reveal info)
      const [genjiResp, hanzoResp, kendrickResp] = await Promise.all([
        agentInstances.Genji.respond(
          `${getRevealMessage('Genji')}What is the sum of all four agents' numbers?`,
          true
        ),
        agentInstances.Hanzo.respond(
          `${getRevealMessage('Hanzo')}What is the sum of all four agents' numbers?`,
          true
        ),
        agentInstances.Kendrick.respond(
          `${getRevealMessage('Kendrick')}What is the sum of all four agents' numbers?`,
          true
        )
      ]);

      // Calculate correct sum
      const correctSum = (gameState.numbers || []).reduce((a, b) => a + b, 0);

      results.responses = [
        { agent: 'Finn', response: finnResponse, reasoning: '', revealsReceived: getRevealMessage('Finn') },
        { agent: 'Genji', response: genjiResp.text, reasoning: genjiResp.reasoning },
        { agent: 'Hanzo', response: hanzoResp.text, reasoning: hanzoResp.reasoning },
        { agent: 'Kendrick', response: kendrickResp.text, reasoning: kendrickResp.reasoning }
      ];
      results.correctSum = correctSum;
      results.reveals = reveals;
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Error in strategic sharing step:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process step' },
      { status: 500 }
    );
  }
}

// Reset agents (for new game)
export async function DELETE() {
  agents = null;
  gameState = {};
  return NextResponse.json({ success: true, message: 'Agents reset' });
}
