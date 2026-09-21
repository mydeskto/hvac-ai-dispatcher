import { GeoPoint } from './types';

/** Service area center: Austin, TX (matches the seeded customer addresses). */
export const SERVICE_CENTER: GeoPoint = { lat: 30.2672, lng: -97.7431 };

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic mock geocoder: the same address always resolves to the same
 * point inside the Austin service area. Swap for a real geocoder (Google
 * Geocoding API) when wiring real addresses.
 */
export function geocode(address: string): GeoPoint {
  const h1 = hash(address);
  const h2 = hash([...address].reverse().join(''));
  return {
    lat: 30.15 + (h1 % 10000) / 10000 / 3, // 30.15 – 30.48
    lng: -97.95 + (h2 % 10000) / 10000 / 2.5, // -97.95 – -97.55
  };
}

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

export function moveToward(from: GeoPoint, to: GeoPoint, fraction: number): GeoPoint {
  return {
    lat: from.lat + (to.lat - from.lat) * fraction,
    lng: from.lng + (to.lng - from.lng) * fraction,
  };
}

export function googleMapsLink(point: GeoPoint): string {
  return `https://www.google.com/maps?q=${point.lat},${point.lng}&z=15`;
}
