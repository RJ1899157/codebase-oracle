from app.models import CodeChunk, GraphBatch, GraphEdge, GraphNode
from app.retrieval.service import hybrid_retrieve


def test_hybrid_retrieve_merges_keyword_and_graph_results() -> None:
    chunks = [
        CodeChunk(id="1", text="def add(a, b): return a + b", file_path="a.py", start_line=1, end_line=1),
        CodeChunk(id="2", text="def subtract(a, b): return a - b", file_path="b.py", start_line=1, end_line=1),
    ]

    batch = GraphBatch(
        nodes=[
            GraphNode(
                id="symbol::a.py::function::add",
                kind="function",
                name="add",
                file_path="a.py",
                start_line=1,
                end_line=3,
            ),
            GraphNode(
                id="symbol::b.py::function::subtract",
                kind="function",
                name="subtract",
                file_path="b.py",
                start_line=1,
                end_line=3,
            ),
        ],
        edges=[],
    )

    results = hybrid_retrieve("add", chunks, batch)

    assert len(results) >= 1
    assert results[0].score > 0