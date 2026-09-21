'use client';

import { CheckCircle2, ExternalLink, KeyRound, MapPin, Radio, X } from 'lucide-react';
import { usePolling } from '@/lib/api';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { JobStage, TechWorkDetail } from '@/lib/types';
import { ServiceBadge, StatusBadge } from './ui';

const STAGE_LABEL: Record<JobStage, string> = { Assigned: 'Assigned', EnRoute: 'En route', OnSite: 'On site', Done: 'Done' };

const STAGE_STYLES: Record<JobStage, string> = {
  Assigned: 'bg-slate-100 text-slate-600 ring-slate-200',
  EnRoute: 'bg-orange-100 text-orange-700 ring-orange-200',
  OnSite: 'bg-purple-100 text-purple-700 ring-purple-200',
  Done: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export function TechWorkModal({ technicianId, onClose }: { technicianId: string; onClose: () => void }) {
  const { data } = usePolling<TechWorkDetail>(`/technicians/${technicianId}/work`);
  const tech = data?.technician;
  const summary = data?.summary;
  const jobs = data?.jobs ?? [];
  const upcoming = jobs.filter((b) => b.jobStage !== 'Done' && b.status !== 'Completed');
  const done = jobs.filter((b) => b.jobStage === 'Done' || b.status === 'Completed').slice(-6).reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{tech?.name ?? 'Technician'} — work tracking</h2>
            <p className="text-sm text-slate-500">{tech?.phone}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jobs today</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary?.jobsToday ?? '–'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Done this week</p>
            <p className="mt-1 text-xl font-bold text-purple-600">{summary?.completedWeek ?? '–'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total done</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{summary?.completedTotal ?? '–'}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours / week</p>
            <p className="mt-1 text-xl font-bold text-orange-500">{summary?.hoursThisWeek ?? '–'}</p>
          </div>
        </div>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Radio className={`h-3.5 w-3.5 ${tech?.sharingLocation ? 'animate-pulse text-emerald-500' : 'text-slate-300'}`} />
              Live location {tech?.sharingLocation ? '(sharing)' : '(not sharing)'}
            </p>
            {tech?.location ? (
              <>
                <iframe
                  title="Technician location"
                  src={`https://www.google.com/maps?q=${tech.location.lat},${tech.location.lng}&z=14&output=embed`}
                  className="h-44 w-full rounded-lg border border-slate-200"
                  loading="lazy"
                />
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {tech.location.lat.toFixed(4)}, {tech.location.lng.toFixed(4)} · updated {formatTime(tech.location.updatedAt)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${tech.location.lat},${tech.location.lng}&z=15`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 font-medium text-purple-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Google Maps
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">No location fix yet.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <KeyRound className="h-3.5 w-3.5 text-purple-600" /> Field app sign-in
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-slate-500">PIN</span>
              <span className="rounded-lg bg-purple-50 px-3 py-1 font-mono text-2xl font-bold tracking-widest text-purple-700">{tech?.pin}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Share this PIN with the technician — they sign in at <span className="font-mono">/login → Technician</span> with their phone
              number.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tech?.skills.map((s) => (
                <ServiceBadge key={s} service={s} />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Shift {tech?.workingHours.start}–{tech?.workingHours.end} · {tech?.active ? 'On duty' : 'Off duty'}
            </p>
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Assigned &amp; in progress</h3>
        <div className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {upcoming.map((b) => (
            <div key={b.id} className="px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {b.serviceType} · {b.customerName ?? b.customerPhone}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`badge ${STAGE_STYLES[b.jobStage]}`}>{STAGE_LABEL[b.jobStage]}</span>
                  <StatusBadge status={b.status} />
                </div>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />
                {formatDate(b.start)} {formatTime(b.start)}–{formatTime(b.end)} · {b.location}
                {b.coords ? (
                  <a
                    href={`https://www.google.com/maps?q=${b.coords.lat},${b.coords.lng}&z=15`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-purple-600 hover:underline"
                  >
                    Map
                  </a>
                ) : null}
              </p>
            </div>
          ))}
          {upcoming.length === 0 ? <p className="px-3 py-4 text-center text-sm text-slate-400">No open jobs.</p> : null}
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">Completed work</h3>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {done.map((b) => (
            <div key={b.id} className="px-3 py-2.5">
              <p className="text-sm font-medium text-slate-900">
                {b.serviceType} · {b.customerName ?? b.customerPhone} <span className="font-normal text-slate-400">— {b.location}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {b.jobEvents.map((ev, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {STAGE_LABEL[ev.stage]} · {formatDateTime(ev.at)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {done.length === 0 ? <p className="px-3 py-4 text-center text-sm text-slate-400">No completed jobs yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
