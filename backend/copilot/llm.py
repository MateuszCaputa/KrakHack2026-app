"""Google Gemini LLM client with graceful no-key fallback."""

import os

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash-lite"


def call_llm(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """Call Gemini API if key is set, return empty string otherwise."""
    if not GEMINI_API_KEY:
        return ""

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        full_prompt = f"{system}\n\n{prompt}" if system else prompt
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=full_prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=0.3,
            ),
        )
        return response.text or ""
    except Exception:
        return ""
