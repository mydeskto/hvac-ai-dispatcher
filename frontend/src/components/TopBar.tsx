'use client';

import { PhoneIncoming } from 'lucide-react';
import { useState } from 'react';
import { mutate } from 'swr';
import { post, usePolling } from '@/lib/api';
import { PhoneNumberConfig } from '@/lib/types';

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data: phone } = usePolling<PhoneNumberConfig>('/settings/phone-number');
  const [busy, setBusy] = useState(false);

  async function simulateCall() {
    setBusy(true);
    try {
      await post('/ai/calls/simulate');
      await mutate(() => true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className={`h-2 w-2 rounded-full ${phone?.connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'}`} />
          <span className="font-medium">{phone?.number ?? 'No number connected'}</span>
          <span className="text-slate-400">·</span>
          <span>{phone?.aiAgentEnabled ? 'AI agent live' : 'AI agent off'}</span>
        </div>
        <span className="hidden text-xs text-slate-400 sm:inline">Auto-refresh every 5s</span>
        <button type="button" className="btn-secondary" onClick={simulateCall} disabled={busy}>
          <PhoneIncoming className="h-4 w-4" />
          {busy ? 'Simulating…' : 'Simulate inbound call'}
        </button>
      </div>
    </header>
  );
}
