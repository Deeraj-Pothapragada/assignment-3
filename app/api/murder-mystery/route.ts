import { NextRequest, NextResponse } from 'next/server';
import { MurderMysteryOrchestrator } from '@/lib/orchestrators/MurderMysteryOrchestrator';
import { setGameInstanceGetter } from './murder-mystery-discussion/route';

/**
 * Murder Mystery Game API
 *
 * Handles all game phases using the reusable GameOrchestrator pattern
 */

// Store game instance in memory (persists in dev mode)
let gameInstance: MurderMysteryOrchestrator | null = null;
let humanPlayerName: string | undefined = undefined;

// Export getter for discussion API
setGameInstanceGetter(() => gameInstance);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phase, humanResponses } = body;

    // Initialize new game
    if (action === 'init') {
      const { playerNames, humanPlayerName, agentConfigs } = body;

      // Convert agentConfigs object to Map if provided
      let agentConfigMap: Map<string, { model?: string }> | undefined;
      if (agentConfigs) {
        agentConfigMap = new Map();
        Object.entries(agentConfigs).forEach(([name, config]: [string, any]) => {
          agentConfigMap!.set(name, { model: config.model });
        });
      }

      gameInstance = new MurderMysteryOrchestrator();
      humanPlayerName = body.humanPlayerName;
      gameInstance.setupGame(playerNames, humanPlayerName, agentConfigMap);

      // Send private role assignments to all players without requiring introductions
      const roleAssignments = gameInstance.getAgentNames().map(name => ({
        agent: name,
        role: gameInstance!.getRole(name)
      }));

      return NextResponse.json({
        success: true,
        message: 'Game initialized',
        gameState: {
          alive: gameInstance.gameState.alive,
          phase: 'night_1' // Skip day_0, go straight to night_1
        },
        roleAssignments
      });
    }

    if (!gameInstance) {
      return NextResponse.json(
        { error: 'Game not initialized' },
        { status: 400 }
      );
    }

    // Night phase
    if (phase?.startsWith('night_')) {
      const humanResponseMap = new Map(Object.entries(humanResponses || {}) as [string, string][]);
      const aliveAgents = gameInstance.gameState.alive;

      // Collect night actions from all alive players
      const nightPrompts = aliveAgents.map(name => {
        const otherPlayers = aliveAgents.filter(n => n !== name);
        const isMurderer = gameInstance!.getRole(name) === 'murderer';
        const mustHaveIntent = isMurderer && gameInstance!.murdererMustHaveIntent();

        return {
          agentName: name,
          message: isMurderer
            ? mustHaveIntent
              ? `⚠️ NIGHT PHASE (INTENT REQUIRED): You did not have intent to kill last night, so you MUST have intent this night. Choose your action: "stay at your home with intent to kill" OR "visit another player's HOME with intent to kill" (${otherPlayers.join(', ')}). IMPORTANT: If you visit someone, you go to THEIR home - they might not be there if they visited elsewhere!`
              : `NIGHT PHASE: Choose your action. You can either "stay at your home" or "visit another player's HOME" (${otherPlayers.join(', ')}). IMPORTANT: If you visit someone, you go to THEIR home - they might not be there if they visited elsewhere! Also specify if you have "intent to kill" (yes/no).`
            : `NIGHT PHASE: Choose your action. You can either "stay at your home" or "visit another player's HOME" (${otherPlayers.join(', ')}). IMPORTANT: If you visit someone, you go to THEIR home - they might not be there if they visited elsewhere!`
        };
      });

      const actionResponses = await gameInstance!.promptAgents(
        nightPrompts,
        humanResponseMap,
        true
      );

      // Interpret each action using LLM
      const nightActions = await Promise.all(
        actionResponses.map(r =>
          gameInstance!.interpretNightAction(r.agentName, r.response)
        )
      );

      // Resolve night
      const result = gameInstance!.resolveNight(nightActions);

      // Send private observations to each player AND add to their conversation history
      const observationMessages: any[] = [];
      aliveAgents.forEach(name => {
        if (result.deaths.includes(name)) return; // Dead players get no message

        const obs = result.observations.get(name);
        if (!obs) return;

        // Format home name nicely (alice_home -> Alice's home)
        const homeOwner = obs.home.replace('_home', '');
        const homeOwnerCapitalized = homeOwner.charAt(0).toUpperCase() + homeOwner.slice(1);

        // Check if player stayed at their own home
        const stayedHome = homeOwner.toLowerCase() === name.toLowerCase();

        let message = stayedHome
          ? `🏠 You stayed at your home. `
          : `🏠 You were at ${homeOwnerCapitalized}'s home. `;

        if (obs.otherPlayers.length > 0) {
          message += `You saw: ${obs.otherPlayers.join(', ')}.`;
        } else {
          message += `You saw no one else.`;
        }

        // Tell murderer about kill outcome
        if (gameInstance!.getRole(name) === 'murderer') {
          const murdererAction = nightActions.find(a => a.agentName === name);
          if (murdererAction?.intent) {
            if (result.murdererBlocked) {
              message += `\n\n[PRIVATE: Since there was more than 1 person present, you did not follow through with your intent to kill.]`;
            } else if (result.deaths.length > 0) {
              // Kill succeeded
              const victim = obs.otherPlayers.find(p => result.deaths.includes(p));
              if (victim) {
                message += `\n\n[PRIVATE: Your kill was successful. ${victim} is dead.]`;
              }
            }
          }
        }

        // IMPORTANT: Add this observation to the agent's conversation history
        // so they know what they saw when asked to make day statements
        gameInstance!.notifyAgent(name, message);

        observationMessages.push({
          agent: name,
          observation: message,
          home: obs.home // Include raw home location for debugging
        });
      });

      // Broadcast death announcements to all alive agents BEFORE moving to next phase
      // This ensures agents know who died when making their day statements
      const aliveAfterNight = gameInstance.gameState.alive;
      const deathAnnouncement = result.deaths.length > 0
        ? `💀 ${result.deaths.join(', ')} died last night.`
        : `No one died last night.`;

      aliveAfterNight.forEach(agentName => {
        gameInstance!.notifyAgent(agentName, deathAnnouncement);
      });

      // Check win condition
      const winCheck = gameInstance!.checkWinCondition();

      // Check if human player died - game over for them
      const humanPlayerDied = humanPlayerName ? result.deaths.includes(humanPlayerName) : false;

      return NextResponse.json({
        phase,
        nightPrompts: nightPrompts.map(p => ({ agent: p.agentName, prompt: p.message })),
        nightResponses: actionResponses.map(r => ({
          agent: r.agentName,
          response: r.response,
          reasoning: r.reasoning
        })),
        nightActions: nightActions.map(a => ({
          agent: a.agentName,
          action: a.action,
          targetHome: a.targetHome,
          intent: a.intent
        })),
        deaths: result.deaths,
        observations: observationMessages,
        winner: winCheck.winner || (humanPlayerDied ? 'murderer' : null),
        winReason: winCheck.winner ? winCheck.reason : (humanPlayerDied ? '💀 Unlucky! You died.' : ''),
        humanPlayerDied,
        nextPhase: (winCheck.winner || humanPlayerDied) ? null : `day_${gameInstance.gameState.dayNumber + 1}_discussion`
      });
    }

    // Day discussion phase - just start the discussion, don't collect all statements
    if (phase?.includes('_discussion') && action === 'start_discussion') {
      const aliveAgents = gameInstance.gameState.alive;

      // Notify all agents that discussion has started
      aliveAgents.forEach(agentName => {
        gameInstance!.notifyAgent(
          agentName,
          `📢 DAY DISCUSSION PHASE: You have 90 seconds to discuss. Share what you saw, make accusations, ask questions, or say anything you want. Remember: others may lie!`
        );
      });

      // Optionally, have LLM agents make an initial statement
      const llmAgents = aliveAgents.filter(name => {
        const agent = gameInstance!.agents.get(name);
        return agent?.type === 'llm';
      });

      // Let LLM agents make initial statements
      const initialPrompts = llmAgents.map(name => ({
        agentName: name,
        message: `DISCUSSION STARTED: Make an initial statement to the group. Share what you saw last night, make accusations, or say anything you want.`
      }));

      const initialStatements = await Promise.all(
        initialPrompts.map(async ({ agentName, message }) => {
          try {
            const response = await gameInstance!.promptAgent(agentName, message, false);
            const messageText = `${agentName}: "${response.response}"`;

            // Broadcast to all agents
            aliveAgents.forEach(name => {
              gameInstance!.notifyAgent(name, `📢 DISCUSSION: ${messageText}`);
            });

            return {
              agent: agentName,
              statement: response.response
            };
          } catch (error) {
            console.error(`Error getting initial statement from ${agentName}:`, error);
            return null;
          }
        })
      );

      return NextResponse.json({
        phase,
        discussionStarted: true,
        duration: 90, // seconds
        initialStatements: initialStatements.filter(s => s !== null),
        nextPhase: phase.replace('_discussion', '_voting')
      });
    }

    // Day voting phase
    if (phase?.includes('_voting')) {
      const humanResponseMap = new Map(Object.entries(humanResponses || {}) as [string, string][]);
      const aliveAgents = gameInstance.gameState.alive;

      // Each alive player votes
      const votePrompts = aliveAgents.map(name => ({
        agentName: name,
        message: `VOTING PHASE: Based on what you've seen last night and what everyone said during the discussion, vote to hang one player, or abstain. Available players: ${aliveAgents.filter(n => n !== name).join(', ')}, or say "abstain".`
      }));

      const voteResponses = await gameInstance!.promptAgents(
        votePrompts,
        humanResponseMap,
        true
      );

      // Interpret votes using LLM
      const votes = await Promise.all(
        voteResponses.map(r =>
          gameInstance!.interpretVote(r.agentName, r.response)
        )
      );

      // Map reasoning back to votes
      const votesWithReasoning = votes.map(v => {
        const response = voteResponses.find(r => r.agentName === v.agentName);
        return {
          ...v,
          reasoning: response?.reasoning || ''
        };
      });

      // Resolve voting
      const voteResult = gameInstance!.resolveVoting(votes);

      // Check win condition
      const winCheck = gameInstance!.checkWinCondition();

      const dayNum = parseInt(phase.match(/day_(\d+)/)?.[1] || '1');

      return NextResponse.json({
        phase,
        votePrompts: votePrompts.map(p => ({ agent: p.agentName, prompt: p.message })),
        votes: votesWithReasoning.map(v => ({
          agent: v.agentName,
          vote: v.vote,
          reasoning: v.reasoning
        })),
        voteCounts: Object.fromEntries(voteResult.voteCounts),
        hanged: voteResult.hanged,
        hangedRole: voteResult.role,
        winner: winCheck.winner,
        winReason: winCheck.reason,
        nextPhase: winCheck.winner ? null : `night_${dayNum + 1}`
      });
    }

    return NextResponse.json(
      { error: 'Invalid phase' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Murder mystery error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process game action' },
      { status: 500 }
    );
  }
}

// Reset game
export async function DELETE() {
  gameInstance = null;
  humanPlayerName = undefined;
  return NextResponse.json({ success: true, message: 'Game reset' });
}
