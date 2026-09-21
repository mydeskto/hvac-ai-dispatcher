'use client';

import {
  CheckCircle2,
  CircleDot,
  Clock,
  History,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Wrench,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { mutate } from 'swr';
import { clearTechSession, getTechToken, techPost, useTechPolling } from '@/lib/api';
import { formatDate, formatDateTime, formatTime } from '@/lib/format';
import { Booking, JobStage, Technician, TechSummary } from '@/lib/types';

const STAGE_LABEL: Record<JobStage, string> = {
  Assigned: 'Assigned',
  EnRoute: 'En route',
  OnSite: 'On site',
  Done: 'Done',
};

const STAGE_STYLES: Record<JobStage, string> = {
  Assigned: 'bg-slate-100 text-slate-600 ring-slate-200',
  EnRoute: 'bg-orange-100 text-orange-700 ring-orange-200',
  OnSite: 'bg-purple-100 text-purple-700 ring-purple-200',
  Done: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

const NEXT_ACTION: Partial<Record<JobStage, { stage: JobStage; label: string }>> = {
  Assigned: { stage: 'EnRoute', label: 'Start travel' },
  EnRoute: { stage: 'OnSite', label: 'Arrived on site' },
  OnSite: { stage: 'Done', label: 'Complete job' },
};

export function StageBadge({ stage }: { stage: JobStage }) {
  return <span className={`badge ${STAGE_STYLES[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

function googleEmbed(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}&z=14&output=embed`;
}

function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function TechPortalPage() {
  const router = useRouter();
  const { data: me, error: meError } = useTechPolling<{ technician: Technician; summary: TechSummary }>('/tech/me');
  const { data: jobs } = useTechPolling<Booking[]>('/tech/jobs');
  const [sharing, setSharing] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);

  const technician = me?.technician;
  const summary = me?.summary;

  const activeJob = useMemo(() => {
    if (!jobs) return null;
    return jobs.find((b) => b.id === summary?.activeJobId) ?? jobs.find((b) => b.jobStage === 'EnRoute' || b.jobStage === 'OnSite') ?? null;
  }, [jobs, summary?.activeJobId]);

  const upcoming = useMemo(
    () =>
      (jobs ?? []).filter(
        (b) => b.jobStage !== 'Done' && b.status !== 'Completed' && b.id !== activeJob?.id && new Date(b.end) > new Date(),
      ),
    [jobs, activeJob],
  );

  const history = useMemo(
    () => (jobs ?? []).filter((b) => b.jobStage === 'Done' || b.status === 'Completed').slice(-8).reverse(),
    [jobs],
  );

  // Redirect to sign-in when the session is missing or expired.
  useEffect(() => {
    if (!getTechToken() || meError) {
      clearTechSession();
      router.replace('/login?role=tech');
    }
  }, [meError, router]);

  // Live location sharing: real GPS when available, otherwise the backend simulates drift.
  useEffect(() => {
    if (!sharing) {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
      watchRef.current = null;
      return;
    }
    if ('geolocation' in navigator) {
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          techPost('/tech/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, sharing: true }).catch(() => undefined);
          setGeoNote(null);
        },
        () => setGeoNote('GPS unavailable — position simulated by dispatch.'),
        { enableHighAccuracy: true, maximumAge: 10_000 },
      );
    } else {
      setGeoNote('GPS unavailable — position simulated by dispatch.');
    }
    return () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    };
  }, [sharing]);

  async function toggleSharing() {
    const next = !sharing;
    setSharing(next);
    if (!next) await techPost('/tech/location', { lat: technician?.location?.lat ?? 30.2672, lng: technician?.location?.lng ?? -97.7431, sharing: false }).catch(() => undefined);
    else if (!('geolocation' in navigator)) {
      await techPost('/tech/location', { lat: technician?.location?.lat ?? 30.2672, lng: technician?.location?.lng ?? -97.7431, sharing: true }).catch(() => undefined);
    }
    await mutate('/tech/me');
  }

  async function advanceStage(job: Booking, stage: JobStage) {
    setBusy(true);
    try {
      await techPost(`/tech/jobs/${job.id}/stage`, { stage, note: note || undefined });
      setNote('');
      await mutate(() => true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await techPost('/tech/logout').catch(() => undefined);
    clearTechSession();
    router.push('/login?role=tech');
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="sticky top-0 z-20 -mx-4 mb-6 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{technician?.name ?? 'Technician'}</p>
              <p className="flex items-center gap-1 text-xs text-slate-500">
                <Phone className="h-3 w-3" /> {technician?.phone} · Field app
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSharing}
              className={`btn-ghost ${sharing ? 'border-emerald-300 text-emerald-700' : ''}`}
              title="Share live location with dispatch"
            >
              <Radio className={`h-4 w-4 ${sharing ? 'animate-pulse text-emerald-500' : ''}`} />
              {sharing ? 'Sharing live' : 'Share location'}
            </button>
            <button type="button" className="btn-ghost" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      {geoNote ? <p className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700">{geoNote}</p> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jobs today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.jobsToday ?? '–'}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Done today</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{summary?.completedToday ?? '–'}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Done this week</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">{summary?.completedWeek ?? '–'}</p>
        </div>
        <div className="card !p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hours this week</p>
          <p className="mt-1 text-2xl font-bold text-orange-500">{summary?.hoursThisWeek ?? '–'}</p>
        </div>
      </div>

      {activeJob ? (
        <section className="card mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Current job — {activeJob.serviceType}</h2>
              <p className="text-sm text-slate-500">
                {formatDateTime(activeJob.start)} → {formatTime(activeJob.end)}
              </p>
            </div>
            <StageBadge stage={activeJob.jobStage} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-900">{activeJob.customerName ?? 'Customer'}</p>
                <p className="text-slate-600">{activeJob.customerPhone}</p>
                <p className="mt-1 flex items-start gap-1.5 text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                  {activeJob.location}
                </p>
                {activeJob.notes ? <p className="mt-2 text-xs text-slate-500">{activeJob.notes}</p> : null}
              </div>

              <ol className="space-y-2">
                {activeJob.jobEvents.map((ev, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="font-medium">{STAGE_LABEL[ev.stage]}</span>
                    <span className="text-slate-400">{formatDateTime(ev.at)}</span>
                    {ev.note ? <span className="text-slate-400">· {ev.note}</span> : null}
                  </li>
                ))}
              </ol>

              {NEXT_ACTION[activeJob.jobStage] ? (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <input
                    className="input"
                    placeholder="Note for dispatch (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => advanceStage(activeJob, NEXT_ACTION[activeJob.jobStage]!.stage)}
                    >
                      <Navigation className="h-4 w-4" />
                      {NEXT_ACTION[activeJob.jobStage]!.label}
                    </button>
                    {activeJob.coords ? (
                      <a className="btn-ghost" href={directionsUrl(activeJob.coords.lat, activeJob.coords.lng)} target="_blank" rel="noreferrer">
                        <MapPin className="h-4 w-4" /> Directions
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              {activeJob.coords ? (
                <iframe title="Job location" src={googleEmbed(activeJob.coords.lat, activeJob.coords.lng)} className="h-72 w-full md:h-full" loading="lazy" />
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-slate-400">No coordinates for this address</div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="card mb-6 flex items-center gap-3 text-sm text-slate-500">
          <CircleDot className="h-5 w-5 text-emerald-500" />
          No active job right now. Upcoming bookings appear below.
        </section>
      )}

      <section className="card mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock className="h-4 w-4 text-purple-600" /> Upcoming schedule
        </h2>
        <div className="divide-y divide-slate-100">
          {upcoming.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {b.serviceType} · {b.customerName ?? b.customerPhone}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(b.start)} · {formatTime(b.start)}–{formatTime(b.end)} · {b.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StageBadge stage={b.jobStage} />
                {b.coords ? (
                  <a
                    className="btn-ghost !px-2 !py-1 text-xs"
                    href={`https://www.google.com/maps?q=${b.coords.lat},${b.coords.lng}&z=15`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5" /> Map
                  </a>
                ) : null}
              </div>
            </div>
          ))}
          {upcoming.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Nothing scheduled.</p> : null}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-orange-500" /> Recent completed work
        </h2>
        <div className="divide-y divide-slate-100">
          {history.map((b) => (
            <div key={b.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {b.serviceType} · {b.customerName ?? b.customerPhone}
                </p>
                <StageBadge stage={b.jobStage} />
              </div>
              <p className="text-xs text-slate-500">{formatDate(b.start)} · {b.location}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {b.jobEvents.map((ev, i) => (
                  <span key={i} className="text-xs text-slate-400">
                    {STAGE_LABEL[ev.stage]} {formatTime(ev.at)}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {history.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No completed jobs yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
