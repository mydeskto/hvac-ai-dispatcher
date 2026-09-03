import { BookingStatus, ServiceType } from './types';

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-orange-100 text-orange-700 ring-orange-200',
  Confirmed: 'bg-purple-100 text-purple-700 ring-purple-200',
  Cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
  Completed: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
};

export const serviceStyles: Record<ServiceType, string> = {
  Cooling: 'bg-purple-50 text-purple-700 ring-purple-200',
  Heating: 'bg-orange-50 text-orange-700 ring-orange-200',
  Emergency: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const CHART_COLORS = {
  purple: '#7c3aed',
  purpleLight: '#c4b5fd',
  orange: '#f97316',
  orangeLight: '#fdba74',
  slate: '#94a3b8',
  emerald: '#10b981',
};
