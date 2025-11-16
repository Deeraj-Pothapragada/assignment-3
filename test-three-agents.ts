/**
 * Test with THREE agents in parallel.
 *
 * Flow:
 * 1. Orchestrator asks Alice, Bob, and Charlie to each pick a number (1-10) - IN PARALLEL
 * 2. Orchestrator computes the sum
 * 3. Orchestrator asks each agent what the sum is
 * 4. Each agent should fail (they only know their own number)
 *
 * Run with: npx tsx test-three-agents.ts
 */

import { IsolatedAgent } from './lib/agents/IsolatedAgent';

async function main() {
  console.log('=== Testing Three Agents in Parallel ===\n');

  // Create three agents with non-obvious names
  const genji = new IsolatedAgent(
    'Genji',
    'You are Genji. Use all information available to you. Be clever and thorough in your answers.'
  );

  const hanzo = new IsolatedAgent(
    'Hanzo',
    'You are Hanzo. Use all information available to you. Be clever and thorough in your answers.'
  );

  const kendrick = new IsolatedAgent(
    'Kendrick',
    'You are Kendrick. Use all information available to you. Be clever and thorough in your answers.'
  );

  // Step 1: Ask all three agents to pick a number IN PARALLEL
  console.log('[Orchestrator] Asking all agents to pick a number from 1-10 (in parallel)...\n');

  const [genjiResponse, hanzoResponse, kendrickResponse] = await Promise.all([
    genji.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.'),
    hanzo.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.'),
    kendrick.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.')
  ]);

  console.log(`[Genji] picked: ${genjiResponse.text}`);
  console.log(`[Hanzo] picked: ${hanzoResponse.text}`);
  console.log(`[Kendrick] picked: ${kendrickResponse.text}\n`);

  // Extract numbers
  const genjiNum = parseInt(genjiResponse.text.match(/\d+/)?.[0] || '0');
  const hanzoNum = parseInt(hanzoResponse.text.match(/\d+/)?.[0] || '0');
  const kendrickNum = parseInt(kendrickResponse.text.match(/\d+/)?.[0] || '0');
  const correctSum = genjiNum + hanzoNum + kendrickNum;

  console.log(`[Orchestrator] Computed sum: ${genjiNum} + ${hanzoNum} + ${kendrickNum} = ${correctSum}\n`);

  // Step 2: Ask each agent what the sum is (in parallel) - WITH REASONING
  console.log('[Orchestrator] Asking each agent what the sum of all three numbers is (with reasoning)...\n');

  const [genjiGuess, hanzoGuess, kendrickGuess] = await Promise.all([
    genji.respond('What is the sum of all three agents\' numbers?', true), // includeReasoning = true
    hanzo.respond('What is the sum of all three agents\' numbers?', true),
    kendrick.respond('What is the sum of all three agents\' numbers?', true)
  ]);

  console.log(`[Genji]`);
  console.log(`  Reasoning: ${genjiGuess.reasoning}`);
  console.log(`  Answer: ${genjiGuess.text}\n`);

  console.log(`[Hanzo]`);
  console.log(`  Reasoning: ${hanzoGuess.reasoning}`);
  console.log(`  Answer: ${hanzoGuess.text}\n`);

  console.log(`[Kendrick]`);
  console.log(`  Reasoning: ${kendrickGuess.reasoning}`);
  console.log(`  Answer: ${kendrickGuess.text}\n`);

  // Extract guesses
  const genjiGuessNum = parseInt(genjiGuess.text.match(/\d+/)?.[0] || '0');
  const hanzoGuessNum = parseInt(hanzoGuess.text.match(/\d+/)?.[0] || '0');
  const kendrickGuessNum = parseInt(kendrickGuess.text.match(/\d+/)?.[0] || '0');

  // Step 3: Check results
  console.log('=== Results ===\n');
  console.log(`Correct sum: ${correctSum}`);
  console.log(`Genji guessed: ${genjiGuessNum} - ${genjiGuessNum === correctSum ? '⚠️  CORRECT (possible leak!)' : '✅ WRONG (isolated)'}`);
  console.log(`Hanzo guessed: ${hanzoGuessNum} - ${hanzoGuessNum === correctSum ? '⚠️  CORRECT (possible leak!)' : '✅ WRONG (isolated)'}`);
  console.log(`Kendrick guessed: ${kendrickGuessNum} - ${kendrickGuessNum === correctSum ? '⚠️  CORRECT (possible leak!)' : '✅ WRONG (isolated)'}`);

  const allWrong = genjiGuessNum !== correctSum && hanzoGuessNum !== correctSum && kendrickGuessNum !== correctSum;

  if (allWrong) {
    console.log('\n✅ SUCCESS: All agents got it wrong! Context isolation is working.');
  } else {
    console.log('\n⚠️  WARNING: At least one agent got it right. Possible context leak or lucky guess.');
  }

  // Show each agent's context
  console.log('\n=== Agent Contexts ===\n');

  console.log('Genji\'s conversation history:');
  genji.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text}`);
  });

  console.log('\nHanzo\'s conversation history:');
  hanzo.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text}`);
  });

  console.log('\nKendrick\'s conversation history:');
  kendrick.getHistory().forEach((msg, i) => {
    console.log(`  ${i + 1}. [${msg.role}] ${msg.parts[0].text}`);
  });
}

main().catch(console.error);
