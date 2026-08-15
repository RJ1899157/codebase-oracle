from __future__ import annotations

from app.generation.github_links import build_github_line_link
from app.generation.llm import generate_with_llm
from app.models import AnswerResult, Citation
from app.retrieval.service import RetrievedChunk


def format_context_for_prompt(question: str, context: list[RetrievedChunk]) -> str:
    lines = [f"QUESTION: {question}\n", "RETRIEVED CONTEXT:"]
    for i, item in enumerate(context, 1):
        lines.append(
            f"\n--- Context [{i}] from {item.chunk.file_path} (lines {item.chunk.start_line}-{item.chunk.end_line}) [Source: {item.source}] ---"
        )
        lines.append(item.chunk.text)
    return "\n".join(lines)


def generate_answer(
    question: str,
    context: list[RetrievedChunk],
    github_url: str | None = None,
) -> AnswerResult:
    if not context or all(item.score <= 0.0 for item in context):
        return AnswerResult(
            answer="",
            citations=[],
            refused=True,
            reason="insufficient_context",
        )

    # Build deep citations for the top matches
    citations: list[Citation] = []
    for item in context[:3]:
        link = None
        if github_url is not None:
            link = build_github_line_link(
                github_url=github_url,
                file_path=item.chunk.file_path,
                start_line=item.chunk.start_line,
                end_line=item.chunk.end_line,
            )
        citations.append(
            Citation(
                file_path=item.chunk.file_path,
                start_line=item.chunk.start_line,
                end_line=item.chunk.end_line,
                github_url=link,
            )
        )

    prompt = format_context_for_prompt(question, context)
    llm_output = generate_with_llm(prompt)

    if llm_output.startswith("REFUSAL:"):
        return AnswerResult(
            answer="",
            citations=citations,
            refused=True,
            reason=llm_output.replace("REFUSAL:", "").strip(),
        )

    if not llm_output:
        # Fallback summary if no API key is active
        top = context[0]
        llm_output = (
            f"Based on the repository code, the relevant implementation for '{question}' "
            f"is located in `{top.chunk.file_path}` (lines {top.chunk.start_line}-{top.chunk.end_line})."
        )

    return AnswerResult(
        answer=llm_output,
        citations=citations,
        refused=False,
        reason=None,
    )