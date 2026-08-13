import { NextResponse } from "next/server";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

// ── EDIT THIS BEFORE THE DEMO ───────────────────────────────────────────
// This is exactly what Nexus says when someone asks it to introduce
// itself to the board. It's returned instantly, without calling the model,
// so it can never come out garbled or off-script at the one moment that
// matters most. Rewrite it in your own words before tomorrow.
const BOARD_INTRO = `Hello — I'm Nexus. I'm an AI assistant with real-time voice interaction, live visual understanding through camera input, and persistent memory that carries across sessions, so I remember our past conversations instead of starting fresh every time. Everything you're seeing right now is running live: NVIDIA's Nemotron models handle the reasoning, and Supabase stores memory persistently. This is an early build — version one of something designed to grow into a broader assistant for the team. I'm happy to take a question if you'd like to see that in action.`;
// ─────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Nexus, a sharp, professional AI assistant running in a live enterprise demo. Keep replies concise (2-4 sentences unless asked for more detail), confident, and natural to read aloud. Don't call yourself "just an AI" or pile on disclaimers unless the question genuinely calls for one.`;

function isBoardIntroTrigger(text) {
  const t = text.toLowerCase();
  return t.includes("introduce yourself") && t.includes("board");
}

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

    if (lastUserMessage && isBoardIntroTrigger(lastUserMessage.content)) {
      return NextResponse.json({ reply: BOARD_INTRO, triggered: "board_intro" });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Server is missing NVIDIA_API_KEY. Add it in Vercel → Settings → Environment Variables (or .env.local for local dev).",
        },
        { status: 500 }
      );
    }

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: chatMessages,
        max_tokens: 600,
        temperature: 0.6,
        stream: false,
        // Skips the model's internal chain-of-thought so replies come back
        // faster and the visible content is never empty — important live.
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("NVIDIA API error:", response.status, errText);
      return NextResponse.json(
        {
          error: `Nemotron API error (${response.status}). Check your NVIDIA_API_KEY and rate limits.`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const reply =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I didn't get a clear response there — try asking again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}
