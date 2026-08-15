from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Automatically search for .env in current dir, parent dir, or project root
for env_path in [Path(".env"), Path("../.env"), Path("../../.env"), Path("/app/.env")]:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        break


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""

    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")


@lru_cache
def get_settings() -> Settings:
    return Settings()