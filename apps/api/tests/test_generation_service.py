from app.generation.service import generate_answer
from app.models import CodeChunk
from app.retrieval.service import RetrievedChunk


def test_generate_answer_refuses_without_context() -> None:
    result = generate_answer("what does add do?", [])

    assert result.refused is True
    assert result.reason == "insufficient_context"


def test_generate_answer_returns_citation_with_context() -> None:
    context = [
        RetrievedChunk(
            chunk=CodeChunk(
                id="1",
                text="def add(a, b): return a + b",
                file_path="a.py",
                start_line=1,
                end_line=1,
            ),
            score=1.0,
            source="bm25",
        )
    ]

    result = generate_answer("what does add do?", context)

    assert result.refused is False
    assert result.citations[0].file_path == "a.py"