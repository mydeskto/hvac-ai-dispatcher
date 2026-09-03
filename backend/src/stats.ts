import { db } from './store';
import { addDays, startOfDay } from './util';

export type Range = 'daily' | 'weekly' | 'monthly';

const RANGE_DAYS: Record<Range, number> = { daily: 1, weekly: 7, monthly: 30 };

export function buildStats(range: Range) {
  const now = new Date();
  const since = startOfDay(addDays(now, -(RANGE_DAYS[range] - 1)));
  const calls = db.calls.filter((c) => new Date(c.startedAt) >= since);
  const bookings = db.bookings.filter((b) => new Date(b.createdAt) >= since);

  const totalDuration = calls.reduce((sum, c) => sum + c.durationSec, 0);
  const byStatus = {
    Pending: bookings.filter((b) => b.status === 'Pending').length,
    Confirmed: bookings.filter((b) => b.status === 'Confirmed').length,
    Cancelled: bookings.filter((b) => b.status === 'Cancelled').length,
    Completed: bookings.filter((b) => b.status === 'Completed').length,
  };

  const callsPerDay = Array.from({ length: RANGE_DAYS[range] }, (_, i) => {
    const day = startOfDay(addDays(now, -(RANGE_DAYS[range] - 1 - i)));
    const next = addDays(day, 1);
    const dayCalls = db.calls.filter((c) => new Date(c.startedAt) >= day && new Date(c.startedAt) < next);
    return {
      date: day.toISOString().slice(0, 10),
      calls: dayCalls.length,
      bookings: db.bookings.filter((b) => new Date(b.createdAt) >= day && new Date(b.createdAt) < next).length,
    };
  });

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    calls: calls.filter((c) => new Date(c.startedAt).getHours() === hour).length,
  })).filter((h) => h.hour >= 6 && h.hour <= 20);

  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byWeekday = weekdayNames.map((name, index) => ({
    day: name,
    calls: db.calls.filter((c) => new Date(c.startedAt).getDay() === index).length,
  }));

  const technicianUtilization = db.technicians.map((t) => {
    const techBookings = db.bookings.filter((b) => b.technicianId === t.id && b.status !== 'Cancelled');
    const inRange = techBookings.filter((b) => new Date(b.start) >= since);
    const hours = inRange.reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)) / 3_600_000, 0);
    const shiftHours =
      (Number(t.workingHours.end.split(':')[0]) - Number(t.workingHours.start.split(':')[0])) *
      Math.max(1, Math.round((RANGE_DAYS[range] / 7) * t.workingHours.days.length));
    return {
      technicianId: t.id,
      name: t.name,
      jobs: inRange.length,
      hours: Math.round(hours * 10) / 10,
      utilization: shiftHours > 0 ? Math.min(100, Math.round((hours / shiftHours) * 100)) : 0,
    };
  });

  return {
    range,
    totalCalls: calls.length,
    answeredByAi: calls.filter((c) => c.transcript.length > 0).length,
    bookingsCreated: bookings.length,
    bookingsByStatus: byStatus,
    avgCallDurationSec: calls.length ? Math.round(totalDuration / calls.length) : 0,
    conversionRate: calls.length ? Math.round((calls.filter((c) => c.outcome === 'booked').length / calls.length) * 100) : 0,
    callsPerDay,
    callsByHour: byHour,
    callsByWeekday: byWeekday,
    technicianUtilization,
    generatedAt: new Date().toISOString(),
  };
}
