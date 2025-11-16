/**
 * Test harness for Murder Mystery game
 * Run with: npx tsx test-game.ts
 */

import { MurderMysteryOrchestrator } from './lib/orchestrators/MurderMysteryOrchestrator';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class GameTester {
  private orchestrator: MurderMysteryOrchestrator;
  private humanPlayer: string = 'Finn';

  constructor() {
    this.orchestrator = new MurderMysteryOrchestrator();
  }

  async runGame() {
    console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════╗`);
    console.log(`║  MURDER MYSTERY GAME TEST          ║`);
    console.log(`╚════════════════════════════════════╝${colors.reset}\n`);

    // Setup game
    const players = ['Finn', 'Alice', 'Bob', 'Charlie'];
    this.orchestrator.setupGame(players, this.humanPlayer);

    console.log(`${colors.green}✓ Game setup complete${colors.reset}`);
    console.log(`Players: ${players.join(', ')}\n`);

    // Show initial roles (omniscient view)
    this.showRoles();

    // Run game loop
    let turn = 0;
    while (!this.isGameOver() && turn < 5) {
      turn++;
      console.log(`\n${colors.bright}${colors.yellow}╭─────────────────────────────────────╮`);
      console.log(`│ TURN ${turn} - ${this.orchestrator.gameState.phase.toUpperCase()}${' '.repeat(30 - this.orchestrator.gameState.phase.length)}│`);
      console.log(`╰─────────────────────────────────────╯${colors.reset}\n`);

      const phase = this.orchestrator.gameState.phase;

      if (phase === 'night') {
        await this.runNight();
      } else if (phase === 'day_discussion') {
        await this.runDiscussion();
      } else if (phase === 'day_voting') {
        await this.runVoting();
      }

      // Show game state after each turn
      this.showGameState();

      // Check for game over
      const result = this.orchestrator.checkWinCondition();
      if (result.winner) {
        break;
      }
    }

    console.log(`\n${colors.bright}${colors.magenta}╔════════════════════════════════════╗`);
    console.log(`║  GAME OVER                         ║`);
    console.log(`╚════════════════════════════════════╝${colors.reset}\n`);
    this.showWinner();
  }

  private async runNight() {
    console.log(`${colors.blue}🌙 NIGHT ${this.orchestrator.gameState.dayNumber}${colors.reset}\n`);

    const alive = this.orchestrator.gameState.alive;

    // Get actions from all alive players
    const prompts = [];
    const humanResponses = new Map<string, string>();

    // Human player action (simulated)
    const others = alive.filter(p => p !== this.humanPlayer);
    const randomTarget = others[Math.floor(Math.random() * others.length)];
    humanResponses.set(this.humanPlayer, Math.random() > 0.5 ? 'stay home' : `visit ${randomTarget}`);

    console.log(`${colors.yellow}Human (${this.humanPlayer}): "${humanResponses.get(this.humanPlayer)}"${colors.reset}\n`);

    // Prompt LLM agents
    for (const player of alive) {
      if (player !== this.humanPlayer) {
        const isMurderer = this.orchestrator.getRole(player) === 'murderer';
        const mustHaveIntent = isMurderer && this.orchestrator.murdererMustHaveIntent();

        const message = isMurderer
          ? (mustHaveIntent
              ? `You MUST have intent to kill tonight. Where do you go? (stay home / visit [name])`
              : `Where do you go tonight? Do you have intent to kill? (stay home / visit [name], intent: yes/no)`)
          : `Where do you go tonight? (stay home / visit [name])`;

        prompts.push({ agentName: player, message });
      }
    }

    // Get responses
    const responses = await this.orchestrator.promptAgents(prompts, humanResponses, true);

    // Show all responses with reasoning
    console.log(colors.bright + 'Agent Responses:' + colors.reset);
    for (const resp of responses) {
      const role = this.orchestrator.getRole(resp.agentName);
      const roleColor = role === 'murderer' ? colors.red : colors.green;
      console.log(`  ${roleColor}${resp.agentName}${colors.reset}: "${resp.response}"`);
      if (resp.reasoning) {
        console.log(`    ${colors.dim}${colors.magenta}💭 ${resp.reasoning}${colors.reset}`);
      }
    }

    // Interpret actions
    console.log(`\n${colors.cyan}Interpreting actions...${colors.reset}`);
    const allPlayerEvents = [];
    for (const resp of responses) {
      const events = await this.orchestrator.interpretNightAction(resp.agentName, resp.response);
      allPlayerEvents.push(events);

      // Display interpreted events
      const moveEvent = events.find(e => e.type === 'MOVE');
      const killIntentEvent = events.find(e => e.type === 'KILL_INTENT');

      if (moveEvent && 'targetHome' in moveEvent) {
        const intentText = killIntentEvent ? `${colors.red} [INTENT TO KILL]${colors.reset}` : '';
        console.log(`  ${resp.agentName}: visit → ${moveEvent.targetHome}${intentText}`);
      }
    }

    // Resolve night
    console.log(`\n${colors.bright}${colors.blue}Resolving night...${colors.reset}`);
    const result = this.orchestrator.resolveNight(allPlayerEvents);

    if (result.deaths.length > 0) {
      console.log(`\n${colors.red}${colors.bright}💀 DEATHS: ${result.deaths.join(', ')}${colors.reset}`);
    } else if (result.murdererBlocked) {
      console.log(`\n${colors.yellow}⚠️  Murder attempt blocked (3+ people at location)${colors.reset}`);
    } else {
      console.log(`\n${colors.green}✓ No deaths this night${colors.reset}`);
    }

    // Show observations
    console.log(`\n${colors.cyan}Observations:${colors.reset}`);
    result.observations.forEach((obs, player) => {
      const others = obs.otherPlayers.length > 0
        ? `saw: ${obs.otherPlayers.join(', ')}`
        : 'alone';
      console.log(`  ${player} at ${obs.home} - ${others}`);
    });

    // Show investigation results (if any)
    if (result.investigations.size > 0) {
      console.log(`\n${colors.magenta}${colors.bright}🔍 Investigation Results:${colors.reset}`);
      result.investigations.forEach((investigation, detective) => {
        const roleColor = investigation.result === 'murderer' ? colors.red : colors.green;
        console.log(`  ${detective} investigated ${investigation.target}: ${roleColor}${investigation.result.toUpperCase()}${colors.reset}`);

        // Notify the detective privately
        this.orchestrator.notifyAgent(
          detective,
          `You investigated ${investigation.target} and discovered they are ${investigation.result.toUpperCase()}.`
        );
      });
    }

    // Notify all agents about night result (no response needed)
    let publicMessage = `Night ${this.orchestrator.gameState.dayNumber} has ended. `;
    if (result.deaths.length > 0) {
      publicMessage += `${result.deaths.join(', ')} was found dead!`;
    } else {
      publicMessage += `Everyone survived the night.`;
    }

    // Notify each agent individually (only LLM agents maintain history)
    this.orchestrator.gameState.alive.forEach(player => {
      this.orchestrator.notifyAgent(player, publicMessage);
    });

    // Advance to day discussion
    this.orchestrator.gameState.phase = 'day_discussion';
  }

  private async runDiscussion() {
    console.log(`${colors.green}☀️  DAY ${this.orchestrator.gameState.dayNumber} - DISCUSSION${colors.reset}\n`);

    const alive = this.orchestrator.gameState.alive;

    // Simulate discussion
    const prompts = [];
    const humanResponses = new Map<string, string>();
    humanResponses.set(this.humanPlayer, "I stayed home last night and saw nothing suspicious.");

    for (const player of alive) {
      if (player !== this.humanPlayer) {
        prompts.push({
          agentName: player,
          message: `Day ${this.orchestrator.gameState.dayNumber} discussion. Share what you saw last night and who you suspect. Be concise.`
        });
      }
    }

    const responses = await this.orchestrator.promptAgents(prompts, humanResponses, true);

    console.log(colors.bright + 'Discussion:' + colors.reset);
    for (const resp of responses) {
      const role = this.orchestrator.getRole(resp.agentName);
      const roleColor = role === 'murderer' ? colors.red : colors.green;
      console.log(`\n  ${roleColor}${resp.agentName}${colors.reset}: "${resp.response}"`);
      if (resp.reasoning) {
        console.log(`  ${colors.dim}${colors.magenta}💭 ${resp.reasoning}${colors.reset}`);
      }
    }

    // Advance to voting
    this.orchestrator.gameState.phase = 'day_voting';
  }

  private async runVoting() {
    console.log(`\n${colors.red}🗳️  VOTING${colors.reset}\n`);

    const alive = this.orchestrator.gameState.alive;

    // Simulate votes
    const prompts = [];
    const voteOptions = alive.filter(p => p !== this.humanPlayer);
    const randomVote = voteOptions[Math.floor(Math.random() * voteOptions.length)];
    const humanResponses = new Map<string, string>();
    humanResponses.set(this.humanPlayer, randomVote);

    for (const player of alive) {
      if (player !== this.humanPlayer) {
        const options = alive.filter(p => p !== player);
        prompts.push({
          agentName: player,
          message: `Vote to eliminate someone or abstain. Options: ${options.join(', ')}, abstain`
        });
      }
    }

    const responses = await this.orchestrator.promptAgents(prompts, humanResponses, true);

    console.log(colors.bright + 'Votes:' + colors.reset);
    for (const resp of responses) {
      const role = this.orchestrator.getRole(resp.agentName);
      const roleColor = role === 'murderer' ? colors.red : colors.green;
      console.log(`  ${roleColor}${resp.agentName}${colors.reset} → "${resp.response}"`);
      if (resp.reasoning) {
        console.log(`    ${colors.dim}${colors.magenta}💭 ${resp.reasoning}${colors.reset}`);
      }
    }

    // Interpret votes
    console.log(`\n${colors.cyan}Interpreting votes...${colors.reset}`);
    const votes = [];
    for (const resp of responses) {
      const vote = await this.orchestrator.interpretVote(resp.agentName, resp.response);
      votes.push(vote);
      console.log(`  ${resp.agentName} votes for: ${vote.vote}`);
    }

    // Resolve voting
    const result = this.orchestrator.resolveVoting(votes);

    console.log(`\n${colors.bright}Vote Counts:${colors.reset}`);
    result.voteCounts.forEach((count, name) => {
      console.log(`  ${name}: ${count} vote(s)`);
    });

    if (result.hanged) {
      const roleName = result.role!.roleName;
      const roleColor = roleName === 'murderer' ? colors.red : colors.green;
      console.log(`\n${colors.red}${colors.bright}⚖️  ${result.hanged} was hanged!${colors.reset}`);
      console.log(`${colors.bright}Revealed role: ${roleColor}${roleName.toUpperCase()}${colors.reset}`);

      // Notify all agents of result
      const message = `${result.hanged} was voted out and hanged. They were ${roleName}.`;
      this.orchestrator.gameState.alive.forEach(player => {
        this.orchestrator.notifyAgent(player, message);
      });
    } else {
      console.log(`\n${colors.yellow}No one was hanged (no majority)${colors.reset}`);
      const message = `No one received enough votes. No one was hanged.`;
      this.orchestrator.gameState.alive.forEach(player => {
        this.orchestrator.notifyAgent(player, message);
      });
    }

    // Advance to next night
    this.orchestrator.gameState.dayNumber++;
    this.orchestrator.gameState.phase = 'night';
  }

  private showRoles() {
    console.log(colors.bright + colors.yellow + '🔍 OMNISCIENT VIEW - Role Assignment:' + colors.reset);

    for (const [player, role] of this.orchestrator.gameState.roles.entries()) {
      const roleColor = role.roleName === 'murderer' ? colors.red : colors.green;
      console.log(`  ${player}: ${roleColor}${colors.bright}${role.roleName.toUpperCase()}${colors.reset}`);
    }
    console.log('');
  }

  private showGameState() {
    console.log(`\n${colors.dim}${colors.cyan}─────────────────────────────────────${colors.reset}`);
    console.log(`${colors.cyan}Game State:${colors.reset}`);
    console.log(`  Phase: ${this.orchestrator.gameState.phase}`);
    console.log(`  Day: ${this.orchestrator.gameState.dayNumber}`);
    console.log(`  Alive: ${this.orchestrator.gameState.alive.join(', ')}`);
    if (this.orchestrator.gameState.dead.length > 0) {
      console.log(`  Dead: ${colors.red}${this.orchestrator.gameState.dead.join(', ')}${colors.reset}`);
    }
    console.log(`${colors.dim}${colors.cyan}─────────────────────────────────────${colors.reset}`);
  }

  private showWinner() {
    const result = this.orchestrator.checkWinCondition();
    if (result.winner) {
      const winColor = result.winner === 'murderer' ? colors.red : colors.green;
      console.log(`${winColor}${colors.bright}Winner: ${result.winner.toUpperCase()}${colors.reset}`);
      console.log(`Reason: ${result.reason}\n`);

      if (result.winner === 'murderer') {
        const murderer = Array.from(this.orchestrator.gameState.roles.entries())
          .find(([_, role]) => role.roleName === 'murderer')?.[0];
        console.log(`The murderer was: ${colors.red}${colors.bright}${murderer}${colors.reset}`);
      }
    }
  }

  private isGameOver(): boolean {
    return this.orchestrator.checkWinCondition().winner !== null;
  }

  // Debug method to show agent context
  async showAgentContext(playerName: string) {
    console.log(`\n${colors.cyan}🔍 Agent Context: ${playerName}${colors.reset}`);

    const agent = this.orchestrator['agents'].get(playerName);
    if (!agent || agent.type === 'human') {
      console.log('  (Human player - no LLM context)');
      return;
    }

    const history = agent.instance?.getHistory();
    if (history) {
      console.log('  Conversation History:');
      for (const msg of history) {
        const role = msg.role === 'user' ? `${colors.yellow}[Orchestrator]${colors.reset}` : `${colors.blue}[${playerName}]${colors.reset}`;
        const text = msg.parts[0].text;
        const preview = text.length > 150 ? text.substring(0, 150) + '...' : text;
        console.log(`    ${role}: ${preview}`);
      }
    }
  }
}

// Run the test
async function main() {
  const tester = new GameTester();

  try {
    await tester.runGame();
  } catch (error) {
    console.error(`\n${colors.red}${colors.bright}ERROR:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
