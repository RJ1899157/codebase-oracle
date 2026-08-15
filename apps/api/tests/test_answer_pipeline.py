from app.models import CodeChunk, GraphBatch
from app.retrieval.pipeline import answer_question


def test_answer_question_refuses_without_context() -> None:
    result = answer_question("what does add do?", [], GraphBatch(nodes=[], edges=[]))

    assert result.refused is True
    assert result.reason == "insufficient_context"