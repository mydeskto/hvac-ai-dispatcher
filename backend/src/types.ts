export type ServiceType = 'Cooling' | 'Heating' | 'Emergency';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
export type CallStatus = 'in-progress' | 'completed' | 'missed';

export interface WorkingHours {
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  start: string; // "08:00"
  end: string; // "17:00"
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  skills: ServiceType[];
  workingHours: WorkingHours;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string | null;
  phone: string;
  whatsapp: string | null;
  location: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  customerId: string;
  technicianId: string;
  serviceType: ServiceType;
  start: string; // ISO
  end: string; // ISO
  status: BookingStatus;
  notes: string;
  source: 'ai-call' | 'manual';
  callId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptLine {
  speaker: 'agent' | 'caller';
  text: string;
  at: string;
}

export interface Call {
  id: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  status: CallStatus;
  outcome: 'booked' | 'no-booking' | 'in-progress';
  transcript: TranscriptLine[];
  recordingUrl: string;
  bookingId: string | null;
  customerId: string | null;
}

export interface WhatsAppMessage {
  id: string;
  bookingId: string;
  to: string;
  body: string;
  buttons: string[];
  sentAt: string;
  response: 'Confirm Booking' | 'Cancel Booking' | null;
  respondedAt: string | null;
}

export interface PhoneNumberConfig {
  number: string | null;
  label: string;
  provider: string;
  connected: boolean;
  aiAgentEnabled: boolean;
  greeting: string;
}
