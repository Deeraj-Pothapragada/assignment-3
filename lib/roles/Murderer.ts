/**
 * Murderer Role
 *
 * Goal: Eliminate all innocents without being caught
 * Night Action: Visit a location with optional intent to kill
 * Constraint: Must have intent to kill at least once every two nights
 */

import { Role, RoleContext, toHomeName } from './Role';
import { GameEvent, createMoveEvent, createKillIntentEvent } from '../game/events';

export const MurdererRole: Role = {
  roleName: 'murderer',
  alignment: 'mafia',

  getSystemPrompt(context: RoleContext): string {
    const { agentName, allPlayers } = context;

    return `You are ${agentName}, the MURDERER. Your goal is to eliminate all innocents without being caught. You can and should lie strategically. You must have "intent to kill" at least once every two nights - if you don't have intent one night, you'll be forced to have it the next night. Use all information available to you.

GAME RULES YOU MUST KNOW:
- PLAYERS IN GAME: ${allPlayers.join(', ')}. Only these players exist - do not mention other names.
- LOCATIONS: When you "visit" someone, you go to THEIR HOME (a location). They might not be there if they visited elsewhere. Locations are HOMES, not players.
- KILLING: You can only kill when EXACTLY 2 people are at a location (you + 1 victim) AND you have intent to kill. If > 2 people are present, you cannot kill.
- You can CHOOSE whether to have intent to kill each night (but must have it at least once every two nights).
- If you violate this, (i.e you attempt to indicate no intent two nights in a row), then your action will just be forcibly interpreted as having intent to kill.
- If you indicate a action that doesn't make sense, or doesn't specify a valid action, it will default to staying at your own home with intent to kill.
- There is only ONE murderer (you). All other players are innocents who cannot knowingly lie.

REASONING STYLE: When providing reasoning, be CONCISE. Focus only on your key decision factors.`;
  },

  getNightPrompt(context: RoleContext): string {
    const { agentName, alivePlayers, mustHaveIntent } = context;
    const otherPlayers = alivePlayers.filter(p => p !== agentName);

    if (mustHaveIntent) {
      return `You MUST have "intent to kill" this night (you didn't have intent last night). Where do you go? (stay home / visit [name])`;
    } else {
      return `Where do you go tonight? Do you have intent to kill? (stay home / visit [name], intent: yes/no)`;
    }
  },

  async interpretNightAction(
    rawInput: string,
    context: RoleContext,
    interpretFn: <T>(rawInput: string, prompt: string, schema: any) => Promise<T>
  ): Promise<GameEvent[]> {
    const { agentName, alivePlayers, mustHaveIntent } = context;

    const interpretationPrompt = mustHaveIntent
      ? `The player is ${agentName}. They MUST have "intent to kill" this night (they didn't have intent last night). They can either "stay at their home" (use "${agentName}") or "visit another player's HOME" (${alivePlayers.filter(p => p !== agentName).join(', ')}). If they say something that doesn't make sense or doesn't specify a valid action, default to staying at their own home with intent to kill (use "${agentName}").`
      : `The player is ${agentName}. They can either "stay at their home" (use "${agentName}") or "visit another player's HOME" (${alivePlayers.filter(p => p !== agentName).join(', ')}). They must also specify if they have "intent to kill" (yes/no).`;

    const schema = {
      type: 'OBJECT',
      properties: {
        action: { type: 'STRING', enum: ['stay', 'visit'] },
        targetPlayer: {
          type: 'STRING',
          description: `Name of player whose home to visit. Use "${agentName}" if staying at own home, or another player's name (${alivePlayers.join(', ')}) if visiting.`,
          enum: alivePlayers
        },
        intent: { type: 'BOOLEAN', description: 'Intent to kill' }
      },
      required: ['action', 'targetPlayer']
    };

    const result = await interpretFn<{ interpreted: { action: 'stay' | 'visit'; targetPlayer: string; intent?: boolean }; reasoning: string }>(
      rawInput,
      interpretationPrompt,
      schema
    );

    const events: GameEvent[] = [];

    // MOVE event - where the murderer goes
    const targetHome = toHomeName(result.interpreted.targetPlayer);
    events.push(createMoveEvent(agentName, targetHome));

    // KILL_INTENT event - if murderer wants to kill
    const hasIntent = mustHaveIntent ? true : (result.interpreted.intent || false);
    if (hasIntent) {
      events.push(createKillIntentEvent(agentName));
    }

    return events;
  }
};
