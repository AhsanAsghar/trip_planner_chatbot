require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const MAX_HISTORY_TURNS = 20;

const SYSTEM_PROMPT = `You are Wayfinder, a friendly, knowledgeable trip-planning concierge having a conversation with a traveler.

Your goal is to help them get a clear, realistic day-by-day itinerary.

Conversation rules:
- If you don't yet know the destination and roughly how many days the trip is, ask ONE short, friendly clarifying question covering whatever is missing. Don't ask about anything else yet.
- Once you know the destination and duration, you may proceed even if budget, interests, or travel style weren't given — make sensible, clearly-stated assumptions (e.g. "assuming a mid-range budget and a mix of culture and food") rather than asking more questions.
- When the traveler asks you to change something about an itinerary you already gave (e.g. "make day 2 more relaxed", "add more food stops", "this is too expensive"), regenerate the FULL itinerary with those changes applied rather than just describing the change in words.
- Keep recommendations general and realistic in kind (e.g. "a rooftop bar with skyline views", "a well-known noodle stall in the night market") rather than inventing precise prices, phone numbers, or opening hours you cannot know are current.
- Be warm and concise. Never pad with filler.

Output format — respond with ONLY a JSON object, no other text, in exactly one of these two shapes:

{
  "type": "question",
  "reply": "your one clarifying question here",
  "itinerary": null
}

or, once you're ready to produce a plan:

{
  "type": "itinerary",
  "reply": "one or two warm sentences introducing or summarizing the plan",
  "itinerary": {
    "destination": "city/region name",
    "durationDays": 3,
    "travelStyle": "short phrase, e.g. 'Relaxed mid-range, food & culture focused'",
    "days": [
      {
        "day": 1,
        "title": "short theme for the day, e.g. 'Old Town & Riverside'",
        "activities": [
          { "time": "Morning", "activity": "short activity name", "notes": "one short sentence of detail" },
          { "time": "Afternoon", "activity": "short activity name", "notes": "one short sentence of detail" },
          { "time": "Evening", "activity": "short activity name", "notes": "one short sentence of detail" }
        ]
      }
    ],
    "budgetNote": "one short sentence on estimated daily budget range and what it assumes"
  }
}`;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/**
 * The model is instructed to return raw JSON, but some models still wrap
 * it in a markdown code fence. This strips that fence before parsing so a
 * stray ```json``` doesn't turn into a hard failure for the user.
 */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

async function callGroq(messages) {
  if (!GROQ_API_KEY) {
    const err = new Error(
      'Missing GROQ_API_KEY. Copy server/.env.example to server/.env and add your free key from https://console.groq.com/keys'
    );
    err.status = 500;
    throw err;
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Groq API request failed (${response.status}). ${detail}`.trim());
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const err = new Error('Groq API returned an empty response.');
    err.status = 502;
    throw err;
  }

  try {
    return extractJson(content);
  } catch {
    const err = new Error('The AI response was not valid JSON. Please try again.');
    err.status = 502;
    throw err;
  }
}

// ---------------------------------------------------------------------
// Chat endpoint
// ---------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'No conversation was provided.' });
    }

    const validTurns = messages
      .filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0 &&
          (m.role === 'user' || m.role === 'assistant')
      )
      .slice(-MAX_HISTORY_TURNS);

    if (validTurns.length === 0) {
      return res.status(400).json({ error: 'No valid conversation turns were provided.' });
    }

    const result = await callGroq([
      { role: 'system', content: SYSTEM_PROMPT },
      ...validTurns,
    ]);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, configured: Boolean(GROQ_API_KEY) });
});

app.listen(PORT, () => {
  console.log(`Trip Planner Chatbot running at http://localhost:${PORT}`);
});
