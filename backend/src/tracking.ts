import { distanceKm, geocode, moveToward } from './geo';
import { bookingView } from './serialize';
import { db } from './store';
import { Booking, JobStage, Technician } from './types';
import { addMinutes, id } from './util';

/* ------------------------------- sessions -------------------------------- */

const techSessions = new Map<string, string>(); // token -> technicianId

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^1(\d{10})$/, '$1');
}

export function techLogin(phone: string, pin: string): { token: string; technician: Technician } | null {
  const target = normalizePhone(phone);
  const technician = db.technicians.find((t) => normalizePhone(t.phone) === target && t.pin === pin);
  if (!technician) return null;
  const token = id('tsess');
  techSessions.set(token, technician.id);
  return { token, technician };
}

export function techLogout(token: string): void {
  techSessions.delete(token);
}

export function techFromToken(token: string | undefined): Technician | null {
  if (!token) return null;
  const technicianId = techSessions.get(token);
  return db.technicians.find((t) => t.id === technicianId) ?? null;
}

/* ------------------------------ job workflow ----------------------------- */

const STAGE_ORDER: JobStage[] = ['Assigned', 'EnRoute', 'OnSite', 'Done'];

export function setJobStage(booking: Booking, stage: JobStage, note?: string): Booking {
  if (STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(booking.jobStage)) {
    throw Object.assign(new Error('Job stage cannot move backwards'), { status: 409 });
  }
  const now = new Date().toISOString();
  booking.jobStage = stage;
  booking.jobEvents.push({ stage, at: now, note: note ?? null });
  booking.updatedAt = now;
  if (stage === 'Done') booking.status = 'Completed';
  return booking;
}

export function technicianBookings(technicianId: string) {
  return db.bookings
    .filter((b) => b.technicianId === technicianId && b.status !== 'Cancelled')
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** The job the technician is (or should be) working on right now. */
export function activeJobFor(technicianId: string): Booking | null {
  const now = new Date();
  const jobs = technicianBookings(technicianId);
  return (
    jobs.find((b) => b.jobStage === 'EnRoute' || b.jobStage === 'OnSite') ??
    jobs.find((b) => b.status !== 'Completed' && new Date(b.start) <= now && now < new Date(b.end)) ??
    jobs.find((b) => b.status !== 'Completed' && new Date(b.start) > now) ??
    null
  );
}

export function jobCoords(booking: Booking) {
  const customer = db.customers.find((c) => c.id === booking.customerId);
  return customer ? geocode(customer.location) : null;
}

/* ------------------------------ live location ---------------------------- */

export function updateTechLocation(technician: Technician, lat: number, lng: number, sharing?: boolean): Technician {
  technician.location = { lat, lng, updatedAt: new Date().toISOString() };
  if (sharing !== undefined) technician.sharingLocation = sharing;
  return technician;
}

/**
 * Mock field movement: every tick, technicians who are EnRoute move a step
 * toward their job's coordinates, so the admin map animates like inDrive.
 * Arrived-techs get a tiny drift so the map still feels live.
 */
export function simulateMovement(): void {
  const now = new Date().toISOString();
  for (const tech of db.technicians) {
    if (!tech.sharingLocation || !tech.location) continue;
    const job = db.bookings.find((b) => b.technicianId === tech.id && b.jobStage === 'EnRoute');
    if (job) {
      const target = jobCoords(job);
      if (!target) continue;
      if (distanceKm(tech.location, target) > 0.15) {
        tech.location = { ...moveToward(tech.location, target, 0.12), updatedAt: now };
      }
    } else {
      tech.location = {
        lat: tech.location.lat + (Math.random() - 0.5) * 0.0015,
        lng: tech.location.lng + (Math.random() - 0.5) * 0.0015,
        updatedAt: now,
      };
    }
  }
}

/* ------------------------------ view builders ---------------------------- */

export function techSummary(technician: Technician) {
  const jobs = technicianBookings(technician.id);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = addMinutes(todayStart, -todayStart.getDay() * 24 * 60);

  const done = jobs.filter((b) => b.jobStage === 'Done' || b.status === 'Completed');
  const doneToday = done.filter((b) => b.start >= todayStart.toISOString());
  const doneWeek = done.filter((b) => b.start >= weekStart.toISOString());
  const todayJobs = jobs.filter((b) => b.start >= todayStart.toISOString() && b.start < addMinutes(todayStart, 24 * 60).toISOString());
  const active = activeJobFor(technician.id);
  const minutesWeek = doneWeek.reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000, 0);

  return {
    jobsToday: todayJobs.length,
    completedToday: doneToday.length,
    completedWeek: doneWeek.length,
    completedTotal: done.length,
    hoursThisWeek: Math.round(minutesWeek / 60) * 10 / 10,
    activeJobId: active?.id ?? null,
    nextJobAt: jobs.find((b) => b.status !== 'Completed' && b.jobStage !== 'Done' && new Date(b.start) > now)?.start ?? null,
  };
}

/** Admin fleet view: every technician with live position + current job target. */
export function trackingView() {
  return db.technicians.map((t) => {
    const active = activeJobFor(t.id);
    const coords = active ? jobCoords(active) : null;
    return {
      id: t.id,
      name: t.name,
      phone: t.phone,
      active: t.active,
      sharingLocation: t.sharingLocation,
      location: t.location,
      job: active
        ? {
            ...bookingView(active),
            coords,
            distanceKm: t.location && coords ? Math.round(distanceKm(t.location, coords) * 10) / 10 : null,
          }
        : null,
    };
  });
}
