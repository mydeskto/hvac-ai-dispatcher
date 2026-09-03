import { SLOT_MINUTES, db } from './store';
import { Booking, ServiceType, Technician } from './types';
import { addDays, addMinutes, atTime, overlaps, startOfDay } from './util';

export interface Slot {
  start: string;
  end: string;
  technicianIds: string[];
}

function worksAt(tech: Technician, start: Date, end: Date): boolean {
  if (!tech.active) return false;
  if (!tech.workingHours.days.includes(start.getDay())) return false;
  const shiftStart = atTime(start, tech.workingHours.start);
  const shiftEnd = atTime(start, tech.workingHours.end);
  return start >= shiftStart && end <= shiftEnd;
}

function activeBookings(technicianId: string): Booking[] {
  return db.bookings.filter((b) => b.technicianId === technicianId && b.status !== 'Cancelled');
}

export function isTechnicianFree(technicianId: string, start: Date, end: Date, ignoreBookingId?: string): boolean {
  return !activeBookings(technicianId).some(
    (b) => b.id !== ignoreBookingId && overlaps(start, end, new Date(b.start), new Date(b.end)),
  );
}

export function availableTechnicians(start: Date, end: Date, service?: ServiceType, ignoreBookingId?: string): Technician[] {
  return db.technicians.filter(
    (t) =>
      worksAt(t, start, end) &&
      (!service || t.skills.includes(service)) &&
      isTechnicianFree(t.id, start, end, ignoreBookingId),
  );
}

export function slotsForDay(day: Date, service?: ServiceType): Slot[] {
  const slots: Slot[] = [];
  for (let hour = 7; hour + SLOT_MINUTES / 60 <= 19; hour += SLOT_MINUTES / 60) {
    const start = atTime(day, `${hour.toString().padStart(2, '0')}:00`);
    const end = addMinutes(start, SLOT_MINUTES);
    const techs = availableTechnicians(start, end, service);
    slots.push({ start: start.toISOString(), end: end.toISOString(), technicianIds: techs.map((t) => t.id) });
  }
  return slots;
}

/** Next open slots at or after `from`, searched across the following two weeks. */
export function nextOpenSlots(from: Date, service: ServiceType, limit = 3): Slot[] {
  const found: Slot[] = [];
  for (let d = 0; d < 14 && found.length < limit; d += 1) {
    const day = addDays(startOfDay(from), d);
    for (const slot of slotsForDay(day, service)) {
      if (new Date(slot.start) >= from && slot.technicianIds.length > 0) {
        found.push(slot);
        if (found.length >= limit) break;
      }
    }
  }
  return found;
}
