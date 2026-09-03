import { ServiceType } from './types';
import { addDays, atTime, startOfDay } from './util';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseServiceType(text: string): ServiceType | null {
  const t = text.toLowerCase();
  if (/emergenc|urgent|leak|smoke|no heat at all|burst/.test(t)) return 'Emergency';
  if (/cool|ac\b|a\/c|air ?con|freon|not cold/.test(t)) return 'Cooling';
  if (/heat|furnace|boiler|warm/.test(t)) return 'Heating';
  return null;
}

/** Parses phrases such as "tomorrow at 2pm", "friday 10am", "aug 12 at 9", or an ISO string. */
export function parseDateTime(text: string, now = new Date()): Date | null {
  const trimmed = text.trim();
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso) && /\d{4}-\d{2}-\d{2}/.test(trimmed)) return new Date(iso);

  const t = trimmed.toLowerCase();
  let day = startOfDay(now);

  if (/tomorrow/.test(t)) {
    day = addDays(day, 1);
  } else if (/day after tomorrow/.test(t)) {
    day = addDays(day, 2);
  } else if (/today|this afternoon|this morning|tonight/.test(t)) {
    day = startOfDay(now);
  } else {
    const weekdayIndex = WEEKDAYS.findIndex((w) => t.includes(w));
    if (weekdayIndex >= 0) {
      let delta = (weekdayIndex - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      day = addDays(day, delta);
    } else {
      const dated = Date.parse(trimmed);
      if (!Number.isNaN(dated)) return new Date(dated);
    }
  }

  const time = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!time) return null;
  let hour = Number(time[1]);
  const minutes = time[2] ? Number(time[2]) : 0;
  const meridiem = time[3];
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (!meridiem && hour <= 7) hour += 12; // "at 3" during business hours means 3pm
  if (hour > 23) return null;

  return atTime(day, `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
}

export function parsePhone(text: string): string | null {
  const digits = text.replace(/[^\d+]/g, '');
  return digits.replace(/\D/g, '').length >= 10 ? digits : null;
}
