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

/* ------------------------- technician portal auth ------------------------ */

export const TECH_TOKEN_KEY = 'hvac_tech_token';

export function getTechToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TECH_TOKEN_KEY);
}

export function clearTechSession() {
  window.localStorage.removeItem(TECH_TOKEN_KEY);
  document.cookie = 'hvac_tech=; Max-Age=0; path=/';
}

export async function techFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getTechToken();
  return apiFetch<T>(path, {
    ...init,
    headers: { ...(token ? { 'x-tech-token': token } : {}), ...(init?.headers ?? {}) },
  });
}

export function useTechPolling<T>(path: string | null, config?: SWRConfiguration) {
  return useSWR<T>(path, (p: string) => techFetch<T>(p), {
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
    ...config,
  });
}

export const techPost = <T,>(path: string, body?: unknown) =>
  techFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
