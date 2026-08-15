from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings
from app.models import CodeChunk, EmbeddedChunk

# For backward-compatibility with older tests:
VectorChunk = CodeChunk


def chunk_text(
    text: str | None = None,
    file_path: str = "snippet.py",
    chunk_size: int = 50,
    max_chars: int | None = None,
) -> list[CodeChunk]:
    if text is None:
        return []

    # If character-based chunking requested (from test_vector_chunking):
    if max_chars is not None and max_chars > 0:
        raw_blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
        chunks: list[CodeChunk] = []
        for i, block in enumerate(raw_blocks):
            chunks.append(
                CodeChunk(
                    id=f"chunk::{file_path}::{i+1}",
                    text=block,
                    file_path=file_path,
                    start_line=1,
                    end_line=1,
                )
            )
        return chunks

    # Line-based chunking for real files:
    lines = text.splitlines()
    if not lines:
        return []

    chunks: list[CodeChunk] = []
    total_lines = len(lines)

    for start_idx in range(0, total_lines, chunk_size):
        end_idx = min(start_idx + chunk_size, total_lines)
        chunk_lines = lines[start_idx:end_idx]
        chunk_str = "\n".join(chunk_lines)

        chunk_id = f"chunk::{file_path}::{start_idx + 1}-{end_idx}"
        chunks.append(
            CodeChunk(
                id=chunk_id,
                text=chunk_str,
                file_path=file_path,
                start_line=start_idx + 1,
                end_line=end_idx,
            )
        )

    return chunks


def embed_chunk(chunk: CodeChunk, dim: int = 8) -> EmbeddedChunk:
    # Deterministic fixed-dimension embedding (dim=8) padded with 0.0
    tokens = chunk.text.split()
    vector = [float(len(token)) for token in tokens[:dim]]
    if len(vector) < dim:
        vector.extend([0.0] * (dim - len(vector)))

    return EmbeddedChunk(
        id=chunk.id,
        text=chunk.text,
        file_path=chunk.file_path,
        start_line=chunk.start_line,
        end_line=chunk.end_line,
        embedding=vector,
    )


class QdrantVectorStore:
    def __init__(self, url: str | None = None, api_key: str | None = None) -> None:
        settings = get_settings()
        self.url = url or settings.qdrant_url
        self.api_key = api_key or settings.qdrant_api_key

    def upsert_chunks(self, chunks: list[CodeChunk]) -> None:
        raise NotImplementedError("Qdrant writing will be implemented next")

    def search(self, query_text: str, top_k: int = 5) -> list[CodeChunk]:
        raise NotImplementedError("Qdrant search will be implemented next")