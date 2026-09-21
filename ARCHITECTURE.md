# Wayfinder — Architecture & Installation Guide

## 1. Installation

**1. Get a free Groq API key (no credit card required):**
1. Go to https://console.groq.com/keys and sign up with an email, Google, or
   GitHub account.
2. Create a new API key and copy it.

**2. Set up the project:**
```bash
cd server
cp .env.example .env
```
Open `server/.env` and paste your key:
```
GROQ_API_KEY=gsk_your_actual_key_here
```

**3. Install dependencies and run:**
```bash
npm install
npm start
```

**4. Open the app:** visit `http://localhost:3000` in your browser. The
same Express server hosts both the API and the static frontend.

No other signups, billing, or paid services are needed.

## 2. Architecture Overview

Like the AI Resume & Cover Letter Builder, this is a small full-stack app:
one Node/Express server that serves the static frontend and proxies chat
requests to the Groq API, keeping the API key server-side only.

```
trip_planner_chatbot/
├── server/
│   ├── server.js         # Express app: static hosting + /api/chat route
│   ├── package.json
│   └── .env.example      # Copy to .env and add your Groq API key
└── public/                # Plain HTML/CSS/JS frontend (no build step)
    ├── index.html
    ├── styles.css
    └── script.js
```

**Conversation flow:**
1. The user types a message (or taps a suggestion chip). It's added to the
   chat as a user bubble and pushed onto an in-memory `conversation` array.
2. The full conversation (capped to the most recent 20 turns) is sent to
   `POST /api/chat`.
3. `server.js` prepends a system prompt that instructs the model to act as
   a trip-planning concierge and to respond with *only* a JSON object in
   one of two shapes: `{ "type": "question", "reply": "...", "itinerary": null }`
   or `{ "type": "itinerary", "reply": "...", "itinerary": {...} }`.
4. The parsed JSON is returned to the browser and pushed onto the
   conversation as an assistant turn — stored as the raw JSON string, so
   the model's own prior structured output is exactly what it sees again
   as history on the next request. This is what lets a follow-up like "make
   day 2 more relaxed" work: the model already has its previous itinerary
   in context and is instructed to regenerate the full plan with the
   change applied, rather than trying to patch it blindly.
5. `script.js` renders the result: `reply` always becomes a plain chat
   bubble; when `type` is `"itinerary"`, the itinerary object additionally
   renders as a "boarding pass" style card built entirely with
   `document.createElement` (no HTML string concatenation, so user-provided
   text can never be interpreted as markup).

## 3. Why these choices

- **A tiny Express backend instead of calling the LLM directly from the
  browser**: the same reasoning as the Resume Builder — an API key in
  frontend JavaScript is visible to anyone who opens dev tools.
- **Groq instead of OpenAI/Anthropic**: free tier, no credit card, and an
  OpenAI-compatible API that makes swapping providers later a small change.
- **A single structured JSON contract for every model response** (`type`,
  `reply`, `itinerary`) instead of separate "chat" and "generate itinerary"
  endpoints: the model itself decides, turn by turn, whether it has enough
  information yet. This keeps the conversation natural (it can still ask a
  clarifying question) while guaranteeing the frontend always gets
  predictable, renderable data instead of needing to guess the shape of
  free-form text.
- **Storing assistant history as the raw JSON string** rather than just the
  human-readable `reply` text: it gives the model perfect memory of the
  exact itinerary it produced, which is what makes "tweak my itinerary"
  follow-ups reliable instead of the model re-inventing a plan from scratch.
- **Plain HTML/CSS/JS instead of React**: one page, no complex client
  state beyond a single conversation array — a framework and build step
  would add setup friction without adding real value here.

## 4. Code Walkthrough (key files)

- **`server/server.js`** — `SYSTEM_PROMPT` encodes all of the assistant's
  behavior: when to ask a question vs. generate a plan, how to handle
  revision requests, and the exact JSON shape to return. `callGroq()`
  builds the request, handles HTTP/empty-response errors, and parses the
  JSON reply (stripping a markdown code fence if the model added one).
  `/api/chat` validates and caps the incoming conversation history before
  forwarding it to Groq.
- **`public/index.html`** — A single scrolling chat area plus a composer
  (auto-growing textarea + send button). `<template>` elements define the
  markup for user bubbles, assistant bubbles, the typing indicator, and
  error bubbles, so `script.js` never builds HTML from strings.
- **`public/script.js`** — `submitUserMessage()` and `sendMessages()`
  handle the request/response cycle, including a typing indicator and a
  retry-able error bubble. `buildItineraryCard()` is the most involved
  function: it builds the boarding-pass-style card (a teal header strip, a
  day badge, and a list of "day tickets" each with a dashed-perforation
  stub showing the day number) entirely via DOM APIs, plus wires up its own
  Copy and Download buttons.
- **`public/styles.css`** — Implements the visual identity: a vintage
  travel-poster palette (deep teal, sand, mustard gold), `DM Serif Display`
  for headings and day titles, `IBM Plex Mono` for ticket-style labels
  (day numbers, times), and the dashed-border "perforation" between each
  day ticket's stub and its content.

## 5. Extending the app

Ideas if you want to keep building on this for your portfolio:
- Persist conversations (would need a small database — this version is
  intentionally stateless and resets on refresh).
- Add a real map view of the itinerary using a free tier of a mapping API.
- Let the user export the itinerary as a formatted PDF instead of plain
  text.
- Add streaming responses so the assistant's reply appears token-by-token
  instead of all at once.
