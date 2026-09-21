'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { GeoPoint } from '@/lib/types';

export interface MapMarkerData {
  id: string;
  position: GeoPoint;
  kind: 'tech' | 'job';
  color: string;
  label: string;
  sublabel?: string;
  pulse?: boolean;
  mapsUrl?: string;
}

export interface MapLineData {
  id: string;
  from: GeoPoint;
  to: GeoPoint;
}

export function LiveMap({
  markers,
  lines,
  focusId,
  className = 'h-[560px] w-full',
}: {
  markers: MapMarkerData[];
  lines: MapLineData[];
  focusId?: string | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const markerRefs = useRef(new globalThis.Map<string, Leaflet.Marker>());
  const lineRefs = useRef<Leaflet.Polyline[]>([]);
  const readyRef = useRef(false);

  function draw() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const icon = L.divIcon({
        className: '',
        html: `<span class="tm ${m.kind === 'tech' ? 'tm-tech' : 'tm-job'} ${m.pulse ? 'tm-pulse' : ''}" style="background:${m.color}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const popup = `<div class="tm-pop"><b>${m.label}</b>${m.sublabel ? `<br/><span>${m.sublabel}</span>` : ''}${
        m.mapsUrl ? `<br/><a href="${m.mapsUrl}" target="_blank" rel="noreferrer">Open in Google Maps</a>` : ''
      }</div>`;
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.position.lat, m.position.lng]);
        existing.setIcon(icon);
        existing.setPopupContent(popup);
      } else {
        markerRefs.current.set(m.id, L.marker([m.position.lat, m.position.lng], { icon }).addTo(map).bindPopup(popup));
      }
    }
    const stale: string[] = [];
    markerRefs.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        stale.push(id);
      }
    });
    stale.forEach((id) => markerRefs.current.delete(id));

    lineRefs.current.forEach((l) => l.remove());
    lineRefs.current = lines.map((l) =>
      L.polyline(
        [
          [l.from.lat, l.from.lng],
          [l.to.lat, l.to.lng],
        ],
        { color: '#f97316', weight: 3, dashArray: '6 8', opacity: 0.8 },
      ).addTo(map),
    );

    if (focusId) {
      const target = markers.find((m) => m.id === focusId);
      if (target) map.setView([target.position.lat, target.position.lng], Math.max(map.getZoom(), 13), { animate: true });
    }
  }

  useEffect(() => {
    let disposed = false;
    import('leaflet').then((L) => {
      if (disposed || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: true }).setView([30.2672, -97.7431], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      readyRef.current = true;
      draw();
    });
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRefs.current.clear();
      lineRefs.current = [];
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (readyRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, lines, focusId]);

  return <div ref={containerRef} className={`${className} overflow-hidden rounded-xl border border-slate-200`} />;
}
