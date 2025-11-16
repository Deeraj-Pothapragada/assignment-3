/**
 * Test the pure game logic (no LLM calls) of the murder mystery game
 *
 * Run with: npx tsx test-murder-mystery-logic.ts
 */

import { MurderMysteryOrchestrator } from './lib/orchestrators/MurderMysteryOrchestrator';

console.log('🧪 Testing Murder Mystery Game Logic\n');

// Test 1: Night resolution - successful kill (2 people at location)
console.log('Test 1: Night Resolution - Successful Kill');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game1 = new MurderMysteryOrchestrator();
game1.setupGame(['Alice', 'Bob', 'Charlie', 'David']);

// Manually set roles for predictable testing
game1.gameState.roles.set('Alice', 'murderer');
game1.gameState.roles.set('Bob', 'innocent');
game1.gameState.roles.set('Charlie', 'innocent');
game1.gameState.roles.set('David', 'innocent');

console.log('Setup:');
console.log('  Alice = murderer');
console.log('  Bob, Charlie, David = innocents\n');

const nightActions1 = [
  { agentName: 'Alice', action: 'visit' as const, targetHome: 'bob_home', intent: true },
  { agentName: 'Bob', action: 'stay' as const, targetHome: 'bob_home', intent: false },
  { agentName: 'Charlie', action: 'stay' as const, targetHome: 'charlie_home', intent: false },
  { agentName: 'David', action: 'stay' as const, targetHome: 'david_home', intent: false }
];

console.log('Night Actions:');
console.log('  Alice visits Bob (with intent to kill)');
console.log('  Bob stays home');
console.log('  Charlie stays home');
console.log('  David stays home\n');

const result1 = game1.resolveNight(nightActions1);

console.log('Results:');
console.log('  Deaths:', result1.deaths);
console.log('  Expected: ["Bob"]');
console.log('  ✓ Match:', JSON.stringify(result1.deaths) === JSON.stringify(['Bob']));
console.log('\n  Observations:');
result1.observations.forEach((obs, agent) => {
  console.log(`    ${agent} at ${obs.home} saw: ${obs.otherPlayers.join(', ') || 'no one'}`);
});
console.log('  ✓ Alice saw Bob: ', result1.observations.get('Alice')?.otherPlayers.includes('Bob'));
console.log('  ✓ Bob saw Alice: ', result1.observations.get('Bob')?.otherPlayers.includes('Alice'));
console.log('  ✓ Murderer not blocked:', !result1.murdererBlocked);
console.log('\n');

// Test 2: Night resolution - blocked kill (3+ people)
console.log('Test 2: Night Resolution - Blocked Kill (3+ people)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game2 = new MurderMysteryOrchestrator();
game2.setupGame(['Alice', 'Bob', 'Charlie', 'David']);
game2.gameState.roles.set('Alice', 'murderer');
game2.gameState.roles.set('Bob', 'innocent');
game2.gameState.roles.set('Charlie', 'innocent');
game2.gameState.roles.set('David', 'innocent');

const nightActions2 = [
  { agentName: 'Alice', action: 'visit' as const, targetHome: 'bob_home', intent: true },
  { agentName: 'Bob', action: 'stay' as const, targetHome: 'bob_home', intent: false },
  { agentName: 'Charlie', action: 'visit' as const, targetHome: 'bob_home', intent: false }, // 3rd person!
  { agentName: 'David', action: 'stay' as const, targetHome: 'david_home', intent: false }
];

console.log('Night Actions:');
console.log('  Alice visits Bob (with intent to kill)');
console.log('  Bob stays home');
console.log('  Charlie visits Bob (3rd person at location!)');
console.log('  David stays home\n');

const result2 = game2.resolveNight(nightActions2);

console.log('Results:');
console.log('  Deaths:', result2.deaths);
console.log('  Expected: [] (kill blocked by 3+ people)');
console.log('  ✓ Match:', result2.deaths.length === 0);
console.log('  ✓ Murderer blocked:', result2.murdererBlocked);
console.log('\n  Observations at Bob\'s location:');
const bobObservers = ['Alice', 'Bob', 'Charlie'];
bobObservers.forEach(agent => {
  const obs = result2.observations.get(agent);
  console.log(`    ${agent} at ${obs?.home} saw: ${obs?.otherPlayers.join(', ') || 'no one'}`);
});
console.log('\n');

// Test 3: Vote resolution - successful hanging
console.log('Test 3: Vote Resolution - Successful Hanging');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game3 = new MurderMysteryOrchestrator();
game3.setupGame(['Alice', 'Bob', 'Charlie', 'David']);
game3.gameState.roles.set('Alice', 'murderer');
game3.gameState.roles.set('Bob', 'innocent');
game3.gameState.roles.set('Charlie', 'innocent');
game3.gameState.roles.set('David', 'innocent');

const votes1 = [
  { agentName: 'Alice', vote: 'Bob' },
  { agentName: 'Bob', vote: 'Alice' },
  { agentName: 'Charlie', vote: 'Alice' },
  { agentName: 'David', vote: 'Alice' }
];

console.log('Votes:');
votes1.forEach(v => console.log(`  ${v.agentName} votes for ${v.vote}`));
console.log('\nVote count: Alice=3, Bob=1');
console.log('Threshold: >50% of 4 = 3 votes needed\n');

const voteResult1 = game3.resolveVoting(votes1);

console.log('Results:');
console.log('  Hanged:', voteResult1.hanged);
console.log('  Role:', voteResult1.role);
console.log('  ✓ Alice hanged:', voteResult1.hanged === 'Alice');
console.log('  ✓ Alice was murderer:', voteResult1.role === 'murderer');
console.log('  ✓ Alice removed from alive list:', !game3.gameState.alive.includes('Alice'));
console.log('\n');

// Test 4: Vote resolution - tie (no hanging)
console.log('Test 4: Vote Resolution - Tie (no hanging)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game4 = new MurderMysteryOrchestrator();
game4.setupGame(['Alice', 'Bob', 'Charlie', 'David']);

const votes2 = [
  { agentName: 'Alice', vote: 'Bob' },
  { agentName: 'Bob', vote: 'Alice' },
  { agentName: 'Charlie', vote: 'Alice' },
  { agentName: 'David', vote: 'Bob' }
];

console.log('Votes:');
votes2.forEach(v => console.log(`  ${v.agentName} votes for ${v.vote}`));
console.log('\nVote count: Alice=2, Bob=2 (TIE)\n');

const voteResult2 = game4.resolveVoting(votes2);

console.log('Results:');
console.log('  Hanged:', voteResult2.hanged);
console.log('  ✓ No one hanged (tie):', voteResult2.hanged === null);
console.log('\n');

// Test 5: Win condition - murderer hanged
console.log('Test 5: Win Condition - Murderer Hanged');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game5 = new MurderMysteryOrchestrator();
game5.setupGame(['Alice', 'Bob', 'Charlie', 'David']);
game5.gameState.roles.set('Alice', 'murderer');
game5.gameState.roles.set('Bob', 'innocent');
game5.gameState.roles.set('Charlie', 'innocent');
game5.gameState.roles.set('David', 'innocent');

// Simulate Alice being hanged
game5.gameState.alive = ['Bob', 'Charlie', 'David'];
game5.gameState.dead = ['Alice'];

const winResult1 = game5.checkWinCondition();

console.log('Game State:');
console.log('  Alive: Bob, Charlie, David (all innocent)');
console.log('  Dead: Alice (murderer)\n');

console.log('Results:');
console.log('  Winner:', winResult1.winner);
console.log('  Reason:', winResult1.reason);
console.log('  ✓ Innocents win:', winResult1.winner === 'innocents');
console.log('\n');

// Test 6: Win condition - 1v1
console.log('Test 6: Win Condition - 1v1 (Murderer Wins)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const game6 = new MurderMysteryOrchestrator();
game6.setupGame(['Alice', 'Bob', 'Charlie', 'David']);
game6.gameState.roles.set('Alice', 'murderer');
game6.gameState.roles.set('Bob', 'innocent');

// Simulate 1v1 situation
game6.gameState.alive = ['Alice', 'Bob'];
game6.gameState.dead = ['Charlie', 'David'];

const winResult2 = game6.checkWinCondition();

console.log('Game State:');
console.log('  Alive: Alice (murderer), Bob (innocent)');
console.log('  Dead: Charlie, David\n');

console.log('Results:');
console.log('  Winner:', winResult2.winner);
console.log('  Reason:', winResult2.reason);
console.log('  ✓ Murderer wins:', winResult2.winner === 'murderer');
console.log('\n');

console.log('✅ All logic tests complete!');
