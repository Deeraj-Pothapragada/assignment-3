/**
 * Test to prove context isolation between agents.
 *
 * Scenario:
 * 1. Orchestrator tells Alice two secret numbers (7 and 13)
 * 2. Alice can only tell Bob ONE of those numbers
 * 3. Orchestrator asks Bob to calculate the product of Alice's TWO numbers
 * 4. Bob should fail unless he can see Alice's private context (or gets lucky)
 *
 * Run with: npx tsx test-context-isolation.ts
 */

import { IsolatedAgent } from './lib/agents/IsolatedAgent';

async function main() {
  console.log('=== Testing Context Isolation ===\n');

  const secretNum1 = 7;
  const secretNum2 = 13;
  const correctProduct = secretNum1 * secretNum2; // 91

  // Create Alice
  const alice = new IsolatedAgent(
    'Alice',
    'You are Alice. Follow instructions exactly. Be concise.'
  );

  // Create Bob
  const bob = new IsolatedAgent(
    'Bob',
    'You are Bob. Use all information available to you to answer questions. Look at everything in your context and memory. Be clever and thorough.'
  );

  console.log(`Secret numbers given to Alice: ${secretNum1} and ${secretNum2}`);
  console.log(`Correct product: ${correctProduct}\n`);

  // Step 1: Tell Alice the two secret numbers, ask her to share only ONE with Bob
  console.log('[Orchestrator → Alice] "You have two secret numbers: 7 and 13. Tell Bob only ONE of them (your choice). Do not reveal the other number."\n');

  const aliceResponse = await alice.respond(
    `You have two secret numbers: ${secretNum1} and ${secretNum2}. Tell Bob only ONE of them (your choice which one). Do not reveal the other number. Just state which number you're sharing, nothing else.`
  );

  console.log(`[Alice → Orchestrator] "${aliceResponse.text}"\n`);

  // Step 2: Tell Bob what Alice said, then ask him to calculate the product
  console.log(`[Orchestrator → Bob] Relaying Alice's message and asking for product...\n`);

  const bobResponse = await bob.respond(
    `Alice said: "${aliceResponse.text}"\n\nWhat is the product of Alice's two numbers? Just give the number, nothing else.`
  );

  console.log(`[Bob → Orchestrator] "${bobResponse.text}"\n`);

  // Step 3: Check if Bob got it right
  console.log('=== Results ===\n');

  // Try to extract a number from Bob's response
  const bobAnswerMatch = bobResponse.text.match(/\d+/);
  const bobAnswer = bobAnswerMatch ? parseInt(bobAnswerMatch[0]) : null;

  console.log(`Bob's answer: ${bobAnswer}`);
  console.log(`Correct answer: ${correctProduct}`);

  if (bobAnswer === correctProduct) {
    console.log('\n⚠️  WARNING: Bob got it RIGHT! This suggests:');
    console.log('   - Either context isolation is BROKEN (Bob can see Alice\'s context)');
    console.log('   - Or Bob got extremely lucky with a guess');
  } else {
    console.log('\n✅ SUCCESS: Bob got it WRONG! This proves:');
    console.log('   - Context isolation is working correctly');
    console.log('   - Bob cannot see Alice\'s private context');
  }

  // Show what each agent knows
  console.log('\n=== Agent Contexts ===\n');

  console.log('Alice\'s conversation history:');
  alice.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text}`);
  });

  console.log('\nBob\'s conversation history:');
  bob.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text}`);
  });
}

main().catch(console.error);
