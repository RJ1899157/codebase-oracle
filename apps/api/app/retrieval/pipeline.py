from __future__ import annotations

from app.generation.service import generate_answer
from app.models import AnswerResult, CodeChunk, GraphBatch
from app.retrieval.service import hybrid_retrieve


def answer_question(
    question: str,
    chunks: list[CodeChunk],
    batch: GraphBatch,
    github_url: str | None = None,
) -> AnswerResult:
    context = hybrid_retrieve(question, chunks, batch)
    return generate_answer(question, context, github_url=github_url)