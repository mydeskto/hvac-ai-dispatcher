import { availableTechnicians } from './availability';
import { db } from './store';
import { Booking, WhatsAppMessage } from './types';
import { formatSlot, id } from './util';

export function sendBookingConfirmation(booking: Booking, to: string): WhatsAppMessage {
  const technician = db.technicians.find((t) => t.id === booking.technicianId);
  const customer = db.customers.find((c) => c.id === booking.customerId);
  const message: WhatsAppMessage = {
    id: id('wa'),
    bookingId: booking.id,
    to,
    body:
      `Hi${customer?.name ? ` ${customer.name}` : ''}! Nova HVAC here. We booked your ${booking.serviceType} service:\n` +
      `📅 ${formatSlot(new Date(booking.start))} – ${new Date(booking.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}\n` +
      `👷 Technician: ${technician?.name ?? 'To be assigned'}\n` +
      `📍 ${customer?.location ?? ''}\n` +
      'Please confirm so we can lock the slot.',
    buttons: ['Confirm Booking', 'Cancel Booking'],
    sentAt: new Date().toISOString(),
    response: null,
    respondedAt: null,
  };
  db.whatsapp.push(message);
  return message;
}

export function applyWhatsAppResponse(messageId: string, response: 'Confirm Booking' | 'Cancel Booking'): WhatsAppMessage {
  const message = db.whatsapp.find((m) => m.id === messageId);
  if (!message) throw Object.assign(new Error('WhatsApp message not found'), { status: 404 });
  const booking = db.bookings.find((b) => b.id === message.bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });

  message.response = response;
  message.respondedAt = new Date().toISOString();

  if (response === 'Confirm Booking') {
    const free = availableTechnicians(new Date(booking.start), new Date(booking.end), booking.serviceType, booking.id).some(
      (t) => t.id === booking.technicianId,
    );
    if (!free) {
      throw Object.assign(new Error('Slot is no longer available for the assigned technician'), { status: 409 });
    }
    booking.status = 'Confirmed';
  } else {
    booking.status = 'Cancelled';
  }
  booking.updatedAt = new Date().toISOString();
  return message;
}
