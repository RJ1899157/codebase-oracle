from __future__ import annotations

from app.generation.github_links import build_github_line_link
from app.generation.llm import generate_with_llm
from app.models import AnswerResult, ChatMessage, Citation
from app.retrieval.service import RetrievedChunk


def format_context_for_prompt(question: str, context: list[RetrievedChunk], max_chunks: int = 4) -> str:
    lines = [f"QUESTION: {question}\n", "RETRIEVED CODE CONTEXT:"]
    for i, item in enumerate(context[:max_chunks], 1):
        chunk_snippet = item.chunk.text[:1200]
        lines.append(
            f"\n--- Context [{i}] from {item.chunk.file_path} (lines {item.chunk.start_line}-{item.chunk.end_line}) [Source: {item.source}] ---"
        )
        lines.append(chunk_snippet)
    return "\n".join(lines)


def generate_answer(
    question: str,
    context: list[RetrievedChunk],
    github_url: str | None = None,
    history: list[ChatMessage] | None = None,
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
    for item in (context or [])[:4]:
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

    prompt = format_context_for_prompt(question, context or [], max_chunks=6)
    res = generate_with_llm(prompt, history=history)
    if isinstance(res, tuple):
        llm_output, error_msg = res
    else:
        llm_output, error_msg = str(res), None

    REFUSAL_PHRASES = (
        "refusal:",
        "does not contain",
        "not found in the provided",
        "not mentioned in the provided",
        "no mention of",
        "no evidence of",
        "insufficient context",
        "cannot answer based on the provided",
        "not present in the repository",
        "unrelated to this repository",
        "not defined in the provided",
        "no implementation of",
        "there is no information about",
        "is not part of",
    )

    llm_lower = llm_output.strip().lower()
    is_explicit_refusal = llm_lower.startswith("refusal:") or llm_lower.startswith("refusal")
    is_short_refusal = len(llm_output.strip()) < 300 and any(phrase in llm_lower for phrase in REFUSAL_PHRASES)
    is_refusal = is_explicit_refusal or is_short_refusal

    if is_refusal:
        reason_text = llm_output.replace("REFUSAL:", "").strip() if llm_output.startswith("REFUSAL:") else "insufficient_context"
        return AnswerResult(
            answer="REFUSAL: Insufficient context in repository to answer this question.",
            citations=[],
            refused=True,
            reason=reason_text or "insufficient_context",
        )

    if not llm_output:
        top = context[0]
        fallback_msg = (
            f"**Local Graph Evidence Found**:\n"
            f"The primary implementation for `{question}` is located in `{top.chunk.file_path}` "
            f"(lines {top.chunk.start_line}–{top.chunk.end_line}).\n\n"
        )
        if error_msg:
            fallback_msg += f"> ⚠️ **LLM Diagnostic Notice**: `{error_msg}`"

        return AnswerResult(
            answer=fallback_msg,
            citations=citations,
            refused=False,
            reason=None,
        )

    return AnswerResult(
        answer=llm_output,
        citations=citations,
        refused=False,
        reason=None,
    )