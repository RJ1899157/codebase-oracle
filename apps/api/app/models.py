from __future__ import annotations

from dataclasses import dataclass, field


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


@dataclass(frozen=True)
class ChatMessage:
    role: str  # "user" | "assistant"
    content: str


@dataclass(frozen=True)
class AskRequest:
    github_url: str
    question: str
    history: list[ChatMessage] = field(default_factory=list)


@dataclass(frozen=True)
class IngestRequest:
    github_url: str


@dataclass(frozen=True)
class IngestResult:
    github_url: str
    file_count: int
    node_count: int
    edge_count: int
    chunk_count: int


@dataclass(frozen=True)
class Citation:
    file_path: str
    start_line: int
    end_line: int
    github_url: str | None = None


@dataclass(frozen=True)
class AnswerResult:
    answer: str
    citations: list[Citation]
    refused: bool
    reason: str | None = None


@dataclass(frozen=True)
class EvalTestCase:
    question: str
    ground_truth_answer: str
    expected_files: list[str]
    should_refuse: bool = False


@dataclass(frozen=True)
class EvalMetricResult:
    question: str
    faithfulness_score: float
    context_precision_score: float
    refusal_accurate: bool
    passed: bool


@dataclass(frozen=True)
class EvalReport:
    total_cases: int
    passed_cases: int
    mean_faithfulness: float
    mean_context_precision: float
    refusal_accuracy: float
    details: list[EvalMetricResult]