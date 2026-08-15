from __future__ import annotations

from app.models import (
    CodeChunk,
    EvalMetricResult,
    EvalReport,
    EvalTestCase,
    GraphBatch,
)
from app.retrieval.pipeline import answer_question
from app.retrieval.service import hybrid_retrieve, tokenize

STOP_WORDS = {
    "the", "is", "are", "and", "or", "in", "on", "at", "for", "with",
    "based", "code", "relevant", "located", "lines", "line", "implementation",
    "repository", "what", "where", "how", "this", "that", "from"
}


def evaluate_faithfulness(answer: str, retrieved_texts: list[str]) -> float:
    """Measures if key substantive terms in the answer are supported by retrieved context."""
    if not answer:
        return 0.0
    if not retrieved_texts:
        return 0.0

    combined_context = " ".join(retrieved_texts).lower()
    answer_tokens = [t for t in tokenize(answer) if t not in STOP_WORDS and len(t) > 2]

    if not answer_tokens:
        return 1.0

    supported_count = sum(1 for token in answer_tokens if token in combined_context)
    return round(supported_count / len(answer_tokens), 2)


def evaluate_context_precision(expected_files: list[str], citations: list[str]) -> float:
    """Measures if expected files appear in the retrieved citations."""
    if not expected_files:
        return 1.0
    if not citations:
        return 0.0

    hits = sum(1 for expected in expected_files if any(expected in c for c in citations))
    return round(hits / len(expected_files), 2)


def run_evaluation(
    test_cases: list[EvalTestCase],
    chunks: list[CodeChunk],
    batch: GraphBatch,
    github_url: str = "https://github.com/example/repo",
) -> EvalReport:
    details: list[EvalMetricResult] = []

    for case in test_cases:
        result = answer_question(
            question=case.question,
            chunks=chunks,
            batch=batch,
            github_url=github_url,
        )

        retrieved_context = hybrid_retrieve(case.question, chunks, batch)
        context_texts = [item.chunk.text for item in retrieved_context]
        citation_files = [c.file_path for c in result.citations]

        # Check refusal accuracy
        refusal_accurate = (result.refused == case.should_refuse)

        if case.should_refuse:
            faithfulness = 1.0 if result.refused else 0.0
            precision = 1.0 if result.refused else 0.0
        else:
            faithfulness = evaluate_faithfulness(result.answer, context_texts)
            precision = evaluate_context_precision(case.expected_files, citation_files)

        passed = refusal_accurate and (faithfulness >= 0.3) and (precision >= 0.5)

        details.append(
            EvalMetricResult(
                question=case.question,
                faithfulness_score=faithfulness,
                context_precision_score=precision,
                refusal_accurate=refusal_accurate,
                passed=passed,
            )
        )

    total = len(test_cases)
    passed_count = sum(1 for d in details if d.passed)
    mean_faith = round(sum(d.faithfulness_score for d in details) / max(total, 1), 2)
    mean_prec = round(sum(d.context_precision_score for d in details) / max(total, 1), 2)
    refusal_acc = round(sum(1.0 for d in details if d.refusal_accurate) / max(total, 1), 2)

    return EvalReport(
        total_cases=total,
        passed_cases=passed_count,
        mean_faithfulness=mean_faith,
        mean_context_precision=mean_prec,
        refusal_accuracy=refusal_acc,
        details=details,
    )