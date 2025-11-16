/**
 * Test the Murder Mystery API endpoint
 *
 * Run dev server first: npm run dev
 * Then run: npx tsx test-murder-mystery-api.ts
 */

const API_URL = 'http://localhost:3000/api/murder-mystery';

async function testAPI() {
  console.log('🧪 Testing Murder Mystery API\n');

  // Reset game
  console.log('1. Resetting game...');
  await fetch(API_URL, { method: 'DELETE' });
  console.log('   ✓ Game reset\n');

  // Initialize game
  console.log('2. Initializing game...');
  const initRes = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'init',
      playerNames: ['Alice', 'Bob', 'Charlie', 'Finn'],
      humanPlayerName: 'Finn'
    })
  });
  const initData = await initRes.json();
  console.log('   ✓ Game initialized');
  console.log('   Alive players:', initData.gameState.alive);
  console.log('   Phase:', initData.gameState.phase);
  console.log('');

  // Day 0: Introductions
  console.log('3. Day 0: Role assignment and introductions...');
  const day0Res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'day_0',
      humanResponses: {
        Finn: 'Hi everyone, I am Finn, nice to meet you all!'
      }
    })
  });
  const day0Data = await day0Res.json();
  console.log('   Introductions:');
  day0Data.responses.forEach((r: any) => {
    console.log(`   - ${r.agent} (${r.role}): ${r.introduction}`);
  });
  console.log('   Next phase:', day0Data.nextPhase);
  console.log('');

  // Night 1: Night actions
  console.log('4. Night 1: Night actions...');
  const night1Res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phase: 'night_1',
      humanResponses: {
        Finn: 'I will visit Bob tonight'
      }
    })
  });
  const night1Data = await night1Res.json();
  console.log('   Night actions:');
  night1Data.nightActions.forEach((a: any) => {
    console.log(`   - ${a.agent}: ${a.action}${a.target ? ` → ${a.target}` : ''}${a.intent ? ' (intent to kill)' : ''}`);
  });
  console.log('\n   Deaths:', night1Data.deaths.length > 0 ? night1Data.deaths : 'None');
  console.log('\n   Observations:');
  night1Data.observations.forEach((o: any) => {
    console.log(`   - ${o.agent}: ${o.observation}`);
  });
  console.log('\n   Winner:', night1Data.winner || 'Game continues');
  console.log('   Next phase:', night1Data.nextPhase);
  console.log('');

  console.log('✅ API test complete!');
  console.log('\nNote: To continue testing, you would send requests for:');
  console.log('  - day_1_discussion');
  console.log('  - day_1_voting');
  console.log('  - night_2');
  console.log('  - etc...');
}

testAPI().catch(console.error);
