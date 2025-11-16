/**
 * Role Interface - Self-contained role definitions
 *
 * Each role is a module that defines:
 * 1. What the agent should know (system prompt)
 * 2. What actions they can take (night prompt)
 * 3. How to interpret their input into events
 */

import { GameEvent } from '../game/events';

/**
 * Context passed to role methods
 */
export interface RoleContext {
  agentName: string;
  allPlayers: string[];
  alivePlayers: string[];
  deadPlayers: string[];
  dayNumber: number;
  [key: string]: any; // Allow role-specific context
}

/**
 * Role definition
 */
export interface Role {
  /**
   * Unique role identifier
   */
  roleName: string;

  /**
   * Alignment (used for win conditions)
   */
  alignment: 'town' | 'mafia' | 'neutral';

  /**
   * Generate system prompt for an agent with this role
   *
   * @param context - Game context (agent name, player list, etc.)
   * @returns Full system prompt for the agent
   */
  getSystemPrompt(context: RoleContext): string;

  /**
   * Generate night action prompt for this role
   *
   * @param context - Game context including role-specific state
   * @returns Prompt to send to the agent during night phase
   */
  getNightPrompt(context: RoleContext): string | null; // null if role doesn't act at night

  /**
   * Interpret raw agent response into game events
   *
   * @param rawInput - The agent's raw text response
   * @param context - Game context
   * @param interpretFn - LLM interpretation function from orchestrator
   * @returns Array of events emitted by this action
   */
  interpretNightAction(
    rawInput: string,
    context: RoleContext,
    interpretFn: <T>(rawInput: string, prompt: string, schema: any) => Promise<T>
  ): Promise<GameEvent[]>;

  /**
   * Optional: Get discussion prompt for day phase
   */
  getDiscussionPrompt?(context: RoleContext): string;

  /**
   * Optional: Get voting prompt for day phase
   */
  getVotingPrompt?(context: RoleContext): string;
}

/**
 * Helper to convert player name to home location
 */
export function toHomeName(playerName: string): string {
  return `${playerName.toLowerCase()}_home`;
}
