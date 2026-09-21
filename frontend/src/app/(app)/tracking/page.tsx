'use client';

import { CircleDot, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LiveMap, MapLineData, MapMarkerData } from '@/components/LiveMap';
import { TopBar } from '@/components/TopBar';
import { SectionCard, ServiceBadge } from '@/components/ui';
import { usePolling } from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/format';
import { JobStage, TrackingEntry } from '@/lib/types';

const STAGE_LABEL: Record<JobStage, string> = { Assigned: 'Assigned', EnRoute: 'En route', OnSite: 'On site', Done: 'Done' };

const TECH_COLORS = ['#7c3aed', '#f97316', '#0ea5e9', '#10b981', '#e11d48', '#eab308'];

function lastSeen(updatedAt?: string): string {
  if (!updatedAt) return 'no fix';
  const secs = Math.max(0, Math.round((Date.now() - Date.parse(updatedAt)) / 1000));
  if (secs < 10) return 'live';
  if (secs < 90) return `${secs}s ago`;
  return `${Math.round(secs / 60)}m ago`;
}

export default function TrackingPage() {
  const { data: techs } = usePolling<TrackingEntry[]>('/tracking');
  const [focusId, setFocusId] = useState<string | null>(null);

  const markers = useMemo<MapMarkerData[]>(() => {
    const out: MapMarkerData[] = [];
    (techs ?? []).forEach((t, i) => {
      const color = TECH_COLORS[i % TECH_COLORS.length];
      if (t.location) {
        out.push({
          id: `tech-${t.id}`,
          position: t.location,
          kind: 'tech',
          color: t.sharingLocation ? color : '#94a3b8',
          label: t.name,
          sublabel: t.job ? `${STAGE_LABEL[t.job.jobStage]} · ${t.job.serviceType}` : 'No active job',
          pulse: t.sharingLocation && t.job?.jobStage === 'EnRoute',
          mapsUrl: `https://www.google.com/maps?q=${t.location.lat},${t.location.lng}&z=15`,
        });
      }
      if (t.job?.coords) {
        out.push({
          id: `job-${t.job.id}`,
          position: t.job.coords,
          kind: 'job',
          color,
          label: `${t.job.serviceType} — ${t.job.customerName ?? t.job.customerPhone}`,
          sublabel: t.job.location ?? '',
          mapsUrl: `https://www.google.com/maps?q=${t.job.coords.lat},${t.job.coords.lng}&z=15`,
        });
      }
    });
    return out;
  }, [techs]);

  const lines = useMemo<MapLineData[]>(
    () =>
      (techs ?? [])
        .filter((t) => t.location && t.job?.coords && (t.job.jobStage === 'EnRoute' || t.job.jobStage === 'OnSite'))
        .map((t) => ({ id: `line-${t.id}`, from: t.location as { lat: number; lng: number }, to: t.job!.coords! })),
    [techs],
  );

  const enRoute = (techs ?? []).filter((t) => t.job?.jobStage === 'EnRoute').length;
  const onSite = (techs ?? []).filter((t) => t.job?.jobStage === 'OnSite').length;
  const sharing = (techs ?? []).filter((t) => t.sharingLocation).length;

  return (
    <>
      <TopBar title="Live tracking" subtitle="Watch technicians move between jobs in real time — like inDrive" />
      <main className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="card !p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On the road</p>
            <p className="mt-1 text-2xl font-bold text-orange-500">{enRoute}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On site</p>
            <p className="mt-1 text-2xl font-bold text-purple-600">{onSite}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sharing GPS</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{sharing}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Technicians</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{(techs ?? []).length}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <SectionCard title="Fleet map" className="!p-3">
            <LiveMap markers={markers} lines={lines} focusId={focusId} className="h-[600px] w-full" />
            <div className="mt-3 flex flex-wrap items-center gap-4 px-2 pb-1 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full bg-purple-600" /> Technician
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rotate-45 bg-orange-500" /> Job site
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-orange-500" /> En-route path
              </span>
            </div>
          </SectionCard>

          <SectionCard title="Technicians" className="max-h-[700px] overflow-y-auto">
            <div className="space-y-3">
              {(techs ?? []).map((t, i) => {
                const color = TECH_COLORS[i % TECH_COLORS.length];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFocusId(`tech-${t.id}`)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-purple-300 hover:bg-purple-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.sharingLocation ? color : '#cbd5e1' }} />
                        {t.name}
                      </p>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <CircleDot className={`h-3.5 w-3.5 ${t.sharingLocation ? 'animate-pulse text-emerald-500' : 'text-slate-300'}`} />
                        {t.sharingLocation ? lastSeen(t.location?.updatedAt) : 'not sharing'}
                      </span>
                    </div>
                    {t.job ? (
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        <p className="flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-orange-500" />
                          {STAGE_LABEL[t.job.jobStage]} · <ServiceBadge service={t.job.serviceType} />
                          {t.job.distanceKm !== null ? <span className="text-slate-400">{t.job.distanceKm} km away</span> : null}
                        </p>
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {t.job.location}
                        </p>
                        <p className="text-slate-400">
                          {formatDateTime(t.job.start)} → {formatTime(t.job.end)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">No active job</p>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Phone className="h-3 w-3" /> {t.phone}
                      </span>
                      {t.location ? (
                        <a
                          href={`https://www.google.com/maps?q=${t.location.lat},${t.location.lng}&z=15`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 font-medium text-purple-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3 w-3" /> Google Maps
                        </a>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>
      </main>
    </>
  );
}
