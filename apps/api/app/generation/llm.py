from __future__ import annotations

import json
import os
from typing import Any
import urllib.request
import urllib.error

from app.core.config import get_settings
from app.models import ChatMessage

SYSTEM_PROMPT = """You are Codebase Oracle, a Principal AI Software Architect and Static Analysis Engineer.
You are given a developer's question, conversation history, exact AST graph relationships, and retrieved source code chunks.

CRITICAL ARCHITECTURAL GUIDELINES:
1. Provide comprehensive, production-grade technical answers directly addressing the question.
2. Structure your response clearly using Markdown:
   - **Architecture & Overview**: Direct explanation of the component's role and purpose.
   - **Key Symbols & Implementation**: Exact classes, methods, parameters, and design patterns.
   - **Interactions & Data Flow**: How this module connects with other parts of the codebase.
   - **Citations**: Always reference exact file paths and line numbers in backticks (e.g. `fastapi/routing.py` L45–L80).
3. If the context is completely absent or wholly unrelated to the question, state: "REFUSAL: Insufficient context in repository to answer this question."
4. Be precise, accurate, and avoid making up non-existent files or functions.
"""

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama-3.3-70b-specdec",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview",
    "qwen-2.5-32b",
]

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


def call_groq(prompt: str, api_key: str, model_name: str | None = None, history: list[ChatMessage] | None = None) -> str:
    url = "https://api.groq.com/openai/v1/chat/completions"
    models_to_try = [model_name] if model_name else []
    models_to_try.extend([m for m in GROQ_MODELS if m != model_name])

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for msg in history[-6:]:
            role = "assistant" if msg.role == "assistant" else "user"
            messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": prompt})

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
            "messages": messages,
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


def call_gemini(prompt: str, api_key: str, model_name: str | None = None, history: list[ChatMessage] | None = None) -> str:
    models_to_try = [model_name] if model_name else []
    models_to_try.extend([m for m in GEMINI_MODELS if m != model_name])

    contents = []
    if history:
        for msg in history[-6:]:
            role = "model" if msg.role == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

    contents.append(
        {
            "role": "user",
            "parts": [{"text": f"{SYSTEM_PROMPT}\n\nUser Question and Context:\n{prompt}"}],
        }
    )

    last_error = ""
    for model in models_to_try:
        if not model:
            continue
        for api_version in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent?key={api_key.strip()}"
            headers = {"Content-Type": "application/json"}
            payload = {
                "contents": contents,
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


def generate_with_llm(prompt: str, history: list[ChatMessage] | None = None) -> tuple[str, str | None]:
    """Returns (output_text, error_message)"""
    settings = get_settings()
    groq_key = settings.groq_api_key or os.getenv("GROQ_API_KEY", "")
    gemini_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY", "")

    # 1. Try Groq (LLaMA 3.3 70B)
    if groq_key and groq_key.strip():
        try:
            return call_groq(prompt, groq_key, settings.groq_model, history=history), None
        except Exception as e:
            print(f"[Codebase Oracle] Groq failed: {e}")
            if not gemini_key:
                return "", f"Groq Error: {str(e)}"

    # 2. Try Gemini Fallback
    if gemini_key and gemini_key.strip():
        try:
            return call_gemini(prompt, gemini_key, settings.gemini_model, history=history), None
        except Exception as e:
            print(f"[Codebase Oracle] Gemini failed: {e}")
            return "", f"Gemini Error: {str(e)}"

    return "", "No active GROQ_API_KEY or GEMINI_API_KEY found in .env"