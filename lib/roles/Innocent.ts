/**
 * Innocent Role
 *
 * Goal: Identify and vote out the murderer
 * Night Action: Visit a location to gather information
 * Constraint: Cannot knowingly lie
 */

import { Role, RoleContext, toHomeName } from './Role';
import { GameEvent, createMoveEvent } from '../game/events';

export const InnocentRole: Role = {
  roleName: 'innocent',
  alignment: 'town',

  getSystemPrompt(context: RoleContext): string {
    const { agentName, allPlayers } = context;

    return `You are ${agentName}, an INNOCENT. Your goal is to identify and vote out the murderer. Share factual information and look for contradictions in what others say. Use all information available to you.

GAME RULES YOU MUST KNOW:
- PLAYERS IN GAME: ${allPlayers.join(', ')}. Only these players exist - do not mention other names.
- LOCATIONS: When you "visit" someone, you go to THEIR HOME (a location). They might not be there if they visited elsewhere. Locations are HOMES, not players.
- If you choose an action that doesn't make sense, it will default to staying at your own home.
- KILLING: The murderer can only kill when EXACTLY 2 people are at a location (murderer + victim). If > 2 people are present, the murderer does not even attempt to kill.
- The murderer can CHOOSE whether to kill each night. A night with no deaths does NOT mean there's no murderer.
- There is only ONE murderer. All other players (including you) are innocents who cannot knowingly lie.
- DO NOT theorize about multiple murderers or collusion - there is exactly one murderer acting alone.
- Innocents always tell the truth about what they saw. If statements conflict, someone is lying (the murderer) or locations explain the discrepancy.

REASONING STYLE: When providing reasoning, be CONCISE. Focus only on your key decision factors.`;
  },

  getNightPrompt(context: RoleContext): string {
    return `Where do you go tonight? (stay home / visit [name])`;
  },

  async interpretNightAction(
    rawInput: string,
    context: RoleContext,
    interpretFn: <T>(rawInput: string, prompt: string, schema: any) => Promise<T>
  ): Promise<GameEvent[]> {
    const { agentName, alivePlayers } = context;

    const interpretationPrompt = `The player is ${agentName}. They can either "stay at their home" (use "${agentName}") or "visit another player's HOME" (${alivePlayers.filter(p => p !== agentName).join(', ')}).`;

    const schema = {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['stay', 'visit'] },
        targetPlayer: {
          type: 'STRING',
          description: `Name of player whose home to visit. Use "${agentName}" if staying at own home, or another player's name (${alivePlayers.join(', ')}) if visiting.`,
          enum: alivePlayers
        }
      },
      required: ['action', 'targetPlayer']
    };

    const result = await interpretFn<{ interpreted: { action: 'stay' | 'visit'; targetPlayer: string }; reasoning: string }>(
      rawInput,
      interpretationPrompt,
      schema
    );

    const events: GameEvent[] = [];

    // MOVE event - where the innocent goes
    const targetHome = toHomeName(result.interpreted.targetPlayer);
    events.push(createMoveEvent(agentName, targetHome));

    return events;
  }
};
