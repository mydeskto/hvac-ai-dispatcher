'use client';

import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { mutate } from 'swr';
import { BookingModal } from '@/components/BookingModal';
import { TopBar } from '@/components/TopBar';
import { EmptyRow, SectionCard, ServiceBadge, StatusBadge } from '@/components/ui';
import { patch, usePolling } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import { Booking } from '@/lib/types';

export default function BookingsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Booking | null>(null);
  const [creating, setCreating] = useState(false);

  const query = new URLSearchParams();
  if (search.trim()) query.set('search', search.trim());
  if (status) query.set('status', status);
  const { data: bookings } = usePolling<Booking[]>(`/bookings${query.toString() ? `?${query}` : ''}`);

  async function quickStatus(booking: Booking, next: 'Confirmed' | 'Cancelled' | 'Completed') {
    await patch(`/bookings/${booking.id}`, { status: next });
    await mutate(() => true);
  }

  return (
    <>
      <TopBar title="Bookings" subtitle="Dispatchers can confirm, cancel, reschedule or reassign any booking" />
      <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <SectionCard
          title={`Bookings${bookings ? ` (${bookings.length})` : ''}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input className="input pl-9" placeholder="Search customer, address, tech…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option>Pending</option>
                <option>Confirmed</option>
                <option>Cancelled</option>
                <option>Completed</option>
              </select>
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New booking
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="th">Customer</th>
                  <th className="th">Service</th>
                  <th className="th">Scheduled</th>
                  <th className="th">Technician</th>
                  <th className="th">Status</th>
                  <th className="th">WhatsApp</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(bookings ?? []).map((b) => (
                  <tr key={b.id} className="hover:bg-purple-50/40">
                    <td className="td">
                      <span className="font-medium text-slate-900">{b.customerName ?? 'Unknown caller'}</span>
                      <span className="block text-xs text-slate-400">{b.customerPhone}</span>
                      <span className="block text-xs text-slate-400">{b.location}</span>
                    </td>
                    <td className="td">
                      <ServiceBadge service={b.serviceType} />
                    </td>
                    <td className="td whitespace-nowrap">
                      {formatDate(b.start)}
                      <span className="block text-xs text-slate-400">
                        {formatTime(b.start)} – {formatTime(b.end)}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap">{b.technicianName}</td>
                    <td className="td">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="td text-xs text-slate-500">
                      {b.whatsappMessage ? b.whatsappMessage.response ?? 'Awaiting reply' : 'Not sent'}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className="btn-ghost" onClick={() => setEditing(b)}>
                          Edit
                        </button>
                        {b.status !== 'Confirmed' && b.status !== 'Completed' ? (
                          <button type="button" className="btn-ghost" onClick={() => quickStatus(b, 'Confirmed')}>
                            Confirm
                          </button>
                        ) : null}
                        {b.status !== 'Cancelled' ? (
                          <button type="button" className="btn-ghost" onClick={() => quickStatus(b, 'Cancelled')}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {(bookings ?? []).length === 0 ? <EmptyRow colSpan={7}>No bookings match your filters.</EmptyRow> : null}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </main>

      {editing ? <BookingModal booking={editing} onClose={() => setEditing(null)} /> : null}
      {creating ? <BookingModal booking={null} onClose={() => setCreating(false)} /> : null}
    </>
  );
}
