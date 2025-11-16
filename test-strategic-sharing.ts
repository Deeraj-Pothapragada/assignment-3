/**
 * Test strategic information sharing between agents.
 *
 * Flow:
 * 1. Each agent picks a number (parallel)
 * 2. Orchestrator asks each agent who they want to reveal their number to (parallel)
 * 3. Orchestrator routes the reveals to the chosen agents
 * 4. Ask each agent for the sum (they should have partial info now)
 *
 * Run with: npx tsx test-strategic-sharing.ts
 */

import { IsolatedAgent } from './lib/agents/IsolatedAgent';

async function main() {
  console.log('=== Testing Strategic Information Sharing ===\n');

  // Create three agents
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

  const agents = [
    { name: 'Genji', agent: genji },
    { name: 'Hanzo', agent: hanzo },
    { name: 'Kendrick', agent: kendrick }
  ];

  // Step 1: Each agent picks a number (parallel)
  console.log('[Orchestrator] Step 1: Asking all agents to pick a number from 1-10...\n');

  const pickResponses = await Promise.all(
    agents.map(({ agent }) =>
      agent.respond('Pick an integer from 1 to 10. Just respond with the number, nothing else.')
    )
  );

  const numbers = agents.map(({ name }, i) => {
    const num = parseInt(pickResponses[i].text.match(/\d+/)?.[0] || '0');
    console.log(`[${name}] picked: ${num}`);
    return num;
  });

  const correctSum = numbers.reduce((a, b) => a + b, 0);
  console.log(`\n[Orchestrator] Correct sum: ${numbers.join(' + ')} = ${correctSum}\n`);

  // Step 2: Ask each agent who they want to reveal their number to (parallel)
  console.log('[Orchestrator] Step 2: Asking each agent who they want to reveal their number to...\n');

  const revealResponses = await Promise.all(
    agents.map(({ name, agent }, i) => {
      const otherAgents = agents.filter(a => a.name !== name).map(a => a.name);
      return agent.respond(
        `You picked the number ${numbers[i]}. The other agents are: ${otherAgents.join(', ')}. ` +
        `Choose ONE agent to reveal your number to. Respond with just their name, nothing else.`,
        true // include reasoning
      );
    })
  );

  // Parse who wants to reveal to whom
  const reveals: { from: string; to: string; number: number }[] = [];
  agents.forEach(({ name }, i) => {
    const targetName = revealResponses[i].text.trim();
    console.log(`[${name}] wants to reveal to: ${targetName}`);
    console.log(`  Reasoning: ${revealResponses[i].reasoning}\n`);
    reveals.push({ from: name, to: targetName, number: numbers[i] });
  });

  // Step 3: Route the reveals to each agent
  console.log('[Orchestrator] Step 3: Routing reveals and asking for sum...\n');

  const finalResponses = await Promise.all(
    agents.map(({ name, agent }) => {
      // Find all reveals directed to this agent
      const revealsToMe = reveals.filter(r => r.to === name);

      let revealMessage = '';
      if (revealsToMe.length > 0) {
        const revealList = revealsToMe.map(r => `${r.from} revealed their number: ${r.number}`).join('. ');
        revealMessage = revealList + '. ';
      } else {
        revealMessage = 'No one revealed their number to you. ';
      }

      return agent.respond(
        `${revealMessage}What is the sum of all three agents' numbers?`,
        true // include reasoning
      );
    })
  );

  // Display results
  console.log('=== Final Guesses ===\n');

  agents.forEach(({ name }, i) => {
    const guessNum = parseInt(finalResponses[i].text.match(/\d+/)?.[0] || '0');
    const isCorrect = guessNum === correctSum;

    console.log(`[${name}]`);
    console.log(`  Reasoning: ${finalResponses[i].reasoning}`);
    console.log(`  Answer: ${finalResponses[i].text}`);
    console.log(`  Guess: ${guessNum} - ${isCorrect ? '✅ CORRECT!' : `❌ WRONG (correct: ${correctSum})`}\n`);
  });

  // Summary
  const correctGuesses = agents.filter((_, i) => {
    const guessNum = parseInt(finalResponses[i].text.match(/\d+/)?.[0] || '0');
    return guessNum === correctSum;
  }).length;

  console.log('=== Summary ===');
  console.log(`Correct sum: ${correctSum}`);
  console.log(`Agents who guessed correctly: ${correctGuesses}/3`);
  console.log(`\nThis demonstrates that with partial information sharing, agents can get closer to the answer but still can't guarantee success without a coordinated strategy.`);

  // Show what each agent knows
  console.log('\n=== Information Each Agent Has ===\n');

  agents.forEach(({ name, agent }) => {
    console.log(`${name}'s context:`);
    agent.getHistory().forEach((msg, i) => {
      const preview = msg.parts[0].text.substring(0, 120).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. [${msg.role}] ${preview}${msg.parts[0].text.length > 120 ? '...' : ''}`);
    });
    console.log('');
  });
}

main().catch(console.error);
