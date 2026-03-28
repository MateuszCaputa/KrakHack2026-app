import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
  }

  const body = await req.json();
  const { prompt } = body as { prompt: string };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
    }
  );

  const data = await res.json();
  console.log('[ask-bottleneck] Gemini status:', res.status, 'body:', JSON.stringify(data).slice(0, 500));
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const geminiError = data?.error;
    if (geminiError?.code === 429) {
      return NextResponse.json({ error: 'API quota exceeded. Please check your Gemini plan at ai.dev/rate-limit.', raw: data }, { status: 429 });
    }
    return NextResponse.json({ error: 'No response from AI', raw: data }, { status: 502 });
  }

  return NextResponse.json({ text });
}
