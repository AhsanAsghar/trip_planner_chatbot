# Wayfinder — AI Trip Planner Chatbot — Requirements

A conversational trip-planning assistant that turns a free-text description
of a trip into a structured, day-by-day itinerary, using a free LLM API.

## Functional Requirements

- Chat interface: the user describes a trip in their own words (destination,
  length, interests, budget — any or all of these).
- If the destination or trip length is missing, the assistant asks ONE
  short clarifying question before proceeding.
- Once enough information is known, the assistant generates a full
  itinerary: a trip summary, a travel style description, and a day-by-day
  breakdown with Morning/Afternoon/Evening activities and short notes.
- The itinerary renders as a distinct, readable "boarding pass" style card
  in the chat — not a wall of plain text.
- The user can ask for changes in plain language (e.g. "make day 2 more
  relaxed", "add more food stops", "this is too expensive") and the
  assistant regenerates the full itinerary with those changes applied.
- The user can copy an itinerary or download it as a `.txt` file.
- Quick-start suggestion chips are offered for a first-time user.
- Clear, actionable error messages with a one-click retry — never a silent
  failure.
- A "New Trip" action resets the conversation.

## Non-Functional Requirements

- Modern, distinctive, professional chat UI — not a generic template look.
- The AI API key must never be exposed to the browser; all calls to the LLM
  happen server-side.
- No paid or account-gated services required — must run entirely on a free
  API tier with no credit card.

## Platform Requirements

- Node.js `>=18` (for native `fetch` support)
- A modern web browser
- A free Groq API key (no credit card required) — see ARCHITECTURE.md for
  setup

## Dependencies

| Package | Purpose |
|---|---|
| `express` | Backend web server + static file hosting |
| `dotenv` | Loads the API key from a local `.env` file |

The frontend uses plain HTML, CSS, and JavaScript — no build step, no
frontend framework, no npm install required on the client side.

## AI Provider

- **Groq API** (`https://api.groq.com/openai/v1`), free tier: no credit
  card required, ~14,400 requests/day, OpenAI-compatible.
- Default model: `openai/gpt-oss-120b` (Groq's current recommended
  general-purpose free-tier model).

