'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { TopBar } from '@/components/TopBar';
import { SectionCard } from '@/components/ui';
import { post, usePolling } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { WhatsAppMessage } from '@/lib/types';

export default function WhatsAppPage() {
  const { data: messages } = usePolling<WhatsAppMessage[]>('/whatsapp');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(message: WhatsAppMessage, response: 'Confirm Booking' | 'Cancel Booking') {
    setBusy(message.id);
    setError(null);
    try {
      await post(`/whatsapp/${message.id}/respond`, { response });
      await mutate(() => true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply the response');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <TopBar
        title="WhatsApp confirmations"
        subtitle="Every booking triggers a WhatsApp message with Confirm / Cancel buttons — tap a button to simulate the customer"
      />
      <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        {error ? <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        <SectionCard title={`Outbound messages${messages ? ` (${messages.length})` : ''}`}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(messages ?? []).slice(0, 24).map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{m.to}</span>
                  <span>{formatDateTime(m.sentAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-line rounded-lg bg-white p-3 text-sm text-slate-700 shadow-sm">{m.body}</p>
                {m.response ? (
                  <p className="mt-3 text-xs font-semibold text-purple-700">
                    Customer tapped “{m.response}” · {m.respondedAt ? formatDateTime(m.respondedAt) : ''}
                  </p>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="btn-primary flex-1 justify-center" disabled={busy === m.id} onClick={() => respond(m, 'Confirm Booking')}>
                      Confirm Booking
                    </button>
                    <button type="button" className="btn-secondary flex-1 justify-center" disabled={busy === m.id} onClick={() => respond(m, 'Cancel Booking')}>
                      Cancel Booking
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </main>
    </>
  );
}
