'use client';

import { BookingStatus, ServiceType } from '@/lib/types';
import { serviceStyles, statusStyles } from '@/lib/format';

export function StatCard({
  label,
  value,
  hint,
  accent = 'purple',
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'purple' | 'orange' | 'slate';
  icon?: React.ReactNode;
}) {
  const accents = {
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-600',
  } as const;
  return (
    <div className="card flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {icon ? <div className={`rounded-lg p-2.5 ${accents[accent]}`}>{icon}</div> : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge ${statusStyles[status]}`}>{status}</span>;
}

export function ServiceBadge({ service }: { service: ServiceType }) {
  return <span className={`badge ${serviceStyles[service]}`}>{service}</span>;
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  );
}
