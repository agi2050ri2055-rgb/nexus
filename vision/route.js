import { NextResponse } from "next/server";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning";

export async function POST(req) {
  try {
    const body = await req.json();
    const { image, question } = body || {};

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
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

    const prompt =
      question && question.trim().length > 0
        ? question
        : "Describe what you see in this image in 2-3 natural sentences, as if you're an assistant that just looked up.";

    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.5,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("NVIDIA vision API error:", response.status, errText);
      return NextResponse.json(
        {
          error: `Vision API error (${response.status}). Check your NVIDIA_API_KEY and rate limits.`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const description =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't make sense of that image — try capturing again.";

    return NextResponse.json({ description });
  } catch (err) {
    console.error("Vision route error:", err);
    return NextResponse.json(
      { error: "Something went wrong analyzing the image." },
      { status: 500 }
    );
  }
}
