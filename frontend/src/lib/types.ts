export type ServiceType = 'Cooling' | 'Heating' | 'Emergency';
export type BookingStatus = 'Pending' | 'Confirmed' | 'Cancelled' | 'Completed';

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

export interface Booking {
  id: string;
  customerId: string;
  technicianId: string;
  serviceType: ServiceType;
  start: string;
  end: string;
  status: BookingStatus;
  notes: string;
  source: 'ai-call' | 'manual';
  callId: string | null;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  location: string | null;
  technicianName: string | null;
  whatsappMessage: WhatsAppMessage | null;
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
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  status: 'in-progress' | 'completed' | 'missed';
  outcome: 'booked' | 'no-booking' | 'in-progress';
  transcript: TranscriptLine[];
  recordingUrl: string;
  bookingId: string | null;
  customerName: string | null;
  location: string | null;
  bookingStatus: BookingStatus | null;
  serviceType: ServiceType | null;
  transcriptText: string;
}

export interface Technician {
  id: string;
  name: string;
  phone: string;
  skills: ServiceType[];
  workingHours: { days: number[]; start: string; end: string };
  active: boolean;
  availableNow: boolean;
  currentBookingId: string | null;
  upcomingJobs: number;
  nextJobAt: string | null;
}

export interface Stats {
  range: 'daily' | 'weekly' | 'monthly';
  totalCalls: number;
  answeredByAi: number;
  bookingsCreated: number;
  bookingsByStatus: Record<BookingStatus, number>;
  avgCallDurationSec: number;
  conversionRate: number;
  callsPerDay: { date: string; calls: number; bookings: number }[];
  callsByHour: { hour: number; calls: number }[];
  callsByWeekday: { day: string; calls: number }[];
  technicianUtilization: { technicianId: string; name: string; jobs: number; hours: number; utilization: number }[];
  generatedAt: string;
}

export interface PhoneNumberConfig {
  number: string | null;
  label: string;
  provider: string;
  connected: boolean;
  aiAgentEnabled: boolean;
  greeting: string;
}

export interface Slot {
  start: string;
  end: string;
  technicianIds: string[];
}

export interface AgentTurn {
  callId: string;
  step: 'reason' | 'location' | 'time' | 'whatsapp' | 'ended';
  agentMessage: string;
  suggestions: string[];
  bookingId: string | null;
}
