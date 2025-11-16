'use client';

import { useState } from 'react';
import MultiAgentView from '@/components/MultiAgentView';
import MurderMysteryView from '@/components/MurderMysteryView';

export default function Home() {
  const [mode, setMode] = useState<'strategic-sharing' | 'murder-mystery'>('murder-mystery');

  // If strategic sharing mode, show multi-agent view
  if (mode === 'strategic-sharing') {
    return <MultiAgentView onBackToExample={() => setMode('murder-mystery')} />;
  }

  // Render murder mystery mode
  return <MurderMysteryView onSwitchMode={() => setMode('strategic-sharing')} />;
}
