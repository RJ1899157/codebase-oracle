from app.models import CodeChunk
from app.retrieval.service import rank_by_keyword, reciprocal_rank_fusion


def test_rank_by_keyword_prefers_matching_chunk() -> None:
    chunks = [
        CodeChunk(id="1", text="def add(a, b): return a + b", file_path="a.py", start_line=1, end_line=1),
        CodeChunk(id="2", text="def subtract(a, b): return a - b", file_path="b.py", start_line=1, end_line=1),
    ]

    ranked = rank_by_keyword("add numbers", chunks)

    assert ranked[0].chunk.id == "1"


def test_reciprocal_rank_fusion_combines_rankings() -> None:
    chunks = [
        CodeChunk(id="1", text="add", file_path="a.py", start_line=1, end_line=1),
        CodeChunk(id="2", text="subtract", file_path="b.py", start_line=1, end_line=1),
    ]

    ranking_a = rank_by_keyword("add", chunks)
    ranking_b = list(reversed(ranking_a))

    fused = reciprocal_rank_fusion([ranking_a, ranking_b])

    assert len(fused) == 2
    assert {item.chunk.id for item in fused} == {"1", "2"}