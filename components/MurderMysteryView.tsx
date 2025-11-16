'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ConversationMessage {
  from: string;
  to: string;
  message: string;
  timestamp: number;
  isPrivate?: boolean; // Private messages (like role assignment)
}

interface DebugEvent {
  type: string;
  data: any;
  timestamp: number;
}

interface AgentConfig {
  name: string;
  model: string;
  isHuman: boolean;
}

interface UserMetrics {
  responseTime: number; // milliseconds
  responseLength: number; // characters
  timestamp: number;
  phase: string;
}

type Phase = 'init' | string; // night_1, day_1_discussion, day_1_voting, etc.

const DEFAULT_MODEL = 'gemini-2.5-flash';
const COLOR_PALETTE = [
  'bg-orange-600',
  'bg-blue-600',
  'bg-yellow-600',
  'bg-green-600',
  'bg-purple-600',
  'bg-pink-600',
  'bg-indigo-600',
  'bg-red-600',
  'bg-teal-600',
  'bg-cyan-600',
];

export default function MurderMysteryView({ onSwitchMode }: { onSwitchMode?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentPhase, setCurrentPhase] = useState<Phase>('init');
  const [waitingForHuman, setWaitingForHuman] = useState(false);
  const [humanInput, setHumanInput] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [humanPlayerName, setHumanPlayerName] = useState<string | null>(null);

  // Dynamic conversation histories - Map of agent name to messages
  const [conversations, setConversations] = useState<Map<string, ConversationMessage[]>>(new Map());
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const [agentNames, setAgentNames] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showAIBrains, setShowAIBrains] = useState(true);

  // Agent configuration state (for game setup)
  const [showConfig, setShowConfig] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([
    { name: 'Alice', model: DEFAULT_MODEL, isHuman: false },
    { name: 'Bob', model: DEFAULT_MODEL, isHuman: false },
    { name: 'Charlie', model: DEFAULT_MODEL, isHuman: false },
    { name: 'Finn', model: DEFAULT_MODEL, isHuman: true },
  ]);

  // Discussion state
  const [discussionActive, setDiscussionActive] = useState(false);
  const [discussionTimeRemaining, setDiscussionTimeRemaining] = useState(90);
  const [discussionStartTime, setDiscussionStartTime] = useState<number | null>(null);

  // User metrics tracking
  const [userMetrics, setUserMetrics] = useState<UserMetrics[]>([]);
  const [currentPromptTime, setCurrentPromptTime] = useState<number | null>(null);

  // Parse individual message and route to appropriate conversation
  const parseMessage = (msg: any) => {
    const timestamp = Date.now();
    const conversationMsg: ConversationMessage = {
      from: msg.from || 'Orchestrator',
      to: msg.to || msg.agent,
      message: msg.reasoning ? `${msg.message}\n\n💭 Reasoning: ${msg.reasoning}` : msg.message,
      timestamp,
      isPrivate: msg.isPrivate
    };

    // Helper: should this message appear in this agent's column?
    const shouldShowInColumn = (agentName: string) => {
      // If message is directly TO this agent, always show it
      if (msg.to === agentName) return true;

      // If msg.agent specifies this column AND message is not to 'Everyone', show it
      if (msg.agent === agentName && msg.to !== 'Everyone') return true;

      // For 'Everyone' messages: show in this agent's column ONLY if this agent is NOT the sender
      // (sender already sees their outbound message, don't duplicate it)
      if (msg.to === 'Everyone' && msg.agent === agentName && msg.from !== agentName) return true;

      return false;
    };

    // Update conversations for all relevant agents
    setConversations(prev => {
      const newConvos = new Map(prev);
      agentNames.forEach(agentName => {
        if (shouldShowInColumn(agentName)) {
          const existing = newConvos.get(agentName) || [];
          newConvos.set(agentName, [...existing, conversationMsg]);
        }
      });
      return newConvos;
    });
  };

  const addDebugEvent = (type: string, data: any) => {
    setDebugEvents(prev => [...prev, { type, data, timestamp: Date.now() }]);
  };

  // Update agent configs when player count changes
  const updatePlayerCount = (count: number) => {
    if (count < 3) return;
    setPlayerCount(count);

    // Adjust agent configs to match count
    setAgentConfigs(prev => {
      const newConfigs = [...prev];

      // Add or remove agents to match count
      while (newConfigs.length < count) {
        const index = newConfigs.length;
        newConfigs.push({
          name: `Agent${index + 1}`,
          model: DEFAULT_MODEL,
          isHuman: false
        });
      }

      while (newConfigs.length > count) {
        // Remove non-human agents first, but keep at least one human
        const humanIndex = newConfigs.findIndex(a => a.isHuman);
        if (humanIndex === -1 && newConfigs.length > 1) {
          newConfigs.pop();
        } else if (newConfigs.length > 1) {
          // Remove a non-human agent if possible
          const nonHumanIndex = newConfigs.findIndex((a, i) => !a.isHuman && i !== humanIndex);
          if (nonHumanIndex !== -1) {
            newConfigs.splice(nonHumanIndex, 1);
          } else if (newConfigs.length > 1) {
            newConfigs.pop();
          }
        }
      }

      // Ensure at least one human player
      const hasHuman = newConfigs.some(a => a.isHuman);
      if (!hasHuman && newConfigs.length > 0) {
        newConfigs[0].isHuman = true;
      }

      return newConfigs;
    });
  };

  const addAgent = () => {
    setAgentConfigs(prev => [
      ...prev,
      { name: `Agent${prev.length + 1}`, model: DEFAULT_MODEL, isHuman: false }
    ]);
    setPlayerCount(prev => prev + 1);
  };

  const removeAgent = (index: number) => {
    if (agentConfigs.length <= 3) return;
    setAgentConfigs(prev => prev.filter((_, i) => i !== index));
    setPlayerCount(prev => Math.max(3, prev - 1));
  };

  const updateAgentConfig = (index: number, updates: Partial<AgentConfig>) => {
    setAgentConfigs(prev => prev.map((agent, i) => i === index ? { ...agent, ...updates } : agent));
  };

  async function startGame() {
    // Validate at least 3 agents
    if (agentConfigs.length < 3) {
      setErrorMsg('You need at least 3 agents to play');
      return;
    }

    // Validate at least one human player
    const humanPlayer = agentConfigs.find(a => a.isHuman);
    if (!humanPlayer) {
      setErrorMsg('You need at least one human player');
      return;
    }

    // Reset
    await fetch('/api/murder-mystery', { method: 'DELETE' });
    setConversations(new Map());
    setDebugEvents([]);
    setErrorMsg('');
    setGameOver(false);
    setWinner(null);
    setMyRole(null);
    setShowConfig(false);

    setIsLoading(true);

    try {
      const playerNames = agentConfigs.map(a => a.name);
      const humanName = humanPlayer.name;

      // Build agent configs map
      const configs: Record<string, { model: string }> = {};
      agentConfigs.forEach(agent => {
        if (!agent.isHuman) {
          configs[agent.name] = { model: agent.model };
        }
      });

      // Initialize game
      const initRes = await fetch('/api/murder-mystery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'init',
          playerNames,
          humanPlayerName: humanName,
          agentConfigs: configs
        })
      });

      const initData = await initRes.json();
      addDebugEvent('Game Initialized', initData);

      // Set agent names for dynamic rendering
      setAgentNames(playerNames);
      setHumanPlayerName(humanName);

      // Initialize conversation maps
      const initialConvos = new Map<string, ConversationMessage[]>();
      playerNames.forEach(name => initialConvos.set(name, []));
      setConversations(initialConvos);

      // Show role assignments to ALL players (each in their own column)
      initData.roleAssignments.forEach((r: any) => {
        if (r.agent === humanName) {
          setMyRole(r.role);
        }
        parseMessage({
          agent: r.agent,
          from: 'Game Master',
          to: r.agent,
          message: `🔒 Your secret role: ${r.role.toUpperCase()}`,
          isPrivate: true
        });
      });

      // Start Night 1 immediately
      setCurrentPhase('night_1');
      showPhasePrompt('night_1', playerNames, humanName);
      setIsLoading(false);

    } catch (error) {
      console.error('Error starting game:', error);
      setErrorMsg('Failed to start game');
      setIsLoading(false);
    }
  }

  async function showPhasePrompt(phase: Phase, playerNames: string[], humanName: string) {
    const otherPlayers = playerNames.filter(n => n !== humanName);
    const promptTime = Date.now();
    setCurrentPromptTime(promptTime);

    if (phase.startsWith('night_')) {
      // Show night action prompt
      parseMessage({
        agent: humanName,
        from: 'Game Master',
        to: humanName,
        message: myRole === 'murderer'
          ? `NIGHT PHASE: Choose your action. You can either "stay at your home" or "visit another player's HOME" (${otherPlayers.join(', ')}). Also specify if you have "intent to kill" (yes/no). IMPORTANT: If you visit someone, you go to THEIR home - they might not be there if they visited elsewhere!`
          : `NIGHT PHASE: Choose your action. You can either "stay at your home" or "visit another player's HOME" (${otherPlayers.join(', ')}). IMPORTANT: If you visit someone, you go to THEIR home - they might not be there if they visited elsewhere!`
      });

      setWaitingForHuman(true);

    } else if (phase.includes('_discussion')) {
      // Start discussion phase
      setDiscussionActive(true);
      setDiscussionTimeRemaining(90);
      setDiscussionStartTime(Date.now());

      // Start discussion on backend
      try {
        const res = await fetch('/api/murder-mystery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start_discussion',
            phase
          })
        });

        const data = await res.json();

        // Show initial statements from LLM agents
        data.initialStatements?.forEach((s: any) => {
          parseMessage({
            agent: s.agent,
            from: s.agent,
            to: 'Everyone',
            message: s.statement
          });
        });

        // Start discussion timer
        const timer = setInterval(() => {
          setDiscussionTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              endDiscussion();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Store timer for cleanup
        (window as any).discussionTimer = timer;

      } catch (error) {
        console.error('Error starting discussion:', error);
        setErrorMsg('Failed to start discussion');
      }

    } else if (phase.includes('_voting')) {
      // Show voting prompt
      parseMessage({
        agent: humanName,
        from: 'Game Master',
        to: humanName,
        message: 'VOTING PHASE: Vote to hang someone or abstain. Say a player name or "abstain".'
      });

      setWaitingForHuman(true);
    }
  }

  const endDiscussion = async () => {
    setDiscussionActive(false);
    if ((window as any).discussionTimer) {
      clearInterval((window as any).discussionTimer);
    }

    // Move to voting phase
    if (currentPhase.includes('_discussion')) {
      const nextPhase = currentPhase.replace('_discussion', '_voting');
      setCurrentPhase(nextPhase);
      if (humanPlayerName) {
        showPhasePrompt(nextPhase, agentNames, humanPlayerName);
      }
    }
  };

  async function processPhase(phase: Phase, humanResponse: string) {
    if (!humanPlayerName) return;

    setIsLoading(true);
    setWaitingForHuman(false);

    try {
      const res = await fetch('/api/murder-mystery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase,
          humanResponses: { [humanPlayerName]: humanResponse }
        })
      });

      if (!res.ok) {
        setErrorMsg('Request failed');
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      addDebugEvent(`${phase} Complete`, data);

      // Handle Night phase
      if (phase.startsWith('night_')) {
        // Show night actions in debug only (not visible to players)
        addDebugEvent('Night Actions', data.nightActions);

        // Show night prompts to each agent (skip human - they already saw it)
        data.nightPrompts?.forEach((p: any) => {
          if (p.agent === humanPlayerName) return; // Skip human player
          parseMessage({
            agent: p.agent,
            from: 'Game Master',
            to: p.agent,
            message: `📋 ${p.prompt}`,
            isPrivate: true
          });
        });

        // Show night responses with reasoning (only visible to each agent, skip human)
        data.nightResponses?.forEach((r: any) => {
          if (r.agent === humanPlayerName) return; // Skip human player - already shown
          parseMessage({
            agent: r.agent,
            from: r.agent,
            to: 'Game Master',
            message: `${r.response}${r.reasoning ? `\n\n💭 Reasoning: ${r.reasoning}` : ''}`,
            isPrivate: true
          });
        });

        // Show observations privately to each agent
        data.observations.forEach((obs: any) => {
          parseMessage({
            agent: obs.agent,
            from: 'Game Master',
            to: obs.agent,
            message: `🌙 ${obs.observation}`,
            isPrivate: true
          });
        });

        // Announce deaths publicly to all agents
        agentNames.forEach(agent => {
          parseMessage({
            agent,
            from: 'Game Master',
            to: 'Everyone',
            message: data.deaths.length > 0
              ? `💀 ${data.deaths.join(', ')} died last night.`
              : `No one died last night.`
          });
        });

        // Check win condition
        if (data.winner) {
          setGameOver(true);
          setWinner(data.winner);

          // Special message if human player died
          if (data.humanPlayerDied) {
            parseMessage({
              agent: humanPlayerName,
              from: 'Game Master',
              to: humanPlayerName,
              message: `💀 GAME OVER - You died!\n\n${data.winReason}\n\nThe game will continue among the AI agents, but your story ends here.`,
              isPrivate: true
            });
          } else {
            agentNames.forEach(agent => {
              parseMessage({
                agent,
                from: 'Game Master',
                to: 'Everyone',
                message: `🎮 GAME OVER! ${data.winner.toUpperCase()} WIN!\n\nReason: ${data.winReason}`
              });
            });
          }
        } else {
          // Move to next phase
          setTimeout(() => {
            setCurrentPhase(data.nextPhase);
            showPhasePrompt(data.nextPhase, agentNames, humanPlayerName);
          }, 1000);
        }
      }

      // Handle Day Discussion - discussion is now handled separately via discussion API
      // This section is skipped for discussion phases

      // Handle Day Voting
      else if (phase.includes('_voting')) {
        // Show vote prompts to each agent (skip human - they already saw it)
        data.votePrompts?.forEach((p: any) => {
          if (p.agent === humanPlayerName) return; // Skip human player
          parseMessage({
            agent: p.agent,
            from: 'Game Master',
            to: p.agent,
            message: `📋 ${p.prompt}`,
            isPrivate: true
          });
        });

        // Show each agent's vote WITH reasoning in their own column (skip human - already shown)
        data.votes.forEach((v: any) => {
          if (v.agent === humanPlayerName) return; // Skip human player - already shown
          parseMessage({
            agent: v.agent,
            from: v.agent,
            to: 'Game Master',
            message: `Vote: ${v.vote}${v.reasoning ? `\n\n💭 Reasoning: ${v.reasoning}` : ''}`,
            isPrivate: true
          });
        });

        // Show vote summary publicly
        agentNames.forEach(agent => {
          const voteList = data.votes.map((v: any) => `${v.agent} → ${v.vote}`).join(', ');
          parseMessage({
            agent,
            from: 'Game Master',
            to: 'Everyone',
            message: `🗳️ Votes: ${voteList}`
          });
        });

        // Show result
        agentNames.forEach(agent => {
          parseMessage({
            agent,
            from: 'Game Master',
            to: 'Everyone',
            message: data.hanged
              ? `⚖️ ${data.hanged} was hanged! They were: ${data.hangedRole.toUpperCase()}`
              : `⚖️ No one was hanged (tie or insufficient votes)`
          });
        });

        // Check win condition
        if (data.winner) {
          setGameOver(true);
          setWinner(data.winner);
          agentNames.forEach(agent => {
            parseMessage({
              agent,
              from: 'Game Master',
              to: 'Everyone',
              message: `🎮 GAME OVER! ${data.winner.toUpperCase()} WIN!\n\nReason: ${data.winReason}`
            });
          });
        } else {
          // Move to next night
          setTimeout(() => {
            setCurrentPhase(data.nextPhase);
            showPhasePrompt(data.nextPhase, agentNames, humanPlayerName);
          }, 1000);
        }
      }

      setIsLoading(false);

    } catch (error) {
      console.error('Error processing phase:', error);
      setErrorMsg('Failed to process phase');
      setIsLoading(false);
    }
  }

  const submitHumanResponse = async () => {
    if (!humanInput.trim() || currentPhase === 'init' || !humanPlayerName) return;

    const response = humanInput.trim();
    const responseTime = currentPromptTime ? Date.now() - currentPromptTime : 0;
    const responseLength = response.length;

    setHumanInput('');

    // Track metrics
    if (currentPromptTime && responseTime > 0) {
      setUserMetrics(prev => [...prev, {
        responseTime,
        responseLength,
        timestamp: Date.now(),
        phase: currentPhase
      }]);
    }

    // If in discussion phase, post to discussion API
    if (currentPhase.includes('_discussion') && discussionActive) {
      try {
        const res = await fetch('/api/murder-mystery-discussion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'post',
            agentName: humanPlayerName,
            message: response
          })
        });

        const data = await res.json();

        // Show human's message
        parseMessage({
          agent: humanPlayerName,
          from: humanPlayerName,
          to: 'Everyone',
          message: response
        });

        // Show LLM agent responses if any
        data.llmResponses?.forEach((r: any) => {
          parseMessage({
            agent: r.agent,
            from: r.agent,
            to: 'Everyone',
            message: r.message
          });
        });

      } catch (error) {
        console.error('Error posting to discussion:', error);
        setErrorMsg('Failed to post message');
      }
    } else {
      // Regular phase (night, voting)
      // Show human's response
      parseMessage({
        agent: humanPlayerName,
        from: humanPlayerName,
        to: currentPhase.includes('discussion') ? 'Everyone' : 'Game Master',
        message: response
      });

      // Process this phase
      await processPhase(currentPhase, response);
    }

    // Reset prompt time for next interaction
    setCurrentPromptTime(null);
  };

  const ConversationColumn = ({ agentName, messages, bgColor, showInput, showRole }: {
    agentName: string;
    messages: ConversationMessage[];
    bgColor: string;
    showInput?: boolean;
    showRole?: boolean;
  }) => {
    const isHuman = agentName === humanPlayerName;
    const emoji = isHuman ? '👤' : '🤖';

    return (
      <div className="flex-1 flex flex-col h-full">
        <div className={`${bgColor} text-white px-3 py-2 font-semibold text-sm rounded-t-lg`}>
          {emoji} {agentName}{isHuman ? ' (You)' : ''}
          {showRole && myRole && isHuman && (
            <span className="ml-2 text-xs opacity-90">
              ({myRole === 'murderer' ? '🔪 MURDERER' : '😇 INNOCENT'})
            </span>
          )}
        </div>
        <Card className="flex-1 rounded-t-none rounded-b-lg p-3 overflow-y-auto bg-white border border-slate-200 min-h-0">
          <div className="flex flex-col gap-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`px-2.5 py-2 rounded-lg text-sm ${
                  msg.isPrivate
                    ? 'bg-red-50 text-slate-900 border border-red-300'
                    : msg.from === 'Game Master'
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
            {showInput && (waitingForHuman || discussionActive) && !gameOver && isHuman && (
              <div className="mt-2 flex gap-2">
                <Input
                  type="text"
                  placeholder={discussionActive ? "Type your message in the discussion..." : "Your response..."}
                  value={humanInput}
                  onChange={(e) => setHumanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      submitHumanResponse();
                    }
                  }}
                  className="flex-1"
                  autoFocus
                  disabled={!discussionActive && !waitingForHuman}
                />
                <Button
                  onClick={submitHumanResponse}
                  size="sm"
                  disabled={!discussionActive && !waitingForHuman}
                >
                  {discussionActive ? 'Post' : 'Send'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  };

  const DebugColumn = () => (
    <div className="flex-1 flex flex-col h-full">
      <div className="bg-slate-700 text-white px-3 py-2 font-semibold text-sm rounded-t-lg">
        🔍 Game Master Debug
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
            🔪 Murder Mystery Game
          </h1>
          <div className="text-slate-600 text-sm">
            Social deduction game with isolated agent contexts
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => currentPhase === 'init' ? setShowConfig(true) : startGame()}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-medium px-6"
          >
            {isLoading ? 'Processing...' : currentPhase === 'init' ? '▶ Configure & Start Game' : '🔄 New Game'}
          </Button>
          {currentPhase !== 'init' && (
            <Button
              onClick={() => setShowAIBrains(!showAIBrains)}
              variant="outline"
              className="bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
            >
              {showAIBrains ? '👁️ Hide AI Brains' : '👁️ Show AI Brains'}
            </Button>
          )}
          {onSwitchMode && (
            <Button
              onClick={onSwitchMode}
              variant="outline"
              className="bg-white text-slate-900 border-slate-200 hover:bg-slate-50"
            >
              📊 Strategic Sharing
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-900 border border-red-200 px-3 py-2 rounded-lg mb-3">
          {errorMsg}
        </div>
      )}

      {currentPhase !== 'init' && (
        <div className="bg-blue-50 text-blue-900 border border-blue-200 px-3 py-2 rounded-lg mb-3 text-sm">
          📍 Current Phase: <span className="font-semibold">{currentPhase}</span>
          {gameOver && <span className="ml-4 text-green-700 font-bold">🎮 GAME OVER - {winner?.toUpperCase()} WIN!</span>}
        </div>
      )}

      {/* Discussion Timer */}
      {discussionActive && (
        <div className="bg-yellow-50 text-yellow-900 border border-yellow-200 px-3 py-2 rounded-lg mb-3 text-sm flex items-center justify-between">
          <span>
            ⏱️ Discussion: <span className="font-semibold">{discussionTimeRemaining}s</span> remaining
          </span>
          <Button onClick={endDiscussion} variant="outline" size="sm" className="text-xs">
            End Discussion Early
          </Button>
        </div>
      )}

      {/* User Metrics Display */}
      {userMetrics.length > 0 && (
        <Card className="mb-3 p-3 bg-slate-50 border border-slate-200">
          <div className="text-xs text-slate-600 mb-2 font-semibold">📊 Your Performance Metrics</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-500">Avg Response Time:</span>{' '}
              <span className="font-semibold">
                {Math.round(userMetrics.reduce((sum, m) => sum + m.responseTime, 0) / userMetrics.length / 1000)}s
              </span>
            </div>
            <div>
              <span className="text-slate-500">Avg Response Length:</span>{' '}
              <span className="font-semibold">
                {Math.round(userMetrics.reduce((sum, m) => sum + m.responseLength, 0) / userMetrics.length)} chars
              </span>
            </div>
            <div>
              <span className="text-slate-500">Total Responses:</span>{' '}
              <span className="font-semibold">{userMetrics.length}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Agent Configuration Modal */}
      {showConfig && (
        <Card className="mb-3 p-4 bg-white border border-slate-300">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Configure Agents</h2>
            <Button onClick={() => setShowConfig(false)} variant="outline" size="sm">
              Close
            </Button>
          </div>

          {/* Player Count Slider */}
          <div className="mb-4 p-3 bg-slate-50 rounded border border-slate-200">
            <label className="block text-sm font-semibold mb-2 text-slate-700">
              Number of Players: <span className="text-blue-600">{playerCount}</span>
            </label>
            <input
              type="range"
              min="3"
              max="10"
              value={playerCount}
              onChange={(e) => updatePlayerCount(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>3</span>
              <span>10</span>
            </div>
          </div>

          <div className="space-y-3 mb-3">
            {agentConfigs.map((agent, index) => (
              <div key={index} className="flex gap-2 items-center p-2 border border-slate-200 rounded">
                <Input
                  placeholder="Agent name"
                  value={agent.name}
                  onChange={(e) => updateAgentConfig(index, { name: e.target.value })}
                  className="flex-1"
                />
                <select
                  value={agent.model}
                  onChange={(e) => updateAgentConfig(index, { model: e.target.value })}
                  disabled={agent.isHuman}
                  className="px-3 py-2 border border-slate-300 rounded text-sm"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="gemini-2.0-pro">gemini-2.0-pro</option>
                </select>
                <label className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={agent.isHuman}
                    onChange={(e) => {
                      // Only allow one human player
                      if (e.target.checked) {
                        setAgentConfigs(prev => prev.map((a, i) =>
                          i === index ? { ...a, isHuman: true } : { ...a, isHuman: false }
                        ));
                      } else {
                        updateAgentConfig(index, { isHuman: false });
                      }
                    }}
                  />
                  Human
                </label>
                <Button
                  onClick={() => removeAgent(index)}
                  variant="outline"
                  size="sm"
                  disabled={agentConfigs.length <= 3}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={addAgent} variant="outline" size="sm">
              + Add Agent
            </Button>
            <Button onClick={() => { setShowConfig(false); startGame(); }} className="bg-green-600 hover:bg-green-700 text-white">
              Start Game
            </Button>
          </div>
        </Card>
      )}

      {/* Dynamic column layout */}
      {currentPhase !== 'init' && agentNames.length > 0 && (
        <div className="flex-1 flex gap-3 min-h-0 overflow-x-auto">
          {agentNames.map((agentName, index) => {
            const messages = conversations.get(agentName) || [];
            const bgColor = agentName === humanPlayerName
              ? 'bg-slate-600'
              : COLOR_PALETTE[index % COLOR_PALETTE.length];

            return (
              <ConversationColumn
                key={agentName}
                agentName={agentName}
                messages={messages}
                bgColor={bgColor}
                showInput={agentName === humanPlayerName}
                showRole={agentName === humanPlayerName}
              />
            );
          })}
          {showAIBrains && <DebugColumn />}
        </div>
      )}
    </div>
  );
}
