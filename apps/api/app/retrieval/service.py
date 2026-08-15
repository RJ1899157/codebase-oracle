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
    # Extracts clean alphanumeric identifiers from code (ignoring parens, colons, commas, etc.)
    return [t.lower() for t in re.findall(r"\w+", text) if t]


def bm25_like_score(query: str, chunk_text: str) -> float:
    query_tokens = Counter(tokenize(query))
    chunk_tokens = Counter(tokenize(chunk_text))
    score = 0.0

    for token, q_count in query_tokens.items():
        if token in chunk_tokens:
            score += q_count * chunk_tokens[token]

    return score


def rank_by_keyword(query: str, chunks: list[CodeChunk]) -> list[RetrievedChunk]:
    scored = [
        RetrievedChunk(chunk=chunk, score=bm25_like_score(query, chunk.text), source="bm25")
        for chunk in chunks
    ]
    scored.sort(key=lambda item: item.score, reverse=True)
    return scored


def graph_candidates(query: str, batch: GraphBatch) -> list[RetrievedChunk]:
    query_tokens = set(tokenize(query))
    candidates: list[RetrievedChunk] = []

    for node in batch.nodes:
        node_tokens = set(tokenize(node.name))
        if query_tokens & node_tokens:
            chunk = CodeChunk(
                id=node.id,
                text=f"{node.kind}: {node.name}",
                file_path=node.file_path,
                start_line=node.start_line,
                end_line=node.end_line,
            )
            candidates.append(
                RetrievedChunk(chunk=chunk, score=1.0, source="graph")
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


def hybrid_retrieve(query: str, chunks: list[CodeChunk], batch: GraphBatch) -> list[RetrievedChunk]:
    keyword_results = rank_by_keyword(query, chunks)
    graph_results = graph_candidates(query, batch)

    # Filter only positive matches
    positive_keywords = [item for item in keyword_results if item.score > 0.0]

    if not positive_keywords and not graph_results:
        return []

    valid_rankings = [r for r in [positive_keywords, graph_results] if r]
    return reciprocal_rank_fusion(valid_rankings)