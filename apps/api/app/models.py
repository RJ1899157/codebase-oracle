from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GraphNode:
    id: str
    kind: str
    name: str
    file_path: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class GraphEdge:
    source_id: str
    target_id: str
    relation: str


@dataclass(frozen=True)
class GraphBatch:
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@dataclass(frozen=True)
class CodeChunk:
    id: str
    text: str
    file_path: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class EmbeddedChunk(CodeChunk):
    embedding: list[float]
