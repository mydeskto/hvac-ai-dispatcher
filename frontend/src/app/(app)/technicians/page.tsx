'use client';

import { CircleDot, Clock, Phone } from 'lucide-react';
import { useState } from 'react';
import { mutate } from 'swr';
import { TopBar } from '@/components/TopBar';
import { SectionCard, ServiceBadge } from '@/components/ui';
import { patch, post, usePolling } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { ServiceType, Technician } from '@/lib/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SERVICES: ServiceType[] = ['Cooling', 'Heating', 'Emergency'];

export default function TechniciansPage() {
  const { data: technicians } = usePolling<Technician[]>('/technicians');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', skills: ['Cooling'] as ServiceType[], start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5] });
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(t: Technician) {
    await patch(`/technicians/${t.id}`, { active: !t.active });
    await mutate(() => true);
  }

  async function addTechnician() {
    setError(null);
    try {
      await post('/technicians', {
        name: form.name,
        phone: form.phone,
        skills: form.skills,
        workingHours: { days: form.days, start: form.start, end: form.end },
      });
      setAdding(false);
      setForm({ name: '', phone: '', skills: ['Cooling'], start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5] });
      await mutate(() => true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add technician');
    }
  }

  return (
    <>
      <TopBar title="Technicians" subtitle="Working hours and real-time availability the AI agent checks before booking" />
      <main className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(technicians ?? []).map((t) => (
            <div key={t.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">{t.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Phone className="h-3.5 w-3.5" /> {t.phone}
                  </p>
                </div>
                <span
                  className={`badge ${
                    !t.active
                      ? 'bg-slate-100 text-slate-500 ring-slate-200'
                      : t.availableNow
                        ? 'bg-purple-100 text-purple-700 ring-purple-200'
                        : 'bg-orange-100 text-orange-700 ring-orange-200'
                  }`}
                >
                  <CircleDot className="mr-1 h-3 w-3" />
                  {!t.active ? 'Off duty' : t.availableNow ? 'Available' : 'On a job'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {t.skills.map((s) => (
                  <ServiceBadge key={s} service={s} />
                ))}
              </div>

              <p className="flex items-center gap-1.5 text-sm text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" />
                {t.workingHours.start}–{t.workingHours.end} · {t.workingHours.days.map((d) => DAY_LABELS[d]).join(', ')}
              </p>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                <span className="text-slate-600">
                  {t.upcomingJobs} upcoming job{t.upcomingJobs === 1 ? '' : 's'}
                  {t.nextJobAt ? <span className="block text-xs text-slate-400">Next: {formatDateTime(t.nextJobAt)}</span> : null}
                </span>
                <button type="button" className="btn-ghost" onClick={() => toggleActive(t)}>
                  {t.active ? 'Set off duty' : 'Set on duty'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title="Add a technician"
          action={
            <button type="button" className="btn-ghost" onClick={() => setAdding((v) => !v)}>
              {adding ? 'Hide' : 'Show form'}
            </button>
          }
        >
          {adding ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium text-slate-700">
                Name
                <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Phone
                <input className="input mt-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Shift start
                <input type="time" className="input mt-1" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Shift end
                <input type="time" className="input mt-1" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
              <div className="text-sm font-medium text-slate-700 sm:col-span-2">
                Skills
                <div className="mt-2 flex gap-2">
                  {SERVICES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, skills: form.skills.includes(s) ? form.skills.filter((x) => x !== s) : [...form.skills, s] })
                      }
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        form.skills.includes(s) ? 'bg-purple-600 text-white' : 'border border-slate-200 text-slate-600'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm font-medium text-slate-700 sm:col-span-2">
                Working days
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, days: form.days.includes(index) ? form.days.filter((d) => d !== index) : [...form.days, index] })
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        form.days.includes(index) ? 'bg-orange-500 text-white' : 'border border-slate-200 text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {error ? <p className="text-sm text-rose-600 sm:col-span-4">{error}</p> : null}
              <div className="sm:col-span-4">
                <button type="button" className="btn-primary" onClick={addTechnician} disabled={!form.name || !form.phone || form.skills.length === 0}>
                  Add technician
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Add technicians with their skills and shift hours so the AI agent books only real availability.</p>
          )}
        </SectionCard>
      </main>
    </>
  );
}
