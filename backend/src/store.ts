import {
  Booking,
  Call,
  Customer,
  PhoneNumberConfig,
  ServiceType,
  Technician,
  WhatsAppMessage,
} from './types';
import { addDays, addMinutes, atTime, id, startOfDay } from './util';

export interface Database {
  technicians: Technician[];
  customers: Customer[];
  bookings: Booking[];
  calls: Call[];
  whatsapp: WhatsAppMessage[];
  phoneNumber: PhoneNumberConfig;
}

export const SLOT_MINUTES = 120;

export const db: Database = {
  technicians: [],
  customers: [],
  bookings: [],
  calls: [],
  whatsapp: [],
  phoneNumber: {
    number: '+1 (415) 555-0142',
    label: 'HVAC AI Dispatcher Main Line',
    provider: 'Twilio (mock)',
    connected: true,
    aiAgentEnabled: true,
    greeting:
      'Thanks for calling Nova HVAC, this is Ava, your AI dispatcher. Are you calling about cooling, heating, or is this an emergency?',
  },
};

const LOCATIONS = [
  '482 Willow Creek Rd, Austin, TX',
  '1290 Marigold Ln, Round Rock, TX',
  '77 Beacon St, Cedar Park, TX',
  '5521 Ridgeview Dr, Pflugerville, TX',
  '904 Sunset Valley Blvd, Austin, TX',
  '318 Oakhurst Ave, Georgetown, TX',
];

const NAMES = [
  'Maria Alvarez',
  'James Whitfield',
  'Priya Nair',
  'Daniel Okafor',
  'Sophie Bergman',
  'Ethan Cole',
  'Laura Kim',
  'Marcus Reed',
];

const SERVICES: ServiceType[] = ['Cooling', 'Heating', 'Emergency'];

function seedTechnicians(): void {
  const base = [
    { name: 'Carlos Mendes', skills: ['Cooling', 'Heating'] as ServiceType[], start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5] },
    { name: 'Anita Shah', skills: ['Cooling', 'Emergency'] as ServiceType[], start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5, 6] },
    { name: 'Devon Price', skills: ['Heating', 'Emergency'] as ServiceType[], start: '07:00', end: '16:00', days: [0, 1, 2, 3, 4] },
    { name: 'Riley Torres', skills: ['Cooling', 'Heating', 'Emergency'] as ServiceType[], start: '10:00', end: '19:00', days: [2, 3, 4, 5, 6] },
  ];
  base.forEach((t, i) => {
    db.technicians.push({
      id: `tech_${i + 1}`,
      name: t.name,
      phone: `+1 (415) 555-01${(60 + i).toString()}`,
      skills: t.skills,
      workingHours: { days: t.days, start: t.start, end: t.end },
      active: true,
      pin: (1001 + i).toString(),
      location: { lat: 30.2672 + (i - 1.5) * 0.045, lng: -97.7431 + (i - 1.5) * 0.06, updatedAt: new Date().toISOString() },
      sharingLocation: i % 2 === 0,
    });
  });
}

function seedCustomers(): Customer[] {
  return NAMES.map((name, i) => {
    const customer: Customer = {
      id: `cust_${i + 1}`,
      name,
      phone: `+1 (512) 555-${(2100 + i * 7).toString()}`,
      whatsapp: `+1 (512) 555-${(2100 + i * 7).toString()}`,
      location: LOCATIONS[i % LOCATIONS.length],
      createdAt: addDays(new Date(), -20 + i).toISOString(),
    };
    db.customers.push(customer);
    return customer;
  });
}

function transcriptFor(
  customer: Customer,
  service: ServiceType,
  start: Date,
  technician: Technician,
  startedAt: Date,
): Call['transcript'] {
  const t = (offset: number) => addMinutes(startedAt, offset / 60).toISOString();
  return [
    { speaker: 'agent', text: db.phoneNumber.greeting, at: t(0) },
    { speaker: 'caller', text: `Hi, I need help with ${service.toLowerCase()}. My unit is not keeping up.`, at: t(9) },
    { speaker: 'agent', text: 'Understood. Can I confirm the service address for the visit?', at: t(15) },
    { speaker: 'caller', text: customer.location, at: t(22) },
    { speaker: 'agent', text: `Got it, ${customer.location}. What date and time works best for you?`, at: t(30) },
    {
      speaker: 'caller',
      text: `Could someone come by around ${start.toLocaleString('en-US', { weekday: 'long', hour: 'numeric' })}?`,
      at: t(40),
    },
    {
      speaker: 'agent',
      text: `Let me check technician availability... yes, ${technician.name} is open then. I have you booked.`,
      at: t(52),
    },
    { speaker: 'agent', text: 'What WhatsApp number should I send the confirmation to?', at: t(62) },
    { speaker: 'caller', text: customer.whatsapp ?? customer.phone, at: t(70) },
    {
      speaker: 'agent',
      text: 'Perfect. You will get a WhatsApp message with Confirm and Cancel buttons. Thanks for calling Nova HVAC!',
      at: t(78),
    },
  ];
}

function seedHistory(customers: Customer[]): void {
  const today = startOfDay(new Date());
  let seq = 0;

  for (let dayOffset = -13; dayOffset <= 6; dayOffset += 1) {
    const day = addDays(today, dayOffset);
    const callsToday = 3 + ((dayOffset + 14) % 4);

    for (let c = 0; c < callsToday; c += 1) {
      seq += 1;
      const customer = customers[seq % customers.length];
      const service = SERVICES[seq % SERVICES.length];
      const technician = db.technicians[seq % db.technicians.length];
      const callHour = 8 + ((seq * 3) % 9);
      const startedAt = atTime(day, `${callHour.toString().padStart(2, '0')}:${((seq * 13) % 60).toString().padStart(2, '0')}`);
      const durationSec = 95 + ((seq * 37) % 260);
      const booked = seq % 5 !== 0;

      const callId = `call_${seq}`;
      let bookingId: string | null = null;

      if (booked) {
        const slotHour = 8 + ((seq * 2) % 8);
        const slotStart = atTime(addDays(day, dayOffset < 0 ? 0 : 1), `${slotHour.toString().padStart(2, '0')}:00`);
        const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
        const conflict = db.bookings.some(
          (b) =>
            b.technicianId === technician.id &&
            b.status !== 'Cancelled' &&
            new Date(b.start) < slotEnd &&
            slotStart < new Date(b.end),
        );
        if (!conflict) {
          bookingId = `book_${seq}`;
          const status: Booking['status'] =
            slotStart < new Date() ? (seq % 7 === 0 ? 'Cancelled' : 'Completed') : seq % 4 === 0 ? 'Pending' : 'Confirmed';
          db.bookings.push({
            id: bookingId,
            customerId: customer.id,
            technicianId: technician.id,
            serviceType: service,
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            status,
            jobStage: status === 'Completed' ? 'Done' : 'Assigned',
            jobEvents:
              status === 'Completed'
                ? [
                    { stage: 'Assigned' as const, at: startedAt.toISOString(), note: null },
                    { stage: 'Done' as const, at: slotEnd.toISOString(), note: null },
                  ]
                : [{ stage: 'Assigned' as const, at: startedAt.toISOString(), note: null }],
            notes: `${service} service requested during AI call.`,
            source: 'ai-call',
            callId,
            createdAt: startedAt.toISOString(),
            updatedAt: startedAt.toISOString(),
          });
          db.whatsapp.push({
            id: id('wa'),
            bookingId,
            to: customer.whatsapp ?? customer.phone,
            body: `Your ${service} visit with ${technician.name} is scheduled for ${slotStart.toLocaleString('en-US')}.`,
            buttons: ['Confirm Booking', 'Cancel Booking'],
            sentAt: startedAt.toISOString(),
            response: status === 'Confirmed' || status === 'Completed' ? 'Confirm Booking' : status === 'Cancelled' ? 'Cancel Booking' : null,
            respondedAt: status === 'Pending' ? null : addMinutes(startedAt, 3).toISOString(),
          });
        }
      }

      const bookingForCall = db.bookings.find((b) => b.id === bookingId);
      db.calls.push({
        id: callId,
        from: customer.phone,
        to: db.phoneNumber.number ?? '+1 (415) 555-0142',
        direction: 'inbound',
        startedAt: startedAt.toISOString(),
        endedAt: addMinutes(startedAt, durationSec / 60).toISOString(),
        durationSec,
        status: 'completed',
        outcome: bookingId ? 'booked' : 'no-booking',
        transcript: bookingForCall
          ? transcriptFor(customer, service, new Date(bookingForCall.start), technician, startedAt)
          : [
              { speaker: 'agent', text: db.phoneNumber.greeting, at: startedAt.toISOString() },
              { speaker: 'caller', text: 'Actually I just wanted a quote, I will call back later.', at: addMinutes(startedAt, 0.4).toISOString() },
              { speaker: 'agent', text: 'No problem, we are here 24/7 whenever you are ready.', at: addMinutes(startedAt, 0.7).toISOString() },
            ],
        recordingUrl: `/api/calls/${callId}/recording`,
        bookingId,
        customerId: customer.id,
      });
    }
  }
}

export function seed(): void {
  db.technicians = [];
  db.customers = [];
  db.bookings = [];
  db.calls = [];
  db.whatsapp = [];
  seedTechnicians();
  const customers = seedCustomers();
  seedHistory(customers);
}

seed();
