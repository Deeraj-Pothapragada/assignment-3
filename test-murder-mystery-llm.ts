/**
 * Test the LLM input interpretation (fuzzy matching, intent recognition)
 *
 * Run with: npx tsx test-murder-mystery-llm.ts
 */

import { MurderMysteryOrchestrator } from './lib/orchestrators/MurderMysteryOrchestrator';

console.log('🧪 Testing Murder Mystery LLM Input Interpretation\n');

async function runTests() {
  const game = new MurderMysteryOrchestrator();
  game.setupGame(['Alice', 'Bob', 'Charlie', 'Finn'], 'Finn');

  // Set Alice as murderer for testing
  game.gameState.roles.set('Alice', 'murderer');
  game.gameState.roles.set('Bob', 'innocent');
  game.gameState.roles.set('Charlie', 'innocent');
  game.gameState.roles.set('Finn', 'innocent');

  console.log('Setup:');
  console.log('  Players: Alice (murderer), Bob, Charlie, Finn (all innocent)');
  console.log('  Finn is the human player\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Fuzzy name matching
  console.log('Test 1: Fuzzy Name Matching');
  console.log('─────────────────────────────');

  const testInputs = [
    'i visit bob',
    'Visit BOB',
    'visit bobby',
    'i want to go to bobs house',
    'visiting charlie tonight',
    'stay home',
    'staying at my place',
    'ima stay here'
  ];

  for (const input of testInputs) {
    const result = await game.interpretNightAction('Finn', input);
    console.log(`\nInput: "${input}"`);
    console.log(`  Action: ${result.action}`);
    console.log(`  Target Home: ${result.targetHome}`);
    console.log(`  Intent: ${result.intent}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 2: Murderer with intent to kill
  console.log('Test 2: Murderer Intent to Kill');
  console.log('─────────────────────────────');

  const murdererInputs = [
    'visit bob with intent to kill',
    'i want to kill charlie',
    'going to bob, not killing',
    'stay home, ready to kill',
    'visit alice but just to talk'
  ];

  for (const input of murdererInputs) {
    const result = await game.interpretNightAction('Alice', input);
    console.log(`\nInput: "${input}"`);
    console.log(`  Action: ${result.action}`);
    console.log(`  Target Home: ${result.targetHome}`);
    console.log(`  Intent to kill: ${result.intent}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 3: Vote interpretation
  console.log('Test 3: Vote Interpretation');
  console.log('─────────────────────────────');

  const voteInputs = [
    'i vote alice',
    'Alice',
    'vote for bobby',
    'abstain',
    'i dont want to vote',
    'charlie is sus, voting them',
    'alicee' // typo
  ];

  for (const input of voteInputs) {
    const result = await game.interpretVote('Finn', input);
    console.log(`\nInput: "${input}"`);
    console.log(`  Vote: ${result.vote}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('✅ All LLM interpretation tests complete!');
}

runTests().catch(console.error);
