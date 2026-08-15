from pathlib import Path

from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_python_file


def test_build_graph_batch_includes_imports_and_calls(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
import os


def run():
    print(os.getcwd())
""".strip(),
        encoding="utf-8",
    )

    parsed = parse_python_file(file_path)
    batch = build_graph_batch(file_path, parsed)

    assert [node.kind for node in batch.nodes] == ["file", "function", "import", "call", "call"]
    assert [edge.relation for edge in batch.edges] == ["CONTAINS", "IMPORTS", "CALLS", "CALLS"]