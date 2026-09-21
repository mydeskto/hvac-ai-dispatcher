export type ServiceType = 'Cooling' | 'Heating' | 'Emergency';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';
export type CallStatus = 'in-progress' | 'completed' | 'missed';
/** Field-side progress a technician reports on a booking (dispatcher status stays separate). */
export type JobStage = 'Assigned' | 'EnRoute' | 'OnSite' | 'Done';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TechLocation extends GeoPoint {
  updatedAt: string;
}

export interface JobEvent {
  stage: JobStage;
  at: string;
  note: string | null;
}

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
  /** 4-digit code the technician uses to sign in to the field portal. */
  pin: string;
  /** Live GPS position reported by the technician app (mock-able). */
  location: TechLocation | null;
  /** Whether the technician is broadcasting their position right now. */
  sharingLocation: boolean;
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
  /** Technician-reported field progress for work tracking. */
  jobStage: JobStage;
  jobEvents: JobEvent[];
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
