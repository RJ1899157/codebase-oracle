from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256

from app.core.config import get_settings
from app.models import CodeChunk, EmbeddedChunk


VectorChunk = CodeChunk


def chunk_text(text: str, max_chars: int = 800) -> list[str]:
    parts = [part.strip() for part in text.split("\n\n") if part.strip()]
    if not parts:
        return [text.strip()] if text.strip() else []

    chunks: list[str] = []
    current = ""
    for part in parts:
        if not current:
            current = part
            continue
        candidate = f"{current}\n\n{part}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = part
    if current:
        chunks.append(current)
    return chunks


def _hash_embedding(text: str, dimensions: int = 8) -> list[float]:
    digest = sha256(text.encode("utf-8")).digest()
    values: list[float] = []
    for index in range(dimensions):
        byte = digest[index]
        values.append(byte / 255.0)
    return values


def embed_chunk(chunk: CodeChunk) -> EmbeddedChunk:
    return EmbeddedChunk(
        id=chunk.id,
        text=chunk.text,
        file_path=chunk.file_path,
        start_line=chunk.start_line,
        end_line=chunk.end_line,
        embedding=_hash_embedding(chunk.text),
    )


class QdrantVectorStore:
    def __init__(self, url: str | None = None, api_key: str | None = None) -> None:
        settings = get_settings()
        self.url = url or settings.qdrant_url
        self.api_key = api_key or settings.qdrant_api_key

    def upsert_chunks(self, chunks: list[EmbeddedChunk]) -> None:
        raise NotImplementedError("Qdrant writing will be implemented next")

    def search(self, query_text: str, top_k: int = 5) -> list[EmbeddedChunk]:
        raise NotImplementedError("Qdrant search will be implemented next")
