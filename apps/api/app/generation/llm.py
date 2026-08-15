from __future__ import annotations

import json
import logging
from typing import Any
import urllib.request
import urllib.error

from app.core.config import get_settings

logger = logging.getLogger("codebase_oracle_llm")

SYSTEM_PROMPT = """You are Codebase Oracle, an expert AI software engineer analyzing GitHub repositories.
You are given a user question and a set of retrieved code chunks and knowledge-graph relationships from the repository.

CRITICAL INSTRUCTIONS:
1. Ground your answer strictly in the provided Context.
2. If the context does not contain sufficient information to answer the question accurately, you MUST refuse by starting your answer with: "REFUSAL: Insufficient context in repository to answer this question."
3. Cite file paths and symbol names directly when explaining the code.
4. Keep explanations concise, clear, and technically accurate.
"""


def call_groq(prompt: str, settings: Any | None = None) -> str:
    cfg = settings or get_settings()
    if not cfg.groq_api_key:
        raise ValueError("GROQ_API_KEY is not configured")

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.groq_api_key.strip()}",
        "Content-Type": "application/json",
        "User-Agent": "CodebaseOracle/1.0",
    }
    payload = {
        "model": cfg.groq_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        res = json.loads(response.read().decode("utf-8"))
        return res["choices"][0]["message"]["content"]


def call_gemini(prompt: str, settings: Any | None = None) -> str:
    cfg = settings or get_settings()
    if not cfg.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{cfg.gemini_model}:generateContent?key={cfg.gemini_api_key.strip()}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{SYSTEM_PROMPT}\n\nUser Question and Context:\n{prompt}"}
                ]
            }
        ],
        "generationConfig": {"temperature": 0.1},
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        res = json.loads(response.read().decode("utf-8"))
        return res["candidates"][0]["content"]["parts"][0]["text"]


def generate_with_llm(prompt: str) -> str:
    settings = get_settings()

    # 1. Try Groq (LLaMA 3.3 70B) first
    if settings.groq_api_key and settings.groq_api_key.strip():
        try:
            return call_groq(prompt, settings)
        except Exception as e:
            print(f"[Codebase Oracle] Groq API call failed: {e}. Attempting fallback...")

    # 2. Try Gemini Flash fallback
    if settings.gemini_api_key and settings.gemini_api_key.strip():
        try:
            return call_gemini(prompt, settings)
        except Exception as e:
            print(f"[Codebase Oracle] Gemini API call failed: {e}. Falling back to local synthesis...")

    return ""