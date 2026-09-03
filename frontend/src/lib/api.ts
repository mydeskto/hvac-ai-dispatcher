'use client';

import useSWR, { SWRConfiguration } from 'swr';

/** Same-origin by default; Next rewrites /api/* to the Express backend (see next.config.mjs). */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

/** All CRM data polls the Express backend every 5 seconds (no webhooks). */
export const POLL_INTERVAL_MS = 5000;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function usePolling<T>(path: string | null, config?: SWRConfiguration) {
  return useSWR<T>(path, (p: string) => apiFetch<T>(p), {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...config,
  });
}

export const post = <T,>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const patch = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const put = <T,>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
