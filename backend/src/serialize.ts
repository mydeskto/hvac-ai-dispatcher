import { geocode } from './geo';
import { db } from './store';
import { Booking, Call } from './types';

export function bookingView(booking: Booking) {
  const customer = db.customers.find((c) => c.id === booking.customerId);
  const technician = db.technicians.find((t) => t.id === booking.technicianId);
  const whatsapp = db.whatsapp.filter((m) => m.bookingId === booking.id).slice(-1)[0] ?? null;
  return {
    ...booking,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    customerWhatsapp: customer?.whatsapp ?? null,
    location: customer?.location ?? null,
    coords: customer ? geocode(customer.location) : null,
    technicianName: technician?.name ?? null,
    whatsappMessage: whatsapp,
  };
}

export function callView(call: Call) {
  const customer = call.customerId ? db.customers.find((c) => c.id === call.customerId) : undefined;
  const booking = call.bookingId ? db.bookings.find((b) => b.id === call.bookingId) : undefined;
  return {
    ...call,
    customerName: customer?.name ?? null,
    location: customer?.location ?? null,
    bookingStatus: booking?.status ?? null,
    serviceType: booking?.serviceType ?? null,
    transcriptText: call.transcript.map((line) => `${line.speaker === 'agent' ? 'AI Agent' : 'Caller'}: ${line.text}`).join('\n'),
  };
}
