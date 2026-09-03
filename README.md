# HVAC AI Dispatcher

CRM + call management platform for HVAC businesses: an AI voice agent answers the business line, qualifies the job,
checks technician availability, books a slot, and sends a WhatsApp confirmation with Confirm / Cancel buttons.
Everything lands in a CRM with recordings, transcripts, a technician calendar and a live stats dashboard.

The build runs entirely on mock/sample data so the flows can be exercised end-to-end before real telephony /
WhatsApp Business providers are connected.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Frontend | Next.js 14 (App Router, SSR), TypeScript, Tailwind, Recharts |
| Backend  | Express 4 + TypeScript, Zod validation, in-memory store      |
| Transport| REST over HTTP; the UI polls the API every 5 seconds (no webhooks) |

## Run locally

```bash
cd backend && npm install && npm run dev     # http://localhost:4000
cd frontend && npm install && npm run dev    # http://localhost:3000
# or: ./dev.sh
```

The browser calls a same-origin `/api/*`, which Next.js proxies to the Express backend (`BACKEND_URL`,
default `http://localhost:4000`). Set `NEXT_PUBLIC_API_URL` to bypass the proxy and call the API directly.

Sign in with any credentials (demo auth cookie), and the dashboard is the landing page.

## Features

### Phone system + AI voice agent
- One business number is connected under **Phone & AI Agent** (number, provider, greeting, AI on/off).
- The AI agent flow: greeting → reason (Cooling / Heating / Emergency) → address + requirement → preferred
  date/time → availability check → re-ask with open slots until a valid one is agreed → WhatsApp number →
  hang up and log the call with recording + transcript.
- The flow is a real server-side state machine (`backend/src/aiAgent.ts`). Drive it turn-by-turn in the
  **Live AI call simulator**, or press **Simulate inbound call** to run a scripted call (which deliberately
  requests an unavailable slot first so the renegotiation path is exercised).

### WhatsApp confirmation
- Booking creation sends a WhatsApp message with **Confirm Booking** / **Cancel Booking** buttons.
- Confirm → booking becomes `Confirmed` and the slot is locked (the technician is no longer bookable).
- Cancel → booking becomes `Cancelled` and the slot is released back to the availability pool.
- The **WhatsApp** tab renders the outbound messages and lets you tap the buttons as the customer would.

### CRM
- Customers, bookings, call recordings (`/api/calls/:id/recording`, synthesized WAV for mock data) and full
  transcripts.
- Technician management: skills, working hours/days, on/off duty, live availability and upcoming jobs.
- Calendar with day (technician × hour grid), week and month views; double-booking is rejected by the
  availability engine on both AI and manual paths.
- Manual dispatcher override: create, edit, reschedule, reassign, confirm, cancel any booking.

### Dashboard
Total calls (daily/weekly/monthly), confirmed vs cancelled vs pending, average call duration, busiest hours and
days, technician utilization — as line/bar/pie charts — plus a searchable, filterable call log with recording
playback and transcript viewer.

## API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/stats?range=daily\|weekly\|monthly` | Dashboard metrics |
| GET | `/api/calls`, `/api/calls/:id` | Call log (search / outcome / date filters) |
| GET | `/api/calls/:id/recording` | Call audio (WAV) |
| POST | `/api/ai/calls/start`, `/api/ai/calls/:id/reply`, `/api/ai/calls/:id/end` | AI agent turn-by-turn |
| POST | `/api/ai/calls/simulate` | Full scripted AI call |
| GET/POST/PATCH | `/api/bookings` | Booking CRUD + dispatcher override |
| GET | `/api/whatsapp`, POST `/api/whatsapp/:id/respond` | Confirmation messages and button taps |
| GET/POST/PATCH | `/api/technicians` | Technician management |
| GET | `/api/availability`, `/api/availability/next` | Slot availability |
| GET/PUT | `/api/settings/phone-number` | Connected business number |
| POST | `/api/dev/reset` | Reseed mock data |

## Design

White background, purple (`#7c3aed`) primary and orange (`#f97316`) secondary accents across buttons, active
states, charts and highlights.
