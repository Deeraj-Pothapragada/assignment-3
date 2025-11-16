/**
 * Detective Role
 *
 * Goal: Identify the murderer by investigating players
 * Night Action: Investigate a player to learn their role
 * Ability: Can discover if a player is murderer or innocent
 */

import { Role, RoleContext, toHomeName } from './Role';
import { GameEvent, createMoveEvent, createInvestigateEvent } from '../game/events';

export const DetectiveRole: Role = {
  roleName: 'detective',
  alignment: 'town',

  getSystemPrompt(context: RoleContext): string {
    const { agentName, allPlayers } = context;

    return `You are ${agentName}, the DETECTIVE. Your goal is to identify and vote out the murderer by investigating players. Each night you can investigate one player to learn their role (murderer or innocent). Use this information strategically during discussions. Share your findings carefully to avoid being targeted.

GAME RULES YOU MUST KNOW:
- PLAYERS IN GAME: ${allPlayers.join(', ')}. Only these players exist - do not mention other names.
- INVESTIGATION: Each night you can investigate ONE player to learn if they are the murderer or innocent. This happens privately.
- LOCATIONS: When you "visit" someone for investigation, you go to THEIR HOME to investigate them. They might not be there if they visited elsewhere.
- KILLING: The murderer can only kill when EXACTLY 2 people are at a location (murderer + victim). If > 2 people are present, the murderer cannot kill.
- The murderer can CHOOSE whether to kill each night. A night with no deaths does NOT mean there's no murderer.
- There is only ONE murderer. All other players (including you and other innocents) cannot knowingly lie.
- STRATEGY: You can choose to reveal your investigation results publicly, or keep them secret. Be strategic about when to reveal your role.

REASONING STYLE: When providing reasoning, be CONCISE. Focus only on your key decision factors.`;
  },

  getNightPrompt(context: RoleContext): string {
    const { alivePlayers, agentName } = context;
    const others = alivePlayers.filter(p => p !== agentName);

    return `Who do you want to investigate tonight? Choose one player: ${others.join(', ')}`;
  },

  async interpretNightAction(
    rawInput: string,
    context: RoleContext,
    interpretFn: <T>(rawInput: string, prompt: string, schema: any) => Promise<T>
  ): Promise<GameEvent[]> {
    const { agentName, alivePlayers } = context;
    const otherPlayers = alivePlayers.filter(p => p !== agentName);

    const interpretationPrompt = `The player is ${agentName}, the DETECTIVE. They need to choose ONE player to investigate. Available players: ${otherPlayers.join(', ')}.`;

    const schema = {
      type: 'OBJECT',
      properties: {
        target: {
          type: 'STRING',
          description: `Name of player to investigate. Choose from: ${otherPlayers.join(', ')}.`,
          enum: otherPlayers
        }
      },
      required: ['target']
    };

    const result = await interpretFn<{ interpreted: { target: string }; reasoning: string }>(
      rawInput,
      interpretationPrompt,
      schema
    );

    const events: GameEvent[] = [];
    const target = result.interpreted.target;

    // MOVE event - detective goes to target's home to investigate
    const targetHome = toHomeName(target);
    events.push(createMoveEvent(agentName, targetHome));

    // INVESTIGATE event - detective investigates the target
    events.push(createInvestigateEvent(agentName, target));

    return events;
  }
};
