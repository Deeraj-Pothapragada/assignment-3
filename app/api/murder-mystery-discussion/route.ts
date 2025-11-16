import { NextRequest, NextResponse } from 'next/server';
import { MurderMysteryOrchestrator } from '@/lib/orchestrators/MurderMysteryOrchestrator';

/**
 * Discussion API endpoint for real-time discussion phase
 * Handles posting messages and triggering LLM agent responses
 */

// Store game instance reference (same as main route)
// In a real app, you'd use a shared store/DB
let getGameInstance: (() => MurderMysteryOrchestrator | null) | null = null;

export function setGameInstanceGetter(getter: () => MurderMysteryOrchestrator | null) {
  getGameInstance = getter;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agentName, message } = body;

    if (!getGameInstance) {
      return NextResponse.json(
        { error: 'Game not initialized' },
        { status: 400 }
      );
    }

    const gameInstance = getGameInstance();
    if (!gameInstance) {
      return NextResponse.json(
        { error: 'Game not initialized' },
        { status: 400 }
      );
    }

    // Post a message from an agent
    if (action === 'post') {
      if (!agentName || !message) {
        return NextResponse.json(
          { error: 'agentName and message required' },
          { status: 400 }
        );
      }

      const aliveAgents = gameInstance.gameState.alive;
      if (!aliveAgents.includes(agentName)) {
        return NextResponse.json(
          { error: 'Agent not alive' },
          { status: 400 }
        );
      }

      // Broadcast message to all alive agents
      const messageText = `${agentName}: "${message}"`;
      aliveAgents.forEach(name => {
        gameInstance.notifyAgent(
          name,
          `📢 DISCUSSION: ${messageText}`
        );
      });

      // If this was from a human, trigger LLM agents to potentially respond
      const agent = gameInstance.agents.get(agentName);
      const isHuman = agent?.type === 'human';

      let llmResponses: any[] = [];

      if (isHuman) {
        // Give LLM agents a chance to respond
        const llmAgents = aliveAgents.filter(name => {
          const a = gameInstance.agents.get(name);
          return a?.type === 'llm';
        });

        // Ask each LLM agent if they want to respond
        // Only check a subset to avoid too many simultaneous API calls
        // Randomly select 1-2 agents to potentially respond (to make it more natural)
        const agentsToCheck = llmAgents.length > 2
          ? llmAgents.sort(() => Math.random() - 0.5).slice(0, Math.min(2, llmAgents.length))
          : llmAgents;

        const responsePrompts = agentsToCheck.map(name => ({
          agentName: name,
          message: `DISCUSSION UPDATE: ${messageText}\n\nBased on this new message and all previous discussion, do you want to make a statement? If yes, provide your statement. If no, respond with just "pass" or "no comment".`
        }));

        const responses = await Promise.all(
          responsePrompts.map(async ({ agentName, message }) => {
            try {
              const response = await gameInstance.promptAgent(agentName, message, false);
              const lowerResponse = response.response.toLowerCase().trim();

              // Check if agent wants to respond (not just "pass" or "no comment")
              if (lowerResponse !== 'pass' &&
                  lowerResponse !== 'no comment' &&
                  lowerResponse !== 'no' &&
                  !lowerResponse.startsWith('pass') &&
                  !lowerResponse.startsWith('no comment') &&
                  lowerResponse.length > 10) {
                // Broadcast this agent's response
                const responseText = `${agentName}: "${response.response}"`;
                aliveAgents.forEach(name => {
                  gameInstance.notifyAgent(
                    name,
                    `📢 DISCUSSION: ${responseText}`
                  );
                });

                return {
                  agent: agentName,
                  message: response.response,
                  reasoning: response.reasoning
                };
              }
              return null;
            } catch (error) {
              console.error(`Error getting response from ${agentName}:`, error);
              return null;
            }
          })
        );

        llmResponses = responses.filter(r => r !== null);
      }

      return NextResponse.json({
        success: true,
        postedBy: agentName,
        message,
        llmResponses
      });
    }

    // Get discussion history
    if (action === 'get_history') {
      // This would require storing discussion history separately
      // For now, return empty - history is in agent conversation histories
      return NextResponse.json({
        success: true,
        history: []
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Discussion API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process discussion action' },
      { status: 500 }
    );
  }
}
