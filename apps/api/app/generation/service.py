from __future__ import annotations

from app.generation.github_links import build_github_line_link
from app.models import AnswerResult, Citation
from app.retrieval.service import RetrievedChunk


def generate_answer(question: str, context: list[RetrievedChunk], github_url: str | None = None) -> AnswerResult:
    if not context:
        return AnswerResult(
            answer="",
            citations=[],
            refused=True,
            reason="insufficient_context",
        )

    top = context[0]
    citation_link = None
    if github_url is not None:
        citation_link = build_github_line_link(
            github_url=github_url,
            file_path=top.chunk.file_path,
            start_line=top.chunk.start_line,
            end_line=top.chunk.end_line,
        )

    citation = Citation(
        file_path=top.chunk.file_path,
        start_line=top.chunk.start_line,
        end_line=top.chunk.end_line,
        github_url=citation_link,
    )

    answer = (
        f"Based on the retrieved code, the most relevant match for "
        f"'{question}' is in {top.chunk.file_path}."
    )

    return AnswerResult(
        answer=answer,
        citations=[citation],
        refused=False,
        reason=None,
    )