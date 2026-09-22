import { availableTechnicians, nextOpenSlots } from './availability';
import { parseDateTime, parsePhone, parseServiceType } from './parse';
import { SLOT_MINUTES, db } from './store';
import { Booking, Call, ServiceType } from './types';
import { addMinutes, formatSlot, id } from './util';

export type AgentStep = 'reason' | 'location' | 'time' | 'whatsapp' | 'ended';

interface Session {
  callId: string;
  step: AgentStep;
  from: string;
  service: ServiceType | null;
  location: string | null;
  start: Date | null;
  technicianId: string | null;
  name: string | null;
}

const sessions = new Map<string, Session>();

export interface AgentTurn {
  callId: string;
  step: AgentStep;
  agentMessage: string;
  suggestions: string[];
  bookingId: string | null;
}

function say(call: Call, text: string): void {
  call.transcript.push({ speaker: 'agent', text, at: new Date().toISOString() });
}

function hear(call: Call, text: string): void {
  call.transcript.push({ speaker: 'caller', text, at: new Date().toISOString() });
}

function getCall(callId: string): Call {
  const call = db.calls.find((c) => c.id === callId);
  if (!call) throw Object.assign(new Error('Call not found'), { status: 404 });
  return call;
}

/** Creates the inbound call in `ringing` state — nothing is in the transcript until the agent answers. */
export function ringCall(from: string, name?: string): Call {
  const callId = id('call');
  const call: Call = {
    id: callId,
    from,
    to: db.phoneNumber.number ?? 'unassigned',
    direction: 'inbound',
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSec: 0,
    status: 'ringing',
    outcome: 'in-progress',
    transcript: [],
    recordingUrl: `/api/calls/${callId}/recording`,
    bookingId: null,
    customerId: null,
  };
  db.calls.push(call);
  sessions.set(callId, {
    callId,
    step: 'reason',
    from,
    service: null,
    location: null,
    start: null,
    technicianId: null,
    name: name ?? null,
  });
  return call;
}

/** Picks up a ringing call: greeting goes on the transcript and the agent is live. */
export function answerCall(callId: string): AgentTurn {
  const call = getCall(callId);
  if (call.status !== 'ringing' && call.status !== 'in-progress') {
    throw Object.assign(new Error('Call is not answerable'), { status: 409 });
  }
  call.status = 'in-progress';
  say(call, db.phoneNumber.greeting);
  return { callId, step: 'reason', agentMessage: db.phoneNumber.greeting, suggestions: ['Cooling', 'Heating', 'Emergency'], bookingId: null };
}

export function startCall(from: string, name?: string): AgentTurn {
  const call = ringCall(from, name);
  return answerCall(call.id);
}

function finalizeBooking(session: Session, call: Call, whatsappNumber: string): Booking {
  const start = session.start as Date;
  const end = addMinutes(start, SLOT_MINUTES);
  const customer = {
    id: id('cust'),
    name: session.name,
    phone: session.from,
    whatsapp: whatsappNumber,
    location: session.location ?? 'Unknown',
    createdAt: new Date().toISOString(),
  };
  db.customers.push(customer);

  const booking: Booking = {
    id: id('book'),
    customerId: customer.id,
    technicianId: session.technicianId as string,
    serviceType: session.service as ServiceType,
    start: start.toISOString(),
    end: end.toISOString(),
    status: 'Pending',
    jobStage: 'Assigned',
    jobEvents: [{ stage: 'Assigned', at: new Date().toISOString(), note: null }],
    notes: `Captured by AI dispatcher during call ${call.id}.`,
    source: 'ai-call',
    callId: call.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.bookings.push(booking);

  call.bookingId = booking.id;
  call.customerId = customer.id;
  return booking;
}

export function endCall(callId: string): Call {
  const call = getCall(callId);
  if (call.status === 'in-progress') {
    call.endedAt = new Date().toISOString();
    call.durationSec = Math.max(30, Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000));
    call.status = 'completed';
    call.outcome = call.bookingId ? 'booked' : 'no-booking';
  }
  sessions.delete(callId);
  return call;
}

export function reply(callId: string, text: string): AgentTurn {
  const session = sessions.get(callId);
  const call = getCall(callId);
  if (!session) throw Object.assign(new Error('Call is not active'), { status: 409 });
  hear(call, text);

  const turn = (step: AgentStep, agentMessage: string, suggestions: string[] = [], bookingId: string | null = null): AgentTurn => {
    session.step = step;
    say(call, agentMessage);
    return { callId, step, agentMessage, suggestions, bookingId };
  };

  switch (session.step) {
    case 'reason': {
      const service = parseServiceType(text);
      if (!service) {
        return turn('reason', 'Sorry, I did not catch that. Is this about cooling, heating, or an emergency?', ['Cooling', 'Heating', 'Emergency']);
      }
      session.service = service;
      return turn(
        'location',
        `Got it — ${service.toLowerCase()} service. What is the full service address, and what is happening with the system?`,
      );
    }
    case 'location': {
      if (text.trim().length < 5) {
        return turn('location', 'I need the full street address so the technician can find you. Could you repeat it?');
      }
      session.location = text.trim();
      return turn(
        'time',
        `Thank you, I have ${session.location} for a ${session.service?.toLowerCase()} visit. What date and time would you prefer?`,
        ['Tomorrow at 9am', 'Tomorrow at 2pm'],
      );
    }
    case 'time': {
      const requested = parseDateTime(text);
      if (!requested) {
        return turn('time', 'I did not get a clear date and time. For example, you can say "tomorrow at 2pm".');
      }
      const end = addMinutes(requested, SLOT_MINUTES);
      const techs = availableTechnicians(requested, end, session.service ?? undefined);
      if (techs.length === 0) {
        const options = nextOpenSlots(new Date(), session.service as ServiceType, 3);
        return turn(
          'time',
          `I'm sorry, we have no technician available at ${formatSlot(requested)}. The closest open slots are ${options
            .map((o) => formatSlot(new Date(o.start)))
            .join(', ')}. Which time works for you?`,
          options.map((o) => new Date(o.start).toISOString()),
        );
      }
      session.start = requested;
      session.technicianId = techs[0].id;
      return turn(
        'whatsapp',
        `${formatSlot(requested)} is open and ${techs[0].name} will take the job. What WhatsApp number should I send the confirmation to?`,
      );
    }
    case 'whatsapp': {
      const phone = parsePhone(text);
      if (!phone) {
        return turn('whatsapp', 'That number did not look complete. Could you give me the full WhatsApp number with area code?');
      }
      const booking = finalizeBooking(session, call, phone);
      const technician = db.technicians.find((t) => t.id === booking.technicianId);
      const message = `You're all set. ${technician?.name} will arrive ${formatSlot(new Date(booking.start))}. I'm sending a WhatsApp confirmation now with Confirm and Cancel buttons. Thanks for calling Nova HVAC!`;
      say(call, message);
      session.step = 'ended';
      endCall(callId);
      return { callId, step: 'ended', agentMessage: message, suggestions: [], bookingId: booking.id };
    }
    default:
      throw Object.assign(new Error('Call already ended'), { status: 409 });
  }
}

export function getSession(callId: string): Session | undefined {
  return sessions.get(callId);
}

export function isSessionActive(callId: string): boolean {
  return sessions.has(callId);
}

/**
 * Runs a scripted inbound call in REAL TIME: the call rings, the agent picks
 * up, and caller/agent turns land in the transcript every few seconds — the UI
 * watches it unfold via polling instead of getting a finished record. The
 * script deliberately asks for an unavailable slot first so the renegotiation
 * path is exercised.
 */
export function runLiveCall(from: string, onBooked?: (booking: Booking) => void): Call {
  const call = ringCall(from);
  const service: ServiceType = (['Cooling', 'Heating', 'Emergency'] as ServiceType[])[Math.floor(Math.random() * 3)];
  const reasonLine =
    service === 'Heating'
      ? 'Hi, my furnace is acting up.'
      : service === 'Emergency'
        ? 'Hi, my unit is leaking and it is urgent.'
        : 'Hi, my AC is not keeping the house cool.';
  const slotOptions = nextOpenSlots(addMinutes(new Date(), 60), service, 1);
  const chosenSlot = slotOptions[0]?.start ?? null;

  const callerLines: string[] = [
    reasonLine,
    '482 Willow Creek Rd, Austin, TX — the unit runs but the house is not reaching temperature.',
    'Can someone come tomorrow at 5am?',
    ...(chosenSlot ? [chosenSlot] : []),
    from,
  ];

  let step = 0;
  const answerTimer = setTimeout(() => {
    if (!sessions.has(call.id)) return;
    answerCall(call.id);
    const tick = () => {
      if (!sessions.has(call.id) || step >= callerLines.length) return;
      const line = callerLines[step];
      step += 1;
      const turn = reply(call.id, line);
      if (turn.bookingId) {
        const booking = db.bookings.find((b) => b.id === turn.bookingId);
        if (booking) onBooked?.(booking);
        return;
      }
      setTimeout(tick, 3200);
    };
    setTimeout(tick, 3200);
  }, 2500);
  answerTimer.unref?.();
  return call;
}
