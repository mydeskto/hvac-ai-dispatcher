'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { EmptyRow, SectionCard } from '@/components/ui';
import { API_BASE, usePolling } from '@/lib/api';
import { formatDate, formatDuration, formatTime } from '@/lib/format';
import { Call } from '@/lib/types';

export default function CallsPage() {
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState('');
  const [selected, setSelected] = useState<Call | null>(null);

  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (outcome) query.set('outcome', outcome);
  const { data: calls, isLoading } = usePolling<Call[]>(`/calls${query.toString() ? `?${query}` : ''}`);

  const current = selected ? (calls ?? []).find((c) => c.id === selected.id) ?? selected : null;

  return (
    <>
      <TopBar title="Calls" subtitle="Every inbound call handled by the AI voice agent, with recording and transcription" />
      <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <SectionCard
          title={`Call log${calls ? ` (${calls.length})` : ''}`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Search number, customer, transcript…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select className="input w-40" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">All outcomes</option>
                <option value="booked">Booked</option>
                <option value="no-booking">No booking</option>
                <option value="in-progress">In progress</option>
              </select>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Time</th>
                  <th className="th">Customer number</th>
                  <th className="th">Status</th>
                  <th className="th">Duration</th>
                  <th className="th">Recording</th>
                  <th className="th">Transcription</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(calls ?? []).map((call) => (
                  <tr key={call.id} className="align-middle hover:bg-purple-50/40">
                    <td className="td whitespace-nowrap">{formatDate(call.startedAt)}</td>
                    <td className="td whitespace-nowrap">{formatTime(call.startedAt)}</td>
                    <td className="td whitespace-nowrap font-medium text-slate-900">
                      {call.from}
                      {call.customerName ? <span className="block text-xs text-slate-400">{call.customerName}</span> : null}
                    </td>
                    <td className="td">
                      <span
                        className={`badge ${
                          call.bookingStatus === 'Confirmed'
                            ? 'bg-purple-100 text-purple-700 ring-purple-200'
                            : call.bookingStatus === 'Pending'
                              ? 'bg-orange-100 text-orange-700 ring-orange-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {call.bookingStatus ?? call.outcome}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap">{formatDuration(call.durationSec)}</td>
                    <td className="td">
                      <audio controls preload="none" className="h-8 w-52" src={`${API_BASE.replace(/\/api$/, '')}${call.recordingUrl}`} />
                    </td>
                    <td className="td">
                      <button type="button" className="btn-ghost" onClick={() => setSelected(call)}>
                        View transcript
                      </button>
                    </td>
                  </tr>
                ))}
                {!isLoading && (calls ?? []).length === 0 ? <EmptyRow colSpan={7}>No calls match your filters.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </main>

      {current ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30" onClick={() => setSelected(null)}>
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Call transcription</h2>
                <p className="text-sm text-slate-500">
                  {current.from} · {formatDate(current.startedAt)} {formatTime(current.startedAt)} · {formatDuration(current.durationSec)}
                </p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-200 p-6">
              <audio controls className="w-full" src={`${API_BASE.replace(/\/api$/, '')}${current.recordingUrl}`} />
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-6">
              {current.transcript.map((line, i) => (
                <div key={i} className={`flex ${line.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      line.speaker === 'agent' ? 'bg-purple-50 text-purple-900' : 'bg-orange-50 text-orange-900'
                    }`}
                  >
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-60">
                      {line.speaker === 'agent' ? 'AI agent' : 'Caller'}
                    </p>
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
