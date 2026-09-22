'use client';

import { CheckCircle2, KeyRound, Loader2, PhoneCall, Plug, Search, ShoppingCart, Unplug } from 'lucide-react';
import { useState } from 'react';
import { mutate } from 'swr';
import { apiFetch, post, usePolling } from '@/lib/api';
import { AvailableNumber, TelnyxStatus } from '@/lib/types';
import { SectionCard } from './ui';

/**
 * Attach a real business number via Telnyx: connect credentials, then either
 * attach a number the account already owns or buy a new one — all from the UI.
 */
export function TelephonyCard() {
  const { data: telnyx } = usePolling<TelnyxStatus>('/telephony/status');
  const [apiKey, setApiKey] = useState('');
  const [connectionId, setConnectionId] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [attachNumberInput, setAttachNumberInput] = useState('');
  const [areaCode, setAreaCode] = useState('512');
  const [available, setAvailable] = useState<AvailableNumber[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      const result = await fn();
      await mutate('/telephony/status');
      await mutate(() => true);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      return null;
    } finally {
      setBusy(null);
    }
  }

  const connected = Boolean(telnyx?.configured);

  return (
    <SectionCard title="Business number — Telnyx">
      <div className="space-y-4 text-sm">
        {connected && telnyx?.numberAttached ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold text-slate-900">
                  <span className="font-mono">{telnyx.phoneNumber}</span> is live on Telnyx
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Inbound calls hit the AI agent via <span className="font-mono">/api/telnyx/webhook</span>
                  {telnyx.webhookUrl ? (
                    <>
                      {' '}
                      — paste this webhook in your Telnyx Call Control app:{' '}
                      <span className="break-all font-mono text-purple-700">{telnyx.webhookUrl}</span>
                    </>
                  ) : (
                    ' — set PUBLIC_BASE_URL so we can show your webhook URL'
                  )}
                </p>
              </div>
            </div>
            <button type="button" className="btn-ghost" disabled={busy !== null} onClick={() => run('disconnect', () => post('/telephony/disconnect'))}>
              <Unplug className="h-4 w-4" /> Disconnect
            </button>
          </div>
        ) : null}

        {!connected ? (
          <div className="space-y-3">
            <p className="text-slate-600">
              Step 1 — connect your Telnyx account. Get your API key and Call Control application id from{' '}
              <span className="font-medium">portal.telnyx.com</span>.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Telnyx API key (v2)
                <input
                  className="input mt-1 font-mono"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="KEY019A…"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Call Control application id
                <input
                  className="input mt-1 font-mono"
                  value={connectionId}
                  onChange={(e) => setConnectionId(e.target.value)}
                  placeholder="e.g. 28sierra…"
                />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Public webhook base URL <span className="font-normal text-slate-400">(your API's public URL — use ngrok locally)</span>
                <input
                  className="input mt-1 font-mono"
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://abc123.ngrok.io"
                />
              </label>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={busy !== null || !apiKey || !connectionId}
              onClick={() => run('connect', () => post('/telephony/connect', { apiKey, connectionId, publicBaseUrl: publicUrl || undefined }))}
            >
              {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              Verify &amp; connect
            </button>
          </div>
        ) : null}

        {connected && !telnyx?.numberAttached ? (
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <p className="flex items-center gap-2 text-slate-600">
              <KeyRound className="h-4 w-4 text-purple-600" /> Step 2 — attach a number. Use one you already own, or buy a new one.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-slate-700">
                Your Telnyx number (E.164)
                <input
                  className="input mt-1 w-56 font-mono"
                  value={attachNumberInput}
                  onChange={(e) => setAttachNumberInput(e.target.value)}
                  placeholder="+14155550142"
                />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={busy !== null || !attachNumberInput}
                onClick={() =>
                  run('attach', async () => {
                    const s = await post<TelnyxStatus>('/telephony/attach-number', { phoneNumber: attachNumberInput });
                    if (s.numberAttached) setNote('Number attached — inbound calls now reach the AI agent.');
                    return s;
                  })
                }
              >
                {busy === 'attach' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                Attach number
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Or buy a number — area code
                  <input className="input mt-1 w-28" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="512" maxLength={3} />
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy !== null}
                  onClick={() => run('search', () => fetchAvailable(areaCode, setAvailable))}
                >
                  {busy === 'search' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>
              {available ? (
                <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {available.map((n) => (
                    <div key={n.phoneNumber} className="flex items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-900">{n.phoneNumber}</p>
                        <p className="text-xs text-slate-500">
                          {n.region}
                          {n.monthlyCost ? ` · $${n.monthlyCost}/mo` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost !text-xs"
                        disabled={busy !== null}
                        onClick={() =>
                          run(`order-${n.phoneNumber}`, async () => {
                            const s = await post<TelnyxStatus>('/telephony/order-number', { phoneNumber: n.phoneNumber });
                            if (s.numberAttached) setNote(`${n.phoneNumber} purchased and attached.`);
                            return s;
                          })
                        }
                      >
                        {busy === `order-${n.phoneNumber}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                        Buy &amp; attach
                      </button>
                    </div>
                  ))}
                  {available.length === 0 ? <p className="px-3 py-4 text-center text-xs text-slate-400">No numbers in that area code — try another.</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!connected ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            No Telnyx account yet? The <span className="font-medium">Simulate inbound call</span> button runs the exact same AI agent engine in
            real time — same state machine real calls will use.
          </p>
        ) : null}

        {note ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">{note}</p> : null}
        {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p> : null}
      </div>
    </SectionCard>
  );
}

async function fetchAvailable(areaCode: string, set: (n: AvailableNumber[]) => void) {
  const body = await apiFetch<AvailableNumber[]>(`/telephony/available-numbers?areaCode=${encodeURIComponent(areaCode)}`);
  set(body);
}
