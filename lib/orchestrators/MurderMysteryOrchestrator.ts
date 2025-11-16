import { GameOrchestrator, AgentResponse } from './GameOrchestrator';
import { Role, RoleContext } from '../roles/Role';
import { MurdererRole } from '../roles/Murderer';
import { InnocentRole } from '../roles/Innocent';
import { DetectiveRole } from '../roles/Detective';
import { GameEvent, MoveEvent, KillIntentEvent, InvestigateEvent } from '../game/events';

/**
 * MurderMysteryOrchestrator - Game-specific orchestrator for murder mystery game
 *
 * All the game LOGIC lives here (role assignment, night resolution, voting, win conditions)
 * All the LLM/agent communication is handled by the base GameOrchestrator class
 */

type Phase = 'night' | 'day_discussion' | 'day_voting';

interface GameState {
  phase: Phase;
  dayNumber: number;
  roles: Map<string, Role>; // Secret role assignments (Role objects, not strings)
  alive: string[];
  dead: string[];
  murdererHadIntentLastNight: boolean; // Track if murderer requested intent last night
}

interface NightAction {
  agentName: string;
  action: 'stay' | 'visit';
  targetHome: string; // Always a home location (e.g., "alice_home")
  intent?: boolean; // Murderer only: intent to kill
}

// Helper function to convert player name to home location
function toHomeName(playerName: string): string {
  return `${playerName.toLowerCase()}_home`;
}

interface VoteAction {
  agentName: string;
  vote: string | 'abstain';
}

export class MurderMysteryOrchestrator extends GameOrchestrator {
  gameState: GameState;

  constructor() {
    super('You are the Game Master for a murder mystery game. You interpret player inputs and ensure game rules are followed.');
    this.gameState = {
      phase: 'night',
      dayNumber: 1, // Start at day 1 (night_1 will be first night)
      roles: new Map(),
      alive: [],
      dead: [],
      murdererHadIntentLastNight: true // Start true so first night is optional
    };
  }

  /**
   * Initialize game with players
   * @param playerNames - Array of player names
   * @param humanPlayerName - Optional name of human player
   * @param agentConfigs - Optional map of agent name to configuration (model, etc.)
   */
  setupGame(
    playerNames: string[],
    humanPlayerName?: string,
    agentConfigs?: Map<string, { model?: string }>
  ) {
    // Register all agents
    playerNames.forEach(name => {
      const isHuman = name === humanPlayerName;
      const config = agentConfigs?.get(name);
      this.registerAgent(
        name,
        isHuman ? 'human' : 'llm',
        '', // System prompt will be set after role assignment
        config?.model
      );
    });

    this.gameState.alive = [...playerNames];

    // Randomly assign roles
    this.assignRoles(playerNames);

    // Update agent system prompts based on roles
    this.updateAgentPrompts();
  }

  /**
   * GAME LOGIC: Randomly assign 1 murderer, rest innocents
   */
  private assignRoles(playerNames: string[]) {
    const shuffled = [...playerNames].sort(() => Math.random() - 0.5);
    const murdererIndex = Math.floor(Math.random() * shuffled.length);

    shuffled.forEach((name, i) => {
      this.gameState.roles.set(name, i === murdererIndex ? MurdererRole : InnocentRole);
    });
  }

  /**
   * Update agent system prompts based on their roles
   */
  private updateAgentPrompts() {
    this.agents.forEach((agent, name) => {
      if (agent.type === 'llm') {
        const role = this.gameState.roles.get(name)!;
        const context: RoleContext = {
          agentName: name,
          allPlayers: [...this.gameState.alive, ...this.gameState.dead],
          alivePlayers: this.gameState.alive,
          deadPlayers: this.gameState.dead,
          dayNumber: this.gameState.dayNumber
        };

        const prompt = role.getSystemPrompt(context);
        agent.instance!.systemPrompt = prompt;
      }
    });
  }

  /**
   * Get a player's secret role (for private messaging)
   */
  getRole(agentName: string): string {
    return this.gameState.roles.get(agentName)!.roleName;
  }

  /**
   * Get a player's Role object
   */
  getRoleObject(agentName: string): Role {
    return this.gameState.roles.get(agentName)!;
  }

  /**
   * Check if murderer MUST have intent this night (because they didn't last night)
   */
  murdererMustHaveIntent(): boolean {
    return !this.gameState.murdererHadIntentLastNight;
  }

  /**
   * GAME LOGIC: Night resolution
   *
   * Input: Array of arrays of events (one array per player)
   * Output: Who died (if anyone), what each player saw, and investigation results
   */
  resolveNight(playerEvents: GameEvent[][]): {
    deaths: string[];
    observations: Map<string, { home: string; otherPlayers: string[] }>; // agentName -> {home, who they saw}
    murdererBlocked: boolean;
    investigations: Map<string, { target: string; result: string }>; // detective -> {target, role}
  } {
    // Flatten all events
    const allEvents = playerEvents.flat();

    // Build location map from MOVE events
    const locations = new Map<string, string[]>();
    const moveEvents = allEvents.filter(e => e.type === 'MOVE') as MoveEvent[];

    moveEvents.forEach(({ source, targetHome }) => {
      if (!locations.has(targetHome)) locations.set(targetHome, []);
      locations.get(targetHome)!.push(source);
    });

    // Determine kills
    const deaths: string[] = [];
    let murdererBlocked = false;

    // Find KILL_INTENT event
    const killIntentEvent = allEvents.find(e => e.type === 'KILL_INTENT') as KillIntentEvent | undefined;

    // Track if murderer had intent this night
    this.gameState.murdererHadIntentLastNight = !!killIntentEvent;

    if (killIntentEvent) {
      // Murderer has intent to kill - find where they are
      const murdererName = killIntentEvent.source;
      const murdererMoveEvent = moveEvents.find(e => e.source === murdererName);

      if (murdererMoveEvent) {
        const murdererHome = murdererMoveEvent.targetHome;
        const peopleAtLocation = locations.get(murdererHome) || [];

        if (peopleAtLocation.length === 2) {
          // Exactly 2 people: murderer + victim
          const victim = peopleAtLocation.find(name => name !== murdererName);
          if (victim) {
            deaths.push(victim);
          }
        } else if (peopleAtLocation.length >= 3) {
          // 3+ people: kill blocked
          murdererBlocked = true;
        }
      }
    }

    // Build observations (home location + who each player saw)
    const observations = new Map<string, { home: string; otherPlayers: string[] }>();

    moveEvents.forEach(({ source, targetHome }) => {
      const peopleAtLocation = locations.get(targetHome) || [];

      // Player sees everyone at their location EXCEPT themselves
      observations.set(source, {
        home: targetHome,
        otherPlayers: peopleAtLocation.filter(name => name !== source)
      });
    });

    // Handle investigations
    const investigations = new Map<string, { target: string; result: string }>();
    const investigateEvents = allEvents.filter(e => e.type === 'INVESTIGATE') as InvestigateEvent[];

    investigateEvents.forEach(({ source, target }) => {
      // Detective learns the target's role
      const targetRole = this.getRole(target);
      investigations.set(source, { target, result: targetRole });
    });

    // Update game state
    deaths.forEach(name => {
      this.gameState.alive = this.gameState.alive.filter(n => n !== name);
      this.gameState.dead.push(name);
    });

    return { deaths, observations, murdererBlocked, investigations };
  }

  /**
   * GAME LOGIC: Vote resolution
   *
   * Input: Array of votes from all players
   * Output: Who was hanged (if anyone) and their role
   */
  resolveVoting(votes: VoteAction[]): {
    hanged: string | null;
    role: Role | null;
    voteCounts: Map<string, number>;
  } {
    const voteCounts = new Map<string, number>();
    let nonAbstaining = 0;

    votes.forEach(({ vote }) => {
      if (vote !== 'abstain') {
        nonAbstaining++;
        voteCounts.set(vote, (voteCounts.get(vote) || 0) + 1);
      }
    });

    // Find player with most votes
    let maxVotes = 0;
    let hanged: string | null = null;
    let isTie = false;

    voteCounts.forEach((count, name) => {
      if (count > maxVotes) {
        maxVotes = count;
        hanged = name;
        isTie = false;
      } else if (count === maxVotes) {
        isTie = true;
      }
    });

    // Check threshold: need >50% of non-abstaining votes, minimum 2
    const threshold = nonAbstaining > 0 ? Math.floor(nonAbstaining / 2) + 1 : 999;

    if (isTie || maxVotes < threshold || maxVotes < 2) {
      hanged = null;
    }

    let role: Role | null = null;
    if (hanged) {
      role = this.gameState.roles.get(hanged)!;
      this.gameState.alive = this.gameState.alive.filter(n => n !== hanged);
      this.gameState.dead.push(hanged);
    }

    return { hanged, role, voteCounts };
  }

  /**
   * GAME LOGIC: Check win conditions
   */
  checkWinCondition(): { winner: 'innocents' | 'murderer' | null; reason: string } {
    const aliveMurderer = this.gameState.alive.find(name => this.getRole(name) === 'murderer');

    // Murderer was hanged
    if (!aliveMurderer) {
      return { winner: 'innocents', reason: 'Murderer was hanged' };
    }

    // All innocents dead
    const aliveInnocents = this.gameState.alive.filter(name => this.getRole(name) === 'innocent');
    if (aliveInnocents.length === 0) {
      return { winner: 'murderer', reason: 'All innocents are dead' };
    }

    // 1v1 situation
    if (this.gameState.alive.length === 2) {
      return { winner: 'murderer', reason: '1v1 situation reached' };
    }

    return { winner: null, reason: '' };
  }

  /**
   * Use LLM to interpret a player's night action from raw input
   * Now returns GameEvents instead of NightAction
   */
  async interpretNightAction(agentName: string, rawInput: string): Promise<GameEvent[]> {
    const role = this.getRoleObject(agentName);
    const isMurderer = role.roleName === 'murderer';
    const mustHaveIntent = isMurderer && this.murdererMustHaveIntent();

    const context: RoleContext = {
      agentName,
      allPlayers: [...this.gameState.alive, ...this.gameState.dead],
      alivePlayers: this.gameState.alive,
      deadPlayers: this.gameState.dead,
      dayNumber: this.gameState.dayNumber,
      mustHaveIntent // Murderer-specific context
    };

    // Use the role's interpretNightAction method
    const events = await role.interpretNightAction(
      rawInput,
      context,
      this.interpretInput.bind(this)
    );

    return events;
  }

  /**
   * Use LLM to interpret a player's vote from raw input
   */
  async interpretVote(agentName: string, rawInput: string): Promise<VoteAction> {
    const prompt = `The player is voting to hang someone, or abstaining. Available players: ${this.gameState.alive.filter(n => n !== agentName).join(', ')}, or "abstain".`;

    const schema = {
      type: 'OBJECT',
      properties: {
        vote: { type: 'STRING', description: 'Name of player to vote for, or "abstain"' }
      },
      required: ['vote']
    };

    const result = await this.interpretInput<{ vote: string }>(rawInput, prompt, schema);

    return {
      agentName,
      vote: result.interpreted.vote
    };
  }
}
