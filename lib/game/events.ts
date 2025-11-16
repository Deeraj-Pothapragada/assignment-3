/**
 * Event System for Multi-Role Game
 *
 * Roles emit events during their actions, and the orchestrator resolves them.
 * This allows for clean separation: roles define WHAT happens, orchestrator defines HOW to resolve.
 */

/**
 * Base event - all events have a source player
 */
export interface BaseEvent {
  type: string;
  source: string; // Player who emitted this event
}

/**
 * MOVE event - player goes to a location (home)
 * All players emit this event every night
 */
export interface MoveEvent extends BaseEvent {
  type: 'MOVE';
  targetHome: string; // Location the player moves to
}

/**
 * KILL_INTENT event - murderer declares intent to kill
 * Murderer emits this when they want to attempt a kill
 */
export interface KillIntentEvent extends BaseEvent {
  type: 'KILL_INTENT';
}

/**
 * INVESTIGATE event - detective investigates a player's role
 * Detective emits this to learn someone's role
 */
export interface InvestigateEvent extends BaseEvent {
  type: 'INVESTIGATE';
  target: string; // Player to investigate
}

/**
 * PROTECT event - doctor protects a player from death
 * Doctor emits this to save someone
 */
export interface ProtectEvent extends BaseEvent {
  type: 'PROTECT';
  target: string; // Player to protect
}

/**
 * BLOCK event - roleblocker prevents a player's action
 * Roleblocker emits this to block someone
 */
export interface BlockEvent extends BaseEvent {
  type: 'BLOCK';
  target: string; // Player to block
}

/**
 * Union type of all possible events
 */
export type GameEvent =
  | MoveEvent
  | KillIntentEvent
  | InvestigateEvent
  | ProtectEvent
  | BlockEvent;

/**
 * Collection of events emitted by a player in one phase
 */
export interface PlayerEvents {
  agentName: string;
  events: GameEvent[];
}

/**
 * Helper functions to create events
 */
export const createMoveEvent = (source: string, targetHome: string): MoveEvent => ({
  type: 'MOVE',
  source,
  targetHome
});

export const createKillIntentEvent = (source: string): KillIntentEvent => ({
  type: 'KILL_INTENT',
  source
});

export const createInvestigateEvent = (source: string, target: string): InvestigateEvent => ({
  type: 'INVESTIGATE',
  source,
  target
});

export const createProtectEvent = (source: string, target: string): ProtectEvent => ({
  type: 'PROTECT',
  source,
  target
});

export const createBlockEvent = (source: string, target: string): BlockEvent => ({
  type: 'BLOCK',
  source,
  target
});
