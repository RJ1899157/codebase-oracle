from unittest.mock import patch

from app.generation.service import generate_answer
from app.models import CodeChunk
from app.retrieval.service import RetrievedChunk


def test_llm_handles_refusal_response() -> None:
    context = [
        RetrievedChunk(
            chunk=CodeChunk(id="1", text="some unrelated code", file_path="util.py", start_line=1, end_line=5),
            score=1.0,
            source="bm25",
        )
    ]

    with patch("app.generation.service.generate_with_llm", return_value="REFUSAL: Context does not mention database schema."):
        result = generate_answer("What is the DB schema?", context)

    assert result.refused is True
    assert "Context does not mention" in (result.reason or "")


def test_llm_successful_answer_generation() -> None:
    context = [
        RetrievedChunk(
            chunk=CodeChunk(id="1", text="def auth_user(token): return True", file_path="auth.py", start_line=10, end_line=12),
            score=2.5,
            source="hybrid",
        )
    ]

    mock_answer = "Authentication is handled by `auth_user` in `auth.py` which verifies the bearer token."
    with patch("app.generation.service.generate_with_llm", return_value=mock_answer):
        result = generate_answer("How does authentication work?", context, github_url="https://github.com/org/repo")

    assert result.refused is False
    assert result.answer == mock_answer
    assert len(result.citations) == 1
    assert result.citations[0].github_url == "https://github.com/org/repo/blob/main/auth.py#L10-L12"