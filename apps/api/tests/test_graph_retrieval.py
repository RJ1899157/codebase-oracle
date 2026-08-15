from app.models import GraphBatch, GraphEdge, GraphNode
from app.retrieval.service import graph_candidates


def test_graph_candidates_match_symbol_names() -> None:
    batch = GraphBatch(
        nodes=[
            GraphNode(
                id="file::a.py",
                kind="file",
                name="a.py",
                file_path="a.py",
                start_line=1,
                end_line=1,
            ),
            GraphNode(
                id="symbol::a.py::function::add",
                kind="function",
                name="add",
                file_path="a.py",
                start_line=1,
                end_line=3,
            ),
        ],
        edges=[
            GraphEdge(
                source_id="file::a.py",
                target_id="symbol::a.py::function::add",
                relation="CONTAINS",
            )
        ],
    )

    results = graph_candidates("add numbers", batch)

    assert len(results) == 1
    assert results[0].chunk.id == "symbol::a.py::function::add"