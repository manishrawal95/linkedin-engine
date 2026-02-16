"""
LLM provider abstraction — Gemini (default) or Claude.
"""

from __future__ import annotations

import logging

from backend import config

logger = logging.getLogger(__name__)


async def generate(prompt: str, system: str = "") -> str:
    """Generate text using the configured LLM provider."""
    provider = config.LLM_PROVIDER.lower()
    if provider == "gemini":
        return await _generate_gemini(prompt, system)
    elif provider == "claude":
        return await _generate_claude(prompt, system)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}. Use 'gemini' or 'claude'.")


async def _generate_gemini(prompt: str, system: str) -> str:
    import asyncio
    from google import genai
    from google.genai import errors as genai_errors

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    max_retries = 5
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=config.GEMINI_MODEL,
                contents=full_prompt,
                config=genai.types.GenerateContentConfig(
                    temperature=config.LLM_TEMPERATURE,
                ),
            )
            return response.text or ""
        except genai_errors.ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = min(60, (attempt + 1) * 15)
                logger.warning("Gemini rate limited, retrying in %ds (attempt %d/%d)", wait, attempt + 1, max_retries)
                await asyncio.sleep(wait)
            else:
                raise
    raise RuntimeError("Gemini rate limit exceeded after retries. Try again in a few minutes.")


async def _generate_claude(prompt: str, system: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    kwargs = {
        "model": config.CLAUDE_MODEL,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": config.LLM_TEMPERATURE,
    }
    if system:
        kwargs["system"] = system

    response = client.messages.create(**kwargs)
    return response.content[0].text


def get_model_name() -> str:
    provider = config.LLM_PROVIDER.lower()
    if provider == "gemini":
        return config.GEMINI_MODEL
    elif provider == "claude":
        return config.CLAUDE_MODEL
    return provider
