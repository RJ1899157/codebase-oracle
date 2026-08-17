from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

from app.models import CodeChunk, GraphBatch


@dataclass(frozen=True)
class RetrievedChunk:
    chunk: CodeChunk
    score: float
    source: str


def tokenize(text: str) -> list[str]:
    # Extracts clean alphanumeric identifiers from code
    return [t.lower() for t in re.findall(r"\w+", text) if t]


def bm25_like_score(query: str, chunk: CodeChunk) -> float:
    query_tokens = Counter(tokenize(query))
    chunk_tokens = Counter(tokenize(chunk.text))
    score = 0.0

    for token, q_count in query_tokens.items():
        if token in chunk_tokens:
            score += q_count * chunk_tokens[token]

    if score <= 0.0:
        return 0.0

    # Boost definition chunks (e.g. `class Flask`, `def create_app`)
    lower_text = chunk.text.lower()
    for token in query_tokens:
        if f"class {token}" in lower_text or f"def {token}" in lower_text:
            score *= 4.0

    # Boost non-test source code over tests
    if "test" in chunk.file_path.lower():
        score *= 0.5
    else:
        score *= 1.8

    return score


def rank_by_keyword(query: str, chunks: list[CodeChunk]) -> list[RetrievedChunk]:
    scored = [
        RetrievedChunk(chunk=chunk, score=bm25_like_score(query, chunk), source="bm25")
        for chunk in chunks
    ]
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored


def graph_candidates(query: str, batch: GraphBatch, chunks: list[CodeChunk] | None = None) -> list[RetrievedChunk]:
    query_tokens = set(tokenize(query))
    candidates: list[RetrievedChunk] = []

    # Map file_path -> chunks for fast resolution
    chunks_by_file: dict[str, list[CodeChunk]] = {}
    if chunks:
        for c in chunks:
            chunks_by_file.setdefault(c.file_path, []).append(c)

    for node in batch.nodes:
        if node.kind not in {"file", "class", "interface", "struct", "function"}:
            continue

        node_name_lower = node.name.lower()
        node_tokens = set(tokenize(node.name))
        
        # High score for exact or prefix matches
        matched_tokens = query_tokens & node_tokens
        if matched_tokens:
            score = 2.5 * len(matched_tokens)
            if any(t == node_name_lower for t in query_tokens):
                score += 6.0
            if "test" not in node.file_path.lower():
                score += 2.0

            # Find matching real code chunk
            resolved_chunk: CodeChunk | None = None
            file_chunks = chunks_by_file.get(node.file_path, [])
            for fc in file_chunks:
                if (fc.start_line <= node.start_line <= fc.end_line) or (node.name.lower() in fc.text.lower()):
                    resolved_chunk = fc
                    break

            if not resolved_chunk and file_chunks:
                resolved_chunk = file_chunks[0]

            chunk_to_use = resolved_chunk or CodeChunk(
                id=node.id,
                text=f"{node.kind} {node.name} defined in {node.file_path} (lines {node.start_line}–{node.end_line})",
                file_path=node.file_path,
                start_line=node.start_line,
                end_line=node.end_line,
            )

            candidates.append(
                RetrievedChunk(chunk=chunk_to_use, score=score, source="graph")
            )

    candidates.sort(key=lambda item: item.score, reverse=True)
    return candidates


def reciprocal_rank_fusion(rankings: list[list[RetrievedChunk]], k: int = 60) -> list[RetrievedChunk]:
    merged: dict[str, RetrievedChunk] = {}
    scores: dict[str, float] = {}

    for ranking in rankings:
        for rank, item in enumerate(ranking, start=1):
            key = item.chunk.id
            merged[key] = item
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)

    result = [
        RetrievedChunk(chunk=merged[key].chunk, score=scores[key], source=merged[key].source)
        for key in scores
    ]
    result.sort(key=lambda item: item.score, reverse=True)
    return result


def hybrid_retrieve(query: str, chunks: list[CodeChunk], batch: GraphBatch, top_k: int = 8) -> list[RetrievedChunk]:
    keyword_results = rank_by_keyword(query, chunks)
    graph_results = graph_candidates(query, batch, chunks=chunks)

    positive_keywords = [item for item in keyword_results if item.score > 0.0][:20]
    top_graph = graph_results[:20]

    if not positive_keywords and not top_graph:
        return []

    valid_rankings = [r for r in [positive_keywords, top_graph] if r]
    fused = reciprocal_rank_fusion(valid_rankings)
    return fused[:top_k]