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
cd backend && npm install && npm run dev     # http://localhost:4000 (PORT env to change)
cd frontend && npm install && npm run dev    # http://localhost:3000
# or: ./dev.sh
```

The browser calls a same-origin `/api/*`, which Next.js proxies to the Express backend (`BACKEND_URL`,
default `http://localhost:4000`). Set `NEXT_PUBLIC_API_URL` to bypass the proxy and call the API directly.
If port 4000 is taken, run the API with `PORT=4001` and start Next with `BACKEND_URL=http://localhost:4001`.

Two sign-in roles on `/login`:

- **Dispatcher** — any credentials (demo auth cookie), lands on the dashboard.
- **Technician** — phone number + 4-digit PIN (shown on the admin Technicians page / work modal),
  lands on the mobile field app at `/tech`. Seeded PINs are `1001`–`1004` matching `tech_1`–`tech_4`.

## Environment

| Var | Where | Purpose |
| --- | ----- | ------- |
| `PORT` | backend | API port (default `4000`) |
| `CORS_ORIGIN` | backend | Comma-separated origins allowed to call the API directly (open in dev) |
| `BACKEND_URL` | frontend | Where the Next.js `/api/*` proxy forwards (default `http://localhost:4000`) |
| `NEXT_PUBLIC_API_URL` | frontend | Bypass the proxy and call the API directly |

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

### Technician field app + live tracking
- Technicians sign in at `/login → Technician` with phone + PIN and get a mobile-first portal at `/tech`:
  today's stats, the active job with an embedded Google Map and directions link, a stage workflow
  (Assigned → En route → On site → Done with timestamped events), upcoming schedule and work history.
- Location sharing toggle uses real GPS (`navigator.geolocation`) when available; otherwise positions are
  simulated server-side.
- The admin **Live Tracking** page shows every technician and job site on a live map (inDrive-style):
  pulsing en-route markers, dashed path to the destination, distance-to-job, last-seen times, and
  one-click "Open in Google Maps" for any tech or job.
- Per-technician **Work** modal on the Technicians page: jobs today/week, hours, live location map,
  field-app PIN, open jobs with stage badges and completion timelines.

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
| GET | `/api/tracking` | Fleet view: tech positions + active job targets |
| GET | `/api/technicians/:id/work` | Per-tech stats, jobs and timelines |
| POST | `/api/tech/login` | Technician sign-in (phone + PIN) → token |
| GET | `/api/tech/me`, `/api/tech/jobs` | Field app profile/stats + job list |
| POST | `/api/tech/jobs/:id/stage`, `/api/tech/location` | Stage updates + GPS ping |
| GET | `/api/whatsapp`, POST `/api/whatsapp/:id/respond` | Confirmation messages and button taps |
| GET/POST/PATCH | `/api/technicians` | Technician management |
| GET | `/api/availability`, `/api/availability/next` | Slot availability |
| GET/PUT | `/api/settings/phone-number` | Connected business number |
| POST | `/api/dev/reset` | Reseed mock data |

## Design

White background, purple (`#7c3aed`) primary and orange (`#f97316`) secondary accents across buttons, active
states, charts and highlights.
