"""Google Gemini LLM client with graceful no-key fallback."""

import os
import logging

GEMINI_MODEL = "gemini-3.1-flash-lite-preview"
logger = logging.getLogger(__name__)


def call_llm(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """Call Gemini API if key is set, return empty string otherwise."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — skipping LLM call")
        return ""

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
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
    except Exception as e:
        logger.error("Gemini call failed: %s", e)
        return ""
