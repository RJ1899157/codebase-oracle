from __future__ import annotations

from app.generation.service import generate_answer
from app.models import AnswerResult, ChatMessage, CodeChunk, GraphBatch
from app.retrieval.service import hybrid_retrieve


def answer_question(
    question: str,
    chunks: list[CodeChunk],
    batch: GraphBatch,
    github_url: str | None = None,
    history: list[ChatMessage] | None = None,
) -> AnswerResult:
    # If the user asks a short pronoun follow-up like "what methods does it have?",
    # enrich search query with terms from recent question
    query_text = question
    if history and len(question.split()) <= 6:
        last_user_msg = next((m.content for m in reversed(history) if m.role == "user"), "")
        if last_user_msg:
            query_text = f"{last_user_msg} {question}"

    context = hybrid_retrieve(query_text, chunks, batch)
    return generate_answer(question, context, github_url=github_url, history=history)