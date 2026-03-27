"""Anthropic LLM client wrapper with graceful no-key fallback."""

import os

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")


def call_llm(prompt: str, system: str = "", max_tokens: int = 1024) -> str:
    """Call Claude API if key is set, return empty string otherwise."""
    if not ANTHROPIC_API_KEY:
        return ""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            system=system or "You are a process automation expert analyzing business process mining data.",
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text
    except Exception:
        return ""
