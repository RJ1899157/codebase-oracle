from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings


@dataclass(frozen=True)
class VectorChunk:
    id: str
    text: str
    file_path: str
    start_line: int
    end_line: int


class QdrantVectorStore:
    def __init__(self, url: str | None = None, api_key: str | None = None) -> None:
        settings = get_settings()
        self.url = url or settings.qdrant_url
        self.api_key = api_key or settings.qdrant_api_key

    def upsert_chunks(self, chunks: list[VectorChunk]) -> None:
        raise NotImplementedError("Qdrant writing will be implemented next")

    def search(self, query_text: str, top_k: int = 5) -> list[VectorChunk]:
        raise NotImplementedError("Qdrant search will be implemented next")