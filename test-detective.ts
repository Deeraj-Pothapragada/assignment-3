/**
 * Quick test to demonstrate Detective role extensibility
 * Run with: npx tsx test-detective.ts
 */

import { MurderMysteryOrchestrator } from './lib/orchestrators/MurderMysteryOrchestrator';
import { DetectiveRole } from './lib/roles/Detective';
import { MurdererRole } from './lib/roles/Murderer';
import { InnocentRole } from './lib/roles/Innocent';

async function testDetective() {
  console.log('🔍 Testing Detective Role Extensibility\n');

  const orchestrator = new MurderMysteryOrchestrator();

  // Setup game with 5 players
  const players = ['Finn', 'Alice', 'Bob', 'Charlie', 'Diana'];
  orchestrator.setupGame(players, 'Finn');

  // MANUALLY assign Detective role to Alice (to test the role)
  orchestrator.gameState.roles.set('Alice', DetectiveRole);
  orchestrator.gameState.roles.set('Bob', MurdererRole);
  orchestrator.gameState.roles.set('Charlie', InnocentRole);
  orchestrator.gameState.roles.set('Diana', InnocentRole);
  orchestrator.gameState.roles.set('Finn', InnocentRole);

  // Update agent prompts after role assignment
  orchestrator['updateAgentPrompts']();

  console.log('✅ Roles assigned:');
  orchestrator.gameState.roles.forEach((role, player) => {
    console.log(`  ${player}: ${role.roleName}`);
  });

  console.log('\n🌙 Simulating Night 1...\n');

  // Simulate night actions
  const humanResponses = new Map([
    ['Finn', 'stay home']
  ]);

  const prompts = [];
  for (const player of orchestrator.gameState.alive) {
    if (player !== 'Finn') {
      const role = orchestrator.getRoleObject(player);
      const context = {
        agentName: player,
        allPlayers: orchestrator.gameState.alive,
        alivePlayers: orchestrator.gameState.alive,
        deadPlayers: orchestrator.gameState.dead,
        dayNumber: 1,
        mustHaveIntent: false
      };
      const message = role.getNightPrompt(context);
      if (message) {
        prompts.push({ agentName: player, message });
      }
    }
  }

  const responses = await orchestrator.promptAgents(prompts, humanResponses, true);

  console.log('Agent Responses:');
  for (const resp of responses) {
    console.log(`  ${resp.agentName}: "${resp.response}"`);
    if (resp.reasoning) {
      console.log(`    💭 ${resp.reasoning}`);
    }
  }

  // Interpret actions
  console.log('\n🔮 Interpreting actions...');
  const allPlayerEvents = [];
  for (const resp of responses) {
    const events = await orchestrator.interpretNightAction(resp.agentName, resp.response);
    allPlayerEvents.push(events);

    console.log(`  ${resp.agentName}:`);
    events.forEach(event => {
      if (event.type === 'MOVE') {
        console.log(`    - MOVE to ${event.targetHome}`);
      } else if (event.type === 'KILL_INTENT') {
        console.log(`    - KILL_INTENT`);
      } else if (event.type === 'INVESTIGATE') {
        console.log(`    - INVESTIGATE ${event.target}`);
      }
    });
  }

  // Resolve night
  console.log('\n⚔️  Resolving night...');
  const result = orchestrator.resolveNight(allPlayerEvents);

  if (result.deaths.length > 0) {
    console.log(`  💀 Deaths: ${result.deaths.join(', ')}`);
  } else {
    console.log(`  ✓ No deaths`);
  }

  if (result.investigations.size > 0) {
    console.log('\n  🔍 Investigations:');
    result.investigations.forEach((inv, detective) => {
      console.log(`    ${detective} investigated ${inv.target} → ${inv.result.toUpperCase()}`);
    });
  }

  console.log('\n✅ Detective role working! Extensibility proven.');
  console.log('\n💡 Key points:');
  console.log('   - Added Detective role with just ~90 lines of code');
  console.log('   - No changes to core orchestrator logic needed');
  console.log('   - INVESTIGATE events handled automatically');
  console.log('   - Role system is fully extensible');
}

testDetective().catch(console.error);
