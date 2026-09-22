'use client';

import { CheckCircle2, PhoneCall, PhoneIncoming, Radio, Send, Server, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { TelephonyCard } from '@/components/TelephonyCard';
import { TopBar } from '@/components/TopBar';
import { SectionCard } from '@/components/ui';
import { post, put, usePolling } from '@/lib/api';
import { AgentTurn, Call, PhoneNumberConfig } from '@/lib/types';

interface Line {
  speaker: 'agent' | 'caller';
  text: string;
}

function TranscriptBubbles({ lines, ended }: { lines: { speaker: 'agent' | 'caller'; text: string }[]; ended?: boolean }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-4">
      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">
          Start a call to watch the AI agent greet the caller, qualify the job, check technician availability, negotiate a time slot and capture
          the WhatsApp number.
        </p>
      ) : null}
      {lines.map((line, i) => (
        <div key={i} className={`flex ${line.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              line.speaker === 'agent' ? 'bg-purple-100 text-purple-900' : 'bg-orange-100 text-orange-900'
            }`}
          >
            {line.text}
          </div>
        </div>
      ))}
      {ended ? <p className="text-center text-xs font-semibold text-slate-500">Call ended · logged to the CRM with transcript</p> : null}
      <div ref={bottomRef} />
    </div>
  );
}

/** Live view of a real inbound call — polls the call record so the transcript streams in as turns happen. */
function LiveCallPanel({ callId, onClose }: { callId: string; onClose: () => void }) {
  const { data: call } = usePolling<Call>(`/calls/${callId}`, { refreshInterval: 1500 });
  const ended = call?.status === 'completed' || call?.status === 'missed';
  const ringing = call?.status === 'ringing';

  return (
    <SectionCard
      title="Inbound call"
      action={
        <div className="flex items-center gap-2">
          <span
            className={`badge ${
              ringing
                ? 'animate-pulse bg-orange-100 text-orange-700 ring-orange-200'
                : ended
                  ? 'bg-slate-100 text-slate-600 ring-slate-200'
                  : 'animate-pulse bg-emerald-100 text-emerald-700 ring-emerald-200'
            }`}
          >
            <Radio className="mr-1 h-3 w-3" />
            {ringing ? 'Ringing…' : ended ? 'Ended' : 'Live · AI agent on the line'}
          </span>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      }
    >
      <div className="flex h-[420px] flex-col">
        <p className="mb-2 text-xs text-slate-500">
          {call ? `From ${call.from} · started ${new Date(call.startedAt).toLocaleTimeString()}` : 'Connecting…'}
        </p>
        <TranscriptBubbles lines={call?.transcript ?? []} ended={ended} />
        {ended && call?.bookingId ? (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Booking created and WhatsApp confirmation sent — see Bookings.
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

function PhonePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: phone } = usePolling<PhoneNumberConfig>('/settings/phone-number');
  const [draft, setDraft] = useState<PhoneNumberConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const [callId, setCallId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [callerNumber, setCallerNumber] = useState('+1 (512) 555-0199');
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveCallId, setLiveCallId] = useState<string | null>(params.get('live'));
  const [simulating, setSimulating] = useState(false);

  const config = draft ?? phone ?? null;

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      await put('/settings/phone-number', config);
      setDraft(null);
      await mutate(() => true);
    } finally {
      setSaving(false);
    }
  }

  async function simulateInbound() {
    setSimulating(true);
    setError(null);
    try {
      const res = await post<{ callId: string }>('/ai/calls/simulate');
      setLiveCallId(res.callId);
      router.replace(`/phone?live=${res.callId}`);
      await mutate(() => true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call');
    } finally {
      setSimulating(false);
    }
  }

  async function startCall() {
    setError(null);
    setEnded(false);
    try {
      const turn = await post<AgentTurn>('/ai/calls/start', { from: callerNumber });
      setCallId(turn.callId);
      setLines([{ speaker: 'agent', text: turn.agentMessage }]);
      setSuggestions(turn.suggestions);
      await mutate(() => true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the call');
    }
  }

  async function send(text: string) {
    if (!callId || !text.trim()) return;
    setInput('');
    setLines((l) => [...l, { speaker: 'caller', text }]);
    try {
      const turn = await post<AgentTurn>(`/ai/calls/${callId}/reply`, { text });
      setLines((l) => [...l, { speaker: 'agent', text: turn.agentMessage }]);
      setSuggestions(turn.suggestions);
      if (turn.step === 'ended') {
        setEnded(true);
        setCallId(null);
      }
      await mutate(() => true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The call dropped');
    }
  }

  return (
    <>
      <TopBar title="Phone & AI agent" subtitle="Connect the business number the AI voice agent answers" />
      <main className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-8">
        {liveCallId ? <LiveCallPanel callId={liveCallId} onClose={() => setLiveCallId(null)} /> : null}

        <TelephonyCard />

        <div className="flex justify-end">
          <button type="button" className="btn-secondary" onClick={simulateInbound} disabled={simulating}>
            <PhoneIncoming className="h-4 w-4" /> {simulating ? 'Dialing…' : 'Simulate inbound call'}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Connected business number">
            {config ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-slate-700">
                  Phone number
                  <input className="input mt-1" value={config.number ?? ''} onChange={(e) => setDraft({ ...config, number: e.target.value })} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Label
                  <input className="input mt-1" value={config.label} onChange={(e) => setDraft({ ...config, label: e.target.value })} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Provider
                  <input className="input mt-1" value={config.provider} onChange={(e) => setDraft({ ...config, provider: e.target.value })} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  AI greeting
                  <textarea className="input mt-1" rows={3} value={config.greeting} onChange={(e) => setDraft({ ...config, greeting: e.target.value })} />
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-purple-600"
                      checked={config.connected}
                      onChange={(e) => setDraft({ ...config, connected: e.target.checked })}
                    />
                    Number connected
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-orange-500"
                      checked={config.aiAgentEnabled}
                      onChange={(e) => setDraft({ ...config, aiAgentEnabled: e.target.checked })}
                    />
                    AI agent answers calls
                  </label>
                </div>
                <button type="button" className="btn-primary" onClick={saveConfig} disabled={saving || !draft}>
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading…</p>
            )}
          </SectionCard>

          <SectionCard
            title="Manual AI simulator — drive each turn"
            action={
              <div className="flex items-center gap-2">
                <input className="input w-44" value={callerNumber} onChange={(e) => setCallerNumber(e.target.value)} />
                <button type="button" className="btn-secondary" onClick={startCall} disabled={Boolean(callId)}>
                  <PhoneCall className="h-4 w-4" /> Call in
                </button>
              </div>
            }
          >
            <div className="flex h-[420px] flex-col">
              <TranscriptBubbles lines={lines} ended={ended} />

              {suggestions.length > 0 && callId ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="btn-ghost" onClick={() => send(s)}>
                      {s.includes('T') && s.includes(':') ? new Date(s).toLocaleString('en-US', { weekday: 'short', hour: 'numeric' }) : s}
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
              >
                <input
                  className="input"
                  placeholder={callId ? 'Speak as the caller…' : 'Start a call first'}
                  value={input}
                  disabled={!callId}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="btn-primary" disabled={!callId}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
              {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="How calls reach the agent" className="text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <Server className="h-4 w-4" />
            </span>
            <p>
              Every inbound call — real (Telnyx) or simulated — runs through the same server-side state machine in{' '}
              <span className="font-mono">backend/src/aiAgent.ts</span>: greeting → service type → address → availability check with slot
              renegotiation → WhatsApp capture → booking + confirmation. The <span className="font-medium">Calls</span> page logs ringing, live
              and completed calls with recordings and transcripts.
            </p>
          </div>
        </SectionCard>
      </main>
    </>
  );
}

export default function PhonePage() {
  return (
    <Suspense>
      <PhonePageInner />
    </Suspense>
  );
}
