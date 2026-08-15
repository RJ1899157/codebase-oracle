from __future__ import annotations

import json
import os
from typing import Any
import urllib.request
import urllib.error

from app.core.config import get_settings

SYSTEM_PROMPT = """You are Codebase Oracle, a Principal AI Software Architect analyzing a GitHub repository.
You are given a developer's question along with exact retrieved code chunks and knowledge-graph relationships.

CRITICAL INSTRUCTIONS:
1. Answer the question thoroughly, clearly, and technically using the retrieved context.
2. Cite exact file paths, class names, and function names in backticks (e.g. `src/flask/app.py`).
3. Explain how the components connect, what they do, and where they are located.
4. If the context is completely unrelated or insufficient to answer, start your response with: "REFUSAL: Insufficient context in repository to answer this question."
5. Format your output in clean Markdown with clear headings and bullet points where helpful.
"""

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama3-70b-8192",
    "mixtral-8x7b-32768",
]

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


def call_groq(prompt: str, api_key: str, model_name: str | None = None) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    models_to_try = [model_name] if model_name else []
    models_to_try.extend([m for m in GROQ_MODELS if m != model_name])

    last_error = ""
    for model in models_to_try:
        if not model:
            continue
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "CodebaseOracle/1.0",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.2,
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                res = json.loads(response.read().decode("utf-8"))
                return res["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            last_error = e.read().decode("utf-8")
            print(f"[Groq Model {model} Error {e.code}]: {last_error}")
            continue
        except Exception as e:
            last_error = str(e)
            print(f"[Groq Exception]: {last_error}")
            continue

    raise RuntimeError(f"Groq API Error: {last_error}")


def call_gemini(prompt: str, api_key: str, model_name: str | None = None) -> str:
    models_to_try = [model_name] if model_name else []
    models_to_try.extend([m for m in GEMINI_MODELS if m != model_name])

    last_error = ""
    for model in models_to_try:
        if not model:
            continue
        for api_version in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent?key={api_key.strip()}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": f"{SYSTEM_PROMPT}\n\nUser Question and Context:\n{prompt}"}
                        ]
                    }
                ],
                "generationConfig": {"temperature": 0.2},
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    res = json.loads(response.read().decode("utf-8"))
                    return res["candidates"][0]["content"]["parts"][0]["text"]
            except urllib.error.HTTPError as e:
                last_error = e.read().decode("utf-8")
                print(f"[Gemini {api_version}/{model} Error {e.code}]: {last_error}")
                continue
            except Exception as e:
                last_error = str(e)
                continue

    raise RuntimeError(f"Gemini API Error: {last_error}")


def generate_with_llm(prompt: str) -> tuple[str, str | None]:
    """Returns (output_text, error_message)"""
    settings = get_settings()
    groq_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    gemini_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")

    # 1. Try Groq (LLaMA 3.3 70B)
    if groq_key and groq_key.strip():
        try:
            return call_groq(prompt, groq_key, settings.groq_model), None
        except Exception as e:
            print(f"[Codebase Oracle] Groq failed: {e}")
            if not gemini_key:
                return "", f"Groq Error: {str(e)}"

    # 2. Try Gemini Fallback
    if gemini_key and gemini_key.strip():
        try:
            return call_gemini(prompt, gemini_key, settings.gemini_model), None
        except Exception as e:
            print(f"[Codebase Oracle] Gemini failed: {e}")
            return "", f"Gemini Error: {str(e)}"

    return "", "No active GROQ_API_KEY or GEMINI_API_KEY found in .env"