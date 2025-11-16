'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConversationMessage {
  from: string;
  to: string;
  message: string;
  timestamp: number;
}

interface DebugEvent {
  type: string;
  data: any;
  timestamp: number;
}

export default function MultiAgentView({ onBackToExample }: { onBackToExample?: () => void }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [waitingForFinn, setWaitingForFinn] = useState(false);
  const [finnInput, setFinnInput] = useState('');
  const [currentStep, setCurrentStep] = useState(0); // 0 = not started, 1-3 = steps
  const [currentStepData, setCurrentStepData] = useState<any>(null);

  // Separate conversation histories for each column
  const [finnConvo, setFinnConvo] = useState<ConversationMessage[]>([]);
  const [genjiConvo, setGenjiConvo] = useState<ConversationMessage[]>([]);
  const [hanzoConvo, setHanzoConvo] = useState<ConversationMessage[]>([]);
  const [kendrickConvo, setKendrickConvo] = useState<ConversationMessage[]>([]);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);

  // Parse individual message
  const parseMessage = (msg: any) => {
    const timestamp = Date.now();
    const conversationMsg: ConversationMessage = {
      from: msg.from,
      to: msg.to,
      message: msg.reasoning ? `${msg.message}\n\n💭 Reasoning: ${msg.reasoning}` : msg.message,
      timestamp
    };

    // Route to appropriate column
    if (msg.agent === 'Finn') {
      setFinnConvo(prev => [...prev, conversationMsg]);
    } else if (msg.agent === 'Genji') {
      setGenjiConvo(prev => [...prev, conversationMsg]);
    } else if (msg.agent === 'Hanzo') {
      setHanzoConvo(prev => [...prev, conversationMsg]);
    } else if (msg.agent === 'Kendrick') {
      setKendrickConvo(prev => [...prev, conversationMsg]);
    }
  };


  async function startStrategicSharingTest() {
    // Reset game
    await fetch('/api/strategic-sharing-step', { method: 'DELETE' });

    // Clear all conversations
    setFinnConvo([]);
    setGenjiConvo([]);
    setHanzoConvo([]);
    setKendrickConvo([]);
    setDebugEvents([]);
    setErrorMsg('');

    // Start step 1
    setCurrentStep(1);
    showStepPrompt(1);
  }

  function showRevealMessages(reveals: { from: string; to: string; number: number }[]) {
    // Build reveal message for each agent
    const agentNames = ['Finn', 'Genji', 'Hanzo', 'Kendrick'];

    agentNames.forEach(agentName => {
      const revealsToMe = reveals.filter(r => r.to === agentName);
      let message = '';

      if (revealsToMe.length > 0) {
        message = revealsToMe.map(r => `${r.from} revealed their number: ${r.number}`).join('. ') + '.';
      } else {
        message = 'No one revealed their number to you.';
      }

      parseMessage({
        agent: agentName,
        from: 'Orchestrator',
        to: agentName,
        message
      });
    });
  }

  function showStepPrompt(step: number) {
    const prompts = [
      '', // step 0
      'Pick an integer from 1 to 10.',
      'Choose ONE agent to reveal your number to. (Finn, Genji, Hanzo, or Kendrick)',
      'What is the sum of all four agents\' numbers?'
    ];

    // Show orchestrator message to all agents
    const prompt = prompts[step];

    ['Finn', 'Genji', 'Hanzo', 'Kendrick'].forEach(agentName => {
      parseMessage({
        agent: agentName,
        from: 'Orchestrator',
        to: agentName,
        message: prompt
      });
    });

    // Wait for Finn's input
    setWaitingForFinn(true);
  }

  async function processStep(step: number, finnResponse: string) {
    setIsLoading(true);
    setWaitingForFinn(false);

    try {
      // Call backend with Finn's response
      const res = await fetch('/api/strategic-sharing-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, finnResponse })
      });

      if (!res.ok) {
        setErrorMsg('Request failed');
        setIsLoading(false);
        return;
      }

      const data = await res.json();

      // Display all agent responses
      data.responses.forEach((resp: any) => {
        const message = resp.reasoning
          ? `${resp.response}\n\n💭 Reasoning: ${resp.reasoning}`
          : resp.response;

        parseMessage({
          agent: resp.agent,
          from: resp.agent,
          to: 'Orchestrator',
          message
        });
      });

      // Log to debug column
      setDebugEvents(prev => [...prev, {
        type: `Step ${step} Complete`,
        data: data,
        timestamp: Date.now()
      }]);

      setCurrentStepData(data);
      setIsLoading(false);

      // Move to next step or finish
      if (step < 3) {
        setTimeout(() => {
          setCurrentStep(step + 1);

          // If we just completed step 2, show reveal messages BEFORE step 3 prompt
          if (step === 2 && data.reveals) {
            showRevealMessages(data.reveals);
            // Then show step 3 prompt after a delay
            setTimeout(() => {
              showStepPrompt(step + 1);
            }, 1000);
          } else {
            showStepPrompt(step + 1);
          }
        }, 500);
      } else {
        // Game complete
        console.log('Game complete!', data);
        console.log('Correct sum:', data.correctSum);
      }

    } catch (error) {
      console.error('Error processing step:', error);
      setErrorMsg('Failed to process step');
      setIsLoading(false);
    }
  }

  const submitFinnResponse = async () => {
    if (!finnInput.trim() || currentStep === 0) return;

    const response = finnInput.trim();
    setFinnInput('');

    // Process this step with Finn's response
    await processStep(currentStep, response);
  };

  const ConversationColumn = ({ title, messages, bgColor, showInput }: {
    title: string;
    messages: ConversationMessage[];
    bgColor: string;
    showInput?: boolean;
  }) => (
    <div className="flex-1 flex flex-col h-full">
      <div className={`${bgColor} text-white px-3 py-2 font-semibold text-sm rounded-t-lg`}>
        {title}
      </div>
      <Card className="flex-1 rounded-t-none rounded-b-lg p-3 overflow-y-auto bg-white border border-slate-200 min-h-0">
        <div className="flex flex-col gap-2">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`px-2.5 py-2 rounded-lg text-sm ${
                msg.from === 'Orchestrator'
                  ? 'bg-blue-50 text-slate-900 border border-blue-200'
                  : 'bg-slate-100 text-slate-900 border border-slate-300'
              }`}
            >
              <div className="text-xs text-slate-500 mb-1">
                {msg.from} → {msg.to}
              </div>
              <div className="whitespace-pre-wrap">{msg.message}</div>
            </div>
          ))}
          {showInput && waitingForFinn && (
            <div className="mt-2 flex gap-2">
              <Input
                type="text"
                placeholder="Your response..."
                value={finnInput}
                onChange={(e) => setFinnInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitFinnResponse();
                  }
                }}
                className="flex-1"
                autoFocus
              />
              <Button onClick={submitFinnResponse} size="sm">
                Send
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );

  const DebugColumn = () => (
    <div className="flex-1 flex flex-col h-full">
      <div className="bg-slate-700 text-white px-3 py-2 font-semibold text-sm rounded-t-lg">
        🔍 Orchestrator Debug
      </div>
      <Card className="flex-1 rounded-t-none rounded-b-lg p-3 overflow-y-auto bg-slate-900 border border-slate-700 min-h-0 font-mono text-xs">
        <div className="flex flex-col gap-2">
          {debugEvents.map((event, i) => (
            <div key={i} className="bg-slate-800 text-slate-100 px-2 py-1.5 rounded border border-slate-700">
              <div className="text-purple-400 font-semibold mb-1">
                {event.type}
              </div>
              <pre className="text-slate-300 text-[10px] whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(event.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="h-screen flex flex-col p-4 bg-slate-50">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">
            Strategic Sharing Test
          </h1>
          <div className="text-slate-600 text-sm">
            Watch three agents pick numbers, strategically share information, and guess the sum
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={startStrategicSharingTest}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-medium px-6"
          >
            {isLoading ? 'Running Test...' : '▶ Start Test'}
          </Button>
          {onBackToExample && (
            <Button
              onClick={onBackToExample}
              variant="outline"
              className="bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
            >
              🔪 Murder Mystery
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-900 border border-red-200 px-3 py-2 rounded-lg mb-3">
          {errorMsg}
        </div>
      )}

      {/* 5-column layout */}
      <div className="flex-1 flex gap-3 min-h-0">
        <ConversationColumn
          title="👤 Finn (You)"
          messages={finnConvo}
          bgColor="bg-slate-600"
          showInput={true}
        />
        <ConversationColumn
          title="🥷 Genji"
          messages={genjiConvo}
          bgColor="bg-green-600"
        />
        <ConversationColumn
          title="🏹 Hanzo"
          messages={hanzoConvo}
          bgColor="bg-blue-600"
        />
        <ConversationColumn
          title="🎤 Kendrick"
          messages={kendrickConvo}
          bgColor="bg-purple-600"
        />
        <DebugColumn />
      </div>
    </div>
  );
}
