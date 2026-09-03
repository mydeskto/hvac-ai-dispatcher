'use client';

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BookingModal } from '@/components/BookingModal';
import { TopBar } from '@/components/TopBar';
import { SectionCard } from '@/components/ui';
import { usePolling } from '@/lib/api';
import { formatTime } from '@/lib/format';
import { Booking, Technician } from '@/lib/types';

type View = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

const statusBar: Record<string, string> = {
  Confirmed: 'bg-purple-600 text-white',
  Pending: 'bg-orange-500 text-white',
  Completed: 'bg-emerald-500 text-white',
  Cancelled: 'bg-slate-300 text-slate-700 line-through',
};

export default function CalendarPage() {
  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Booking | null>(null);

  const { rangeStart, rangeEnd, days } = useMemo(() => {
    if (view === 'day') {
      return { rangeStart: cursor, rangeEnd: cursor, days: [cursor] };
    }
    if (view === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { rangeStart: start, rangeEnd: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
    }
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const total = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return { rangeStart: start, rangeEnd: end, days: Array.from({ length: total }, (_, i) => addDays(start, i)) };
  }, [view, cursor]);

  const from = new Date(rangeStart);
  from.setHours(0, 0, 0, 0);
  const to = new Date(rangeEnd);
  to.setHours(23, 59, 59, 999);

  const { data: bookings } = usePolling<Booking[]>(`/bookings?from=${from.toISOString()}&to=${to.toISOString()}`);
  const { data: technicians } = usePolling<Technician[]>('/technicians');

  const step = view === 'month' ? 0 : view === 'week' ? 7 : 1;
  const shift = (dir: number) => setCursor((c) => (view === 'month' ? addMonths(c, dir) : addDays(c, dir * step)));

  const label =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(rangeStart, 'MMM d')} – ${format(rangeEnd, 'MMM d, yyyy')}`
        : format(cursor, 'EEEE, MMM d, yyyy');

  const bookingsFor = (day: Date, technicianId?: string) =>
    (bookings ?? []).filter((b) => isSameDay(new Date(b.start), day) && (!technicianId || b.technicianId === technicianId));

  return (
    <>
      <TopBar title="Calendar" subtitle="Bookings per technician — double-booking is blocked by the availability engine" />
      <main className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-8">
        <SectionCard
          title={label}
          action={
            <div className="flex items-center gap-2">
              <button type="button" className="btn-ghost" onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost" onClick={() => setCursor(new Date())}>
                Today
              </button>
              <button type="button" className="btn-ghost" onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="ml-2 flex overflow-hidden rounded-lg border border-slate-200">
                {(['day', 'week', 'month'] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-sm font-medium capitalize transition ${
                      view === v ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {view === 'day' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="th sticky left-0 bg-white">Time</th>
                    {(technicians ?? []).map((t) => (
                      <th key={t.id} className="th min-w-[180px]">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HOURS.map((hour) => (
                    <tr key={hour}>
                      <td className="td sticky left-0 whitespace-nowrap bg-white text-xs text-slate-400">{`${hour}:00`}</td>
                      {(technicians ?? []).map((t) => {
                        const slotBookings = bookingsFor(cursor, t.id).filter((b) => new Date(b.start).getHours() === hour);
                        return (
                          <td key={t.id} className="border-t border-slate-100 p-1 align-top">
                            {slotBookings.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setSelected(b)}
                                className={`mb-1 block w-full rounded-lg px-2 py-1.5 text-left text-xs ${statusBar[b.status]}`}
                              >
                                <span className="block font-semibold">{b.serviceType}</span>
                                <span className="block opacity-90">{b.customerName ?? b.customerPhone}</span>
                              </button>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : view === 'week' ? (
            <div className="grid grid-cols-7 gap-3">
              {days.map((day) => (
                <div key={day.toISOString()} className="min-h-[220px] rounded-lg border border-slate-200 p-2">
                  <p className={`mb-2 text-xs font-semibold ${isSameDay(day, new Date()) ? 'text-orange-500' : 'text-slate-500'}`}>
                    {format(day, 'EEE d')}
                  </p>
                  <div className="space-y-1.5">
                    {bookingsFor(day).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelected(b)}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-[11px] ${statusBar[b.status]}`}
                      >
                        <span className="block font-semibold">{formatTime(b.start)}</span>
                        <span className="block">{b.serviceType}</span>
                        <span className="block opacity-90">{b.technicianName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <p key={d} className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {d}
                </p>
              ))}
              {days.map((day) => {
                const dayBookings = bookingsFor(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[110px] rounded-lg border p-2 ${
                      isSameMonth(day, cursor) ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 text-slate-400'
                    }`}
                  >
                    <p className={`text-xs font-semibold ${isSameDay(day, new Date()) ? 'text-orange-500' : ''}`}>{format(day, 'd')}</p>
                    <div className="mt-1 space-y-1">
                      {dayBookings.slice(0, 3).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelected(b)}
                          className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] ${statusBar[b.status]}`}
                        >
                          {formatTime(b.start)} {b.serviceType}
                        </button>
                      ))}
                      {dayBookings.length > 3 ? <p className="text-[10px] text-slate-400">+{dayBookings.length - 3} more</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
            {Object.entries(statusBar).map(([status, cls]) => (
              <span key={status} className="flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded ${cls}`} /> {status}
              </span>
            ))}
          </div>
        </SectionCard>
      </main>

      {selected ? <BookingModal booking={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
