'use client';

import { CalendarCheck, Clock, PhoneCall, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TopBar } from '@/components/TopBar';
import { SectionCard, StatCard } from '@/components/ui';
import { usePolling } from '@/lib/api';
import { CHART_COLORS, formatDuration, formatTime } from '@/lib/format';
import { Call, Stats } from '@/lib/types';

const RANGES = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This week' },
  { key: 'monthly', label: 'This month' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  Confirmed: CHART_COLORS.purple,
  Pending: CHART_COLORS.orange,
  Cancelled: CHART_COLORS.slate,
  Completed: CHART_COLORS.emerald,
};

export default function DashboardPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('weekly');
  const { data: stats } = usePolling<Stats>(`/stats?range=${range}`);
  const { data: calls } = usePolling<Call[]>('/calls');

  const pieData = stats
    ? Object.entries(stats.bookingsByStatus).map(([name, value]) => ({ name, value }))
    : [];
  const recentCalls = (calls ?? []).slice(0, 6);

  return (
    <>
      <TopBar title="Dashboard" subtitle="Live AI dispatcher performance — data refreshes automatically every 5 seconds" />
      <main className="flex-1 space-y-6 overflow-y-auto bg-slate-50/50 p-8">
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                range === r.key ? 'bg-purple-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-purple-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total calls received"
            value={stats?.totalCalls ?? '—'}
            hint={`${stats?.answeredByAi ?? 0} answered by the AI agent`}
            icon={<PhoneCall className="h-5 w-5" />}
          />
          <StatCard
            label="Bookings created"
            value={stats?.bookingsCreated ?? '—'}
            hint={`${stats?.conversionRate ?? 0}% of calls converted`}
            accent="orange"
            icon={<CalendarCheck className="h-5 w-5" />}
          />
          <StatCard
            label="Avg. call duration"
            value={stats ? formatDuration(stats.avgCallDurationSec) : '—'}
            hint="Across all AI-handled calls"
            icon={<Clock className="h-5 w-5" />}
          />
          <StatCard
            label="Confirmed vs cancelled"
            value={`${stats?.bookingsByStatus.Confirmed ?? 0} / ${stats?.bookingsByStatus.Cancelled ?? 0}`}
            hint={`${stats?.bookingsByStatus.Pending ?? 0} awaiting WhatsApp reply`}
            accent="orange"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <SectionCard title="Calls & bookings trend" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats?.callsPerDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="calls" stroke={CHART_COLORS.purple} strokeWidth={2.5} dot={false} name="Calls" />
                <Line type="monotone" dataKey="bookings" stroke={CHART_COLORS.orange} strokeWidth={2.5} dot={false} name="Bookings" />
              </LineChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Booking status split">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? CHART_COLORS.slate} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Busiest call hours">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.callsByHour ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(h: number) => `${h}:00`} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="calls" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} name="Calls" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Busiest days">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.callsByWeekday ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="calls" fill={CHART_COLORS.orange} radius={[4, 4, 0, 0]} name="Calls" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="Technician utilization">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.technicianUtilization ?? []} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="jobs" fill={CHART_COLORS.purple} radius={[0, 4, 4, 0]} name="Jobs" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        <SectionCard title="Latest calls">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="th">Time</th>
                  <th className="th">Customer number</th>
                  <th className="th">Service</th>
                  <th className="th">Outcome</th>
                  <th className="th">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-purple-50/40">
                    <td className="td">{formatTime(call.startedAt)}</td>
                    <td className="td font-medium text-slate-900">{call.from}</td>
                    <td className="td">{call.serviceType ?? '—'}</td>
                    <td className="td">
                      <span
                        className={`badge ${
                          call.outcome === 'booked' ? 'bg-purple-100 text-purple-700 ring-purple-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
                        }`}
                      >
                        {call.outcome}
                      </span>
                    </td>
                    <td className="td">{formatDuration(call.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </main>
    </>
  );
}
