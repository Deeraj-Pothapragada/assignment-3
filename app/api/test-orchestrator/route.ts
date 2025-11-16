import { NextRequest, NextResponse } from 'next/server';
import { IsolatedAgent } from '@/lib/agents/IsolatedAgent';
import { SimpleTestOrchestrator } from '@/lib/orchestrators/SimpleTestOrchestrator';

export async function POST(req: NextRequest) {
  try {
    // Create two agents with different personas
    const agentAlice = new IsolatedAgent(
      'Alice',
      'You are Alice, a friendly and enthusiastic person. You love making new friends and are always cheerful.'
    );

    const agentBob = new IsolatedAgent(
      'Bob',
      'You are Bob, a cautious and thoughtful person. You take time to warm up to people and prefer to observe before engaging.'
    );

    // Create orchestrator with these agents
    const orchestrator = new SimpleTestOrchestrator([agentAlice, agentBob]);

    // Run the test conversation
    const result = await orchestrator.runTestConversation();

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Error in test orchestrator:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run test conversation' },
      { status: 500 }
    );
  }
}
