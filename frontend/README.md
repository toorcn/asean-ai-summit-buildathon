# CARe — Fastest Hospital Finder

Find the fastest hospital (travel + wait), complete AI-powered intake on the way, and share a clean PDF summary via QR at reception.

## Overview

CARe is a Next.js 14 app that helps patients get seen faster:
- Combines travel time and estimated wait to rank nearby hospitals.
- Conversational AI intake collects triage-critical details before arrival.
- Generates a professional PDF summary you can download or share as a QR/link.

The app is mobile-first and works great as a PWA-style experience.

## Features

- Location-based hospital recommendations
  - Ranks by total time (travelEta + wait). Sort by Fastest, Closest, or Best-rated.
  - Uses your coordinates with HTTPS; falls back to mock data when no coords/back-end.
- Optional interactive map
  - Google Maps rendering when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set.
- AI intake chat
  - Powered by Groq chat completions (model defaults to `gemma2-9b-it`).
  - Simple, empathetic, one-question-at-a-time flow; quick replies for yes/no and 1–10 pain scale.
- Summary + PDF report
  - Server generates a PDF via `pdf-lib` at `/api/report/pdf/[token]`.
  - Includes highlights and captured intake fields; looks polished and clinic-friendly.
- Share to hospital/reception
  - One-tap QR/link share via `/api/share-to-hospital`; opens a read-only report page (`/r/[token]`).
- TTS voice replies (optional)
  - Groq TTS via OpenAI-compatible endpoint. Falls back to browser `speechSynthesis` if unavailable.
- Simple sessions
  - In-memory `sessionStore` tracks chat, fields, and summaries (replace with DB/KV for production).

## Tech stack

- Next.js 14 (App Router), React 18, TypeScript
- Tailwind CSS, framer-motion, SWR, lucide-react
- groq-sdk (LLM), pdf-lib (PDF generation)

## Quick start

### Prerequisites
- Node.js 18+ and npm
- Groq API key (for AI chat/summary and TTS)
- HTTPS for geolocation in browsers (localhost is fine)

### Setup

1) Copy environment template and fill in values:

```
cp .env.example .env.local
```

2) Install dependencies and run the dev server:

```
npm install
npm run dev
```

3) Open the app:
- http://localhost:3000 (default)

Tip: You can change the port, e.g. `next dev -p 3001`.

## Environment variables

Create `.env.local` with the following keys (see `.env.example`):

Required
- GROQ_API_KEY: Groq API key used by chat/summary and TTS.

Optional (with defaults)
- GROQ_MODEL: default `gemma2-9b-it`
- GROQ_TTS_MODEL: default `playai-tts`
- GROQ_TTS_VOICE: default `Fritz-PlayAI`
- GROQ_TTS_FORMAT: default `mp3`

Optional (feature/back-end integration)
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: enable interactive Google Map in Home screen.
- BACKEND_HOSPITALS_URL: base URL to a hospital service providing `/nearby-hospitals`.
- NEXT_PUBLIC_BASE_URL: base URL used when building share links and absolute PDF URLs; falls back to request headers/middleware.

## Scripts

- `npm run dev`: start Next.js dev server
- `npm run build`: production build
- `npm run start`: start production server
- `npm run lint`: lint
- `npm run typecheck`: TypeScript check

## API overview

- `GET /api/hospitals`
  - Query: `lat`, `lng`, `max` (optional). If `BACKEND_HOSPITALS_URL` is set, proxies to `POST /nearby-hospitals`; otherwise serves `public/mock/hospitals.json`.
  - Returns hospitals with computed `totalMinutes` and `comparisonMax` for UI bars.

- `POST /api/chat`
  - Body: `{ history: {id, role, content}[], sessionToken? }`
  - Uses Groq to produce the next assistant message; persists messages/fields in a session.

- `POST /api/summary`
  - Body: `{ sessionToken? }`
  - Uses Groq to summarize intake into `{ summary, highlights[] }`. Returns `{ pdfUrl, highlights, readTimeSec, summary, latestCreatedAt, history }`.

- `GET /api/report/pdf/[token]`
  - Optional query `payload` (base64url JSON) for stateless rendering. Generates a polished PDF using latest summary/highlights and fields.

- `POST /api/share-to-hospital`
  - Body: `{ sessionToken? }` → `{ url, token, expiresAt }`. `url` points to `/r/[token]` for reception sharing.

- `GET/POST /api/sessions`
  - GET lists active sessions (in-memory). POST creates a new session.

- `POST /api/tts`
  - Body: `{ text, voice?, format?, speed? }`. Returns audio (mp3/wav/ogg/flac/mulaw). GET form also available for quick testing.

- `GET /api/revalidate`
  - Returns `{ ok: true }` (placeholder health endpoint).

## Pages

- `/` — Home: request location, show map list, and hospital recommendations.
- `/chat` — Intake chat with optional voice input and TTS.
- `/summary` — Summary preview, highlights, embedded PDF, and QR/link sharing.
- `/r/[token]` — Reception view of a specific session report.

## How it works

1) User shares location → app ranks hospitals by total time.
2) User completes a short AI chat intake (symptoms, onset, meds, allergies, pain 1–10, exposure, age/gender, notes).
3) Server composes a concise clinical summary and key highlights via Groq.
4) A PDF report is generated and can be downloaded or shared as a QR/link.

## Deployment

- Vercel is recommended. Add the env vars above in the project settings.
- `NEXT_PUBLIC_BASE_URL` is auto-derived from requests via middleware if not set.
- Replace `sessionStore` with a durable store (DB/KV) for production.

## Privacy and data

- Sessions are in-memory per server instance and expire after a short TTL.
- Do not use in production without a persistent, secure store and proper consent/PHI handling.

## Troubleshooting

- Geolocation denied/blocked
  - Use HTTPS in browsers (or localhost). Check site permissions and try again.
- Map doesn’t render
  - Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and reload. A static placeholder is shown otherwise.
- Groq not used / fallback summary
  - Ensure `GROQ_API_KEY` is set. Check usage limits and network errors (server logs).
- TTS 502 / no audio
  - Verify `GROQ_API_KEY` and that the selected `voice/format` is supported. The UI will fall back to browser `speechSynthesis` when possible.

## Roadmap ideas

- Persistent storage for sessions and reports
- More languages and accessibility options
- Hospital capacity integrations and live triage routing

## License

No license file is provided in this repository.

---
Built with Next.js, Tailwind, Groq, and PDF-Lib.
