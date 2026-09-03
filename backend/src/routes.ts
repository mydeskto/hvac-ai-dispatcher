import { Router } from 'express';
import { z } from 'zod';
import { endCall, reply, startCall } from './aiAgent';
import { availableTechnicians, nextOpenSlots, slotsForDay } from './availability';
import { generateWav } from './recording';
import { bookingView, callView } from './serialize';
import { SLOT_MINUTES, db, seed } from './store';
import { buildStats, Range } from './stats';
import { Booking, BookingStatus, ServiceType } from './types';
import { addMinutes, id } from './util';
import { applyWhatsAppResponse, sendBookingConfirmation } from './whatsapp';

export const router = Router();

const serviceSchema = z.enum(['Cooling', 'Heating', 'Emergency']);
const statusSchema = z.enum(['Pending', 'Confirmed', 'Cancelled', 'Completed']);

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/* ---------------------------------- phone --------------------------------- */

router.get('/settings/phone-number', (_req, res) => {
  res.json(db.phoneNumber);
});

router.put('/settings/phone-number', (req, res) => {
  const body = z
    .object({
      number: z.string().min(5).nullable(),
      label: z.string().optional(),
      provider: z.string().optional(),
      connected: z.boolean().optional(),
      aiAgentEnabled: z.boolean().optional(),
      greeting: z.string().optional(),
    })
    .parse(req.body);
  db.phoneNumber = { ...db.phoneNumber, ...body };
  res.json(db.phoneNumber);
});

/* ------------------------------- technicians ------------------------------ */

router.get('/technicians', (_req, res) => {
  const now = new Date();
  res.json(
    db.technicians.map((t) => {
      const current = db.bookings.find(
        (b) => b.technicianId === t.id && b.status !== 'Cancelled' && new Date(b.start) <= now && now < new Date(b.end),
      );
      const upcoming = db.bookings
        .filter((b) => b.technicianId === t.id && b.status !== 'Cancelled' && new Date(b.start) > now)
        .sort((a, b) => a.start.localeCompare(b.start));
      return {
        ...t,
        availableNow: !current && t.active,
        currentBookingId: current?.id ?? null,
        upcomingJobs: upcoming.length,
        nextJobAt: upcoming[0]?.start ?? null,
      };
    }),
  );
});

router.post('/technicians', (req, res) => {
  const body = z
    .object({
      name: z.string().min(2),
      phone: z.string().min(5),
      skills: z.array(serviceSchema).min(1),
      workingHours: z.object({ days: z.array(z.number().min(0).max(6)), start: z.string(), end: z.string() }),
      active: z.boolean().default(true),
    })
    .parse(req.body);
  const technician = { id: id('tech'), ...body };
  db.technicians.push(technician);
  res.status(201).json(technician);
});

router.patch('/technicians/:id', (req, res) => {
  const technician = db.technicians.find((t) => t.id === req.params.id);
  if (!technician) throw httpError(404, 'Technician not found');
  const body = z
    .object({
      name: z.string().min(2).optional(),
      phone: z.string().min(5).optional(),
      skills: z.array(serviceSchema).optional(),
      workingHours: z.object({ days: z.array(z.number()), start: z.string(), end: z.string() }).optional(),
      active: z.boolean().optional(),
    })
    .parse(req.body);
  Object.assign(technician, body);
  res.json(technician);
});

/* -------------------------------- customers ------------------------------- */

router.get('/customers', (_req, res) => {
  res.json(db.customers);
});

/* ---------------------------------- calls --------------------------------- */

router.get('/calls', (req, res) => {
  const { search, status, outcome, from, to } = req.query as Record<string, string | undefined>;
  let calls = [...db.calls].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (status) calls = calls.filter((c) => c.status === status);
  if (outcome) calls = calls.filter((c) => c.outcome === outcome);
  if (from) calls = calls.filter((c) => c.startedAt >= from);
  if (to) calls = calls.filter((c) => c.startedAt <= to);
  const views = calls.map(callView);
  const term = search?.toLowerCase().trim();
  res.json(
    term
      ? views.filter((c) =>
          [c.from, c.customerName, c.transcriptText, c.serviceType, c.bookingStatus]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
        )
      : views,
  );
});

router.get('/calls/:id', (req, res) => {
  const call = db.calls.find((c) => c.id === req.params.id);
  if (!call) throw httpError(404, 'Call not found');
  res.json(callView(call));
});

router.get('/calls/:id/recording', (req, res) => {
  const call = db.calls.find((c) => c.id === req.params.id);
  if (!call) throw httpError(404, 'Call not found');
  const wav = generateWav(call.id, Math.min(20, Math.max(4, Math.round(call.durationSec / 20))));
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', wav.length);
  res.setHeader('Accept-Ranges', 'bytes');
  res.send(wav);
});

/* --------------------------------- AI agent -------------------------------- */

router.post('/ai/calls/start', (req, res) => {
  const body = z.object({ from: z.string().min(5), name: z.string().optional() }).parse(req.body);
  if (!db.phoneNumber.connected || !db.phoneNumber.aiAgentEnabled) {
    throw httpError(409, 'AI agent is disabled for the connected number');
  }
  res.status(201).json(startCall(body.from, body.name));
});

router.post('/ai/calls/:id/reply', (req, res) => {
  const body = z.object({ text: z.string().min(1) }).parse(req.body);
  const turn = reply(req.params.id, body.text);
  if (turn.bookingId) {
    const booking = db.bookings.find((b) => b.id === turn.bookingId) as Booking;
    const customer = db.customers.find((c) => c.id === booking.customerId);
    sendBookingConfirmation(booking, customer?.whatsapp ?? customer?.phone ?? '');
  }
  res.json(turn);
});

router.post('/ai/calls/:id/end', (req, res) => {
  res.json(callView(endCall(req.params.id)));
});

/** Drives a full scripted AI call, including an unavailable-slot retry. */
router.post('/ai/calls/simulate', (_req, res) => {
  const service: ServiceType = (['Cooling', 'Heating', 'Emergency'] as ServiceType[])[Math.floor(Math.random() * 3)];
  const from = `+1 (512) 555-${Math.floor(1000 + Math.random() * 8999)}`;
  const started = startCall(from);
  reply(started.callId, `Hi, my ${service === 'Heating' ? 'furnace' : service === 'Emergency' ? 'unit is leaking and it is urgent' : 'AC'} is acting up.`);
  reply(started.callId, '482 Willow Creek Rd, Austin, TX — the unit runs but the house is not reaching temperature.');
  reply(started.callId, 'Can someone come tomorrow at 5am?');
  const options = nextOpenSlots(addMinutes(new Date(), 60), service, 1);
  if (options.length === 0) throw httpError(409, 'No availability in the next two weeks');
  reply(started.callId, new Date(options[0].start).toISOString());
  const turn = reply(started.callId, from.replace('512', '512'));
  if (turn.bookingId) {
    const booking = db.bookings.find((b) => b.id === turn.bookingId) as Booking;
    sendBookingConfirmation(booking, from);
  }
  const call = db.calls.find((c) => c.id === started.callId);
  if (call) {
    call.durationSec = 120 + Math.floor(Math.random() * 180);
  }
  res.status(201).json({ call: call ? callView(call) : null, bookingId: turn.bookingId });
});

/* -------------------------------- bookings -------------------------------- */

router.get('/bookings', (req, res) => {
  const { status, technicianId, from, to, search } = req.query as Record<string, string | undefined>;
  let bookings = [...db.bookings].sort((a, b) => a.start.localeCompare(b.start));
  if (status) bookings = bookings.filter((b) => b.status === status);
  if (technicianId) bookings = bookings.filter((b) => b.technicianId === technicianId);
  if (from) bookings = bookings.filter((b) => b.end >= from);
  if (to) bookings = bookings.filter((b) => b.start <= to);
  const views = bookings.map(bookingView);
  const term = search?.toLowerCase().trim();
  res.json(
    term
      ? views.filter((b) =>
          [b.customerName, b.customerPhone, b.location, b.technicianName, b.serviceType, b.status]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
        )
      : views,
  );
});

router.post('/bookings', (req, res) => {
  const body = z
    .object({
      customerId: z.string().optional(),
      customerName: z.string().optional(),
      customerPhone: z.string().min(5).optional(),
      whatsapp: z.string().optional(),
      location: z.string().optional(),
      technicianId: z.string(),
      serviceType: serviceSchema,
      start: z.string(),
      notes: z.string().optional(),
      status: statusSchema.default('Pending'),
      sendWhatsApp: z.boolean().default(true),
    })
    .parse(req.body);

  const start = new Date(body.start);
  const end = addMinutes(start, SLOT_MINUTES);
  const free = availableTechnicians(start, end, body.serviceType).some((t) => t.id === body.technicianId);
  if (!free) throw httpError(409, 'Technician is unavailable for that slot');

  let customerId = body.customerId;
  if (!customerId) {
    if (!body.customerPhone) throw httpError(400, 'customerPhone is required for a new customer');
    const customer = {
      id: id('cust'),
      name: body.customerName ?? null,
      phone: body.customerPhone,
      whatsapp: body.whatsapp ?? body.customerPhone,
      location: body.location ?? 'Unknown',
      createdAt: new Date().toISOString(),
    };
    db.customers.push(customer);
    customerId = customer.id;
  }

  const booking: Booking = {
    id: id('book'),
    customerId,
    technicianId: body.technicianId,
    serviceType: body.serviceType,
    start: start.toISOString(),
    end: end.toISOString(),
    status: body.status,
    notes: body.notes ?? '',
    source: 'manual',
    callId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.bookings.push(booking);

  if (body.sendWhatsApp) {
    const customer = db.customers.find((c) => c.id === customerId);
    sendBookingConfirmation(booking, customer?.whatsapp ?? customer?.phone ?? '');
  }
  res.status(201).json(bookingView(booking));
});

router.patch('/bookings/:id', (req, res) => {
  const booking = db.bookings.find((b) => b.id === req.params.id);
  if (!booking) throw httpError(404, 'Booking not found');
  const body = z
    .object({
      technicianId: z.string().optional(),
      serviceType: serviceSchema.optional(),
      start: z.string().optional(),
      status: statusSchema.optional(),
      notes: z.string().optional(),
    })
    .parse(req.body);

  const nextStart = body.start ? new Date(body.start) : new Date(booking.start);
  const nextEnd = addMinutes(nextStart, SLOT_MINUTES);
  const nextTechnician = body.technicianId ?? booking.technicianId;
  const nextStatus: BookingStatus = body.status ?? booking.status;

  if ((body.start || body.technicianId) && nextStatus !== 'Cancelled') {
    const free = availableTechnicians(nextStart, nextEnd, body.serviceType ?? booking.serviceType, booking.id).some(
      (t) => t.id === nextTechnician,
    );
    if (!free) throw httpError(409, 'Technician is unavailable for that slot');
  }

  booking.technicianId = nextTechnician;
  booking.serviceType = body.serviceType ?? booking.serviceType;
  booking.start = nextStart.toISOString();
  booking.end = nextEnd.toISOString();
  booking.status = nextStatus;
  booking.notes = body.notes ?? booking.notes;
  booking.updatedAt = new Date().toISOString();
  res.json(bookingView(booking));
});

/* -------------------------------- whatsapp -------------------------------- */

router.get('/whatsapp', (_req, res) => {
  res.json([...db.whatsapp].sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
});

router.post('/whatsapp/:id/respond', (req, res) => {
  const body = z.object({ response: z.enum(['Confirm Booking', 'Cancel Booking']) }).parse(req.body);
  const message = applyWhatsAppResponse(req.params.id, body.response);
  const booking = db.bookings.find((b) => b.id === message.bookingId) as Booking;
  res.json({ message, booking: bookingView(booking) });
});

/* ------------------------------- availability ------------------------------ */

router.get('/availability', (req, res) => {
  const { date, service } = req.query as Record<string, string | undefined>;
  const day = date ? new Date(date) : new Date();
  res.json({
    date: day.toISOString(),
    slotMinutes: SLOT_MINUTES,
    slots: slotsForDay(day, service as ServiceType | undefined),
  });
});

router.get('/availability/next', (req, res) => {
  const { service, from, limit } = req.query as Record<string, string | undefined>;
  res.json(nextOpenSlots(from ? new Date(from) : new Date(), (service as ServiceType) ?? 'Cooling', Number(limit ?? 3)));
});

/* ---------------------------------- stats --------------------------------- */

router.get('/stats', (req, res) => {
  const range = (['daily', 'weekly', 'monthly'] as Range[]).includes(req.query.range as Range)
    ? (req.query.range as Range)
    : 'weekly';
  res.json(buildStats(range));
});

router.post('/dev/reset', (_req, res) => {
  seed();
  res.json({ ok: true });
});
