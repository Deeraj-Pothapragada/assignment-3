/**
 * Simple test script to verify IsolatedAgent and SimpleTestOrchestrator work correctly.
 *
 * Run with: npx tsx test-orchestrator.ts
 */

import { IsolatedAgent } from './lib/agents/IsolatedAgent';
import { SimpleTestOrchestrator } from './lib/orchestrators/SimpleTestOrchestrator';

async function main() {
  console.log('=== Testing IsolatedAgent and SimpleTestOrchestrator ===\n');

  // Create two agents with different personas
  const agentAlice = new IsolatedAgent(
    'Alice',
    'You are Alice, a friendly and enthusiastic person. You love making new friends and are always cheerful.'
  );

  const agentBob = new IsolatedAgent(
    'Bob',
    'You are Bob, a cautious and thoughtful person. You take time to warm up to people and prefer to observe before engaging.'
  );

  console.log('Created agents:');
  console.log(`- ${agentAlice.name}: Friendly and enthusiastic`);
  console.log(`- ${agentBob.name}: Cautious and thoughtful\n`);

  // Create orchestrator
  const orchestrator = new SimpleTestOrchestrator([agentAlice, agentBob]);

  // Run test conversation
  console.log('Running test conversation...\n');
  const result = await orchestrator.runTestConversation();

  // Display results
  console.log('\n=== Conversation Results ===\n');
  result.results.forEach((entry, i) => {
    console.log(`${i + 1}. ${entry.speaker}:`);
    console.log(`   ${entry.message}\n`);
  });

  // Display agent histories (to verify isolation)
  console.log('\n=== Agent Context Verification ===\n');
  console.log(`Alice's conversation history (${agentAlice.getHistory().length} messages):`);
  agentAlice.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text.substring(0, 100)}...`);
  });

  console.log(`\nBob's conversation history (${agentBob.getHistory().length} messages):`);
  agentBob.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text.substring(0, 100)}...`);
  });

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
