import { answerCall, isSessionActive, reply, ringCall } from './aiAgent';
import { db } from './store';
import { Call } from './types';

/**
 * Telnyx Call Control wiring.
 *
 * Credentials can come from env (backend/.env) OR be attached at runtime from
 * the admin UI (Phone & AI Agent page → Business number):
 *   TELNYX_API_KEY        — v2 API key from the Telnyx portal
 *   TELNYX_CONNECTION_ID  — Call Control application id the number is assigned to
 *   TELNYX_PHONE_NUMBER   — the business number in E.164 (e.g. +14155550142)
 *   PUBLIC_BASE_URL       — public URL of this API (ngrok for local dev); the
 *                           webhook to paste into Telnyx is `${PUBLIC_BASE_URL}/api/telnyx/webhook`
 */

const TELNYX_API = 'https://api.telnyx.com/v2';

function cfg() {
  return db.telephony;
}

export function telnyxStatus() {
  const c = cfg();
  return {
    provider: 'telnyx',
    configured: Boolean(c.apiKey && c.connectionId),
    numberAttached: Boolean(c.phoneNumber),
    apiKeySet: Boolean(c.apiKey),
    connectionIdSet: Boolean(c.connectionId),
    phoneNumber: c.phoneNumber || null,
    webhookUrl: c.publicBaseUrl ? `${c.publicBaseUrl}/api/telnyx/webhook` : null,
    missing: [
      ...(c.apiKey ? [] : ['TELNYX_API_KEY']),
      ...(c.connectionId ? [] : ['TELNYX_CONNECTION_ID']),
      ...(c.phoneNumber ? [] : ['TELNYX_PHONE_NUMBER']),
      ...(c.publicBaseUrl ? [] : ['PUBLIC_BASE_URL']),
    ],
  };
}

async function telnyxApi<T>(path: string, init?: RequestInit, apiKey?: string): Promise<T> {
  const key = apiKey ?? cfg().apiKey;
  if (!key) throw Object.assign(new Error('Telnyx API key is not configured'), { status: 400 });
  const res = await fetch(`${TELNYX_API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as { errors?: { detail?: string }[] };
  if (!res.ok) {
    const detail = body.errors?.[0]?.detail ?? `Telnyx API error ${res.status}`;
    throw Object.assign(new Error(detail), { status: res.status });
  }
  return body as T;
}

/* ----------------------------- attach / connect --------------------------- */

/** Verify credentials against Telnyx and save them for the call pipeline. */
export async function connectTelnyx(input: { apiKey: string; connectionId: string; publicBaseUrl?: string }) {
  const app = await telnyxApi<{ data?: { id: string } }>(`/call_control_applications/${input.connectionId}`, undefined, input.apiKey);
  if (!app.data?.id) throw Object.assign(new Error('Call Control application not found for that connection id'), { status: 400 });
  cfg().apiKey = input.apiKey;
  cfg().connectionId = input.connectionId;
  if (input.publicBaseUrl) cfg().publicBaseUrl = input.publicBaseUrl.replace(/\/$/, '');
  db.phoneNumber.provider = 'Telnyx';
  return telnyxStatus();
}

/** Attach a number the account already owns — verifies it exists on the account first. */
export async function attachNumber(phoneNumber: string) {
  const res = await telnyxApi<{ data?: { id: string; phone_number: string; connection_id?: string }[] }>(
    `/phone_numbers?filter[phone_number]=${encodeURIComponent(phoneNumber)}`,
  );
  const found = res.data?.[0];
  if (!found) {
    throw Object.assign(new Error(`Number ${phoneNumber} was not found on this Telnyx account`), { status: 404 });
  }
  if (found.connection_id !== cfg().connectionId) {
    await telnyxApi(`/phone_numbers/${found.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ connection_id: cfg().connectionId }),
    });
  }
  cfg().phoneNumber = found.phone_number;
  db.phoneNumber.number = found.phone_number;
  db.phoneNumber.provider = 'Telnyx';
  db.phoneNumber.connected = true;
  return telnyxStatus();
}

export interface AvailableNumber {
  phoneNumber: string;
  region: string;
  monthlyCost: string | null;
}

/** Search numbers available to buy (US, voice-capable). */
export async function searchNumbers(areaCode?: string): Promise<AvailableNumber[]> {
  const filter = `filter[country_code]=US&filter[features][]=voice&filter[limit]=10`;
  const area = areaCode ? `&filter[national_destination_code]=${encodeURIComponent(areaCode)}` : '';
  const res = await telnyxApi<{
    data?: { phone_number: string; region_information?: { region_name?: string }[]; cost_information?: { monthly_cost?: string } }[];
  }>(`/available_phone_numbers?${filter}${area}`);
  return (res.data ?? []).map((n) => ({
    phoneNumber: n.phone_number,
    region: n.region_information?.[0]?.region_name ?? 'US',
    monthlyCost: n.cost_information?.monthly_cost ?? null,
  }));
}

/** Order a number, assign it to the Call Control app, and attach it as the business line. */
export async function orderNumber(phoneNumber: string) {
  const order = await telnyxApi<{ data?: { phone_numbers?: { id: string; phone_number: string }[] } }>(`/number_orders`, {
    method: 'POST',
    body: JSON.stringify({ phone_numbers: [{ phone_number: phoneNumber }] }),
  });
  const purchased = order.data?.phone_numbers?.[0];
  if (purchased?.id) {
    await telnyxApi(`/phone_numbers/${purchased.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ connection_id: cfg().connectionId }),
    }).catch((err) => console.error('[telnyx] assign connection failed:', err));
  }
  cfg().phoneNumber = phoneNumber;
  db.phoneNumber.number = phoneNumber;
  db.phoneNumber.provider = 'Telnyx';
  db.phoneNumber.connected = true;
  return telnyxStatus();
}

export function disconnectTelnyx() {
  db.telephony = { apiKey: '', connectionId: '', phoneNumber: '', publicBaseUrl: cfg().publicBaseUrl };
  db.phoneNumber.connected = false;
  db.phoneNumber.provider = 'Twilio (mock)';
  return telnyxStatus();
}

/* ------------------------------ call control ------------------------------ */

/** Telnyx call_control_id -> our call id. */
const callControlMap = new Map<string, string>();
/** Calls that should hang up once the farewell message finishes playing. */
const pendingHangup = new Set<string>();

async function telnyxAction(callControlId: string, action: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await telnyxApi(`/calls/${callControlId}/actions/${action}`, { method: 'POST', body: JSON.stringify(payload) });
  } catch (err) {
    console.error(`[telnyx] ${action} failed for ${callControlId}:`, err);
  }
}

function speak(callControlId: string, text: string) {
  return telnyxAction(callControlId, 'speak', { payload: text, voice: 'female', language: 'en-US' });
}

function gatherSpeech(callControlId: string) {
  return telnyxAction(callControlId, 'gather_using_speech', {
    language: 'en-US',
    initial_timeout: 10000,
    speech_end_timeout: 1200,
    minimum_confidence: 0.7,
  });
}

function callFor(callControlId: string): Call | undefined {
  const callId = callControlMap.get(callControlId);
  return db.calls.find((c) => c.id === callId);
}

interface TelnyxEvent {
  data?: {
    event_type?: string;
    payload?: {
      call_control_id?: string;
      call_session_id?: string;
      from?: string;
      to?: string;
      direction?: string;
      speech?: { result?: string; confidence?: number };
    };
  };
}

/**
 * Handles one Telnyx webhook event. State machine:
 *   initiated  -> create ringing call + answer
 *   answered   -> agent speaks the greeting
 *   speak.ended -> gather caller speech (unless the call already ended)
 *   gather.ended -> run one AI-agent turn, speak the reply
 *   hangup     -> close the call record
 */
export async function handleTelnyxEvent(event: TelnyxEvent): Promise<void> {
  const type = event.data?.event_type;
  const payload = event.data?.payload;
  const callControlId = payload?.call_control_id;
  if (!type || !callControlId) return;

  switch (type) {
    case 'call.initiated': {
      const call = ringCall(payload?.from ?? 'unknown');
      callControlMap.set(callControlId, call.id);
      await telnyxAction(callControlId, 'answer', {});
      break;
    }
    case 'call.answered': {
      const call = callFor(callControlId);
      if (!call) break;
      const turn = answerCall(call.id);
      await speak(callControlId, turn.agentMessage);
      break;
    }
    case 'call.speak.ended': {
      if (pendingHangup.has(callControlId)) {
        pendingHangup.delete(callControlId);
        await telnyxAction(callControlId, 'hangup', {});
        break;
      }
      const call = callFor(callControlId);
      if (call && call.status === 'in-progress' && isSessionActive(call.id)) {
        await gatherSpeech(callControlId);
      }
      break;
    }
    case 'call.gather.ended': {
      const call = callFor(callControlId);
      const said = payload?.speech?.result?.trim();
      if (!call || call.status !== 'in-progress' || !isSessionActive(call.id)) break;
      if (!said) {
        // Nothing heard — ask again rather than dropping the call.
        await speak(callControlId, 'Sorry, I did not catch that. Could you say it again?');
        break;
      }
      const turn = reply(call.id, said);
      if (turn.bookingId) {
        const booking = db.bookings.find((b) => b.id === turn.bookingId);
        if (booking) {
          const { sendBookingConfirmation } = await import('./whatsapp');
          const customer = db.customers.find((c) => c.id === booking.customerId);
          sendBookingConfirmation(booking, customer?.whatsapp ?? customer?.phone ?? '');
        }
      }
      if (turn.step === 'ended') {
        pendingHangup.add(callControlId);
      }
      await speak(callControlId, turn.agentMessage);
      break;
    }
    case 'call.hangup': {
      const call = callFor(callControlId);
      if (call) {
        const { endCall } = await import('./aiAgent');
        endCall(call.id);
      }
      callControlMap.delete(callControlId);
      break;
    }
    default:
      break;
  }
}
