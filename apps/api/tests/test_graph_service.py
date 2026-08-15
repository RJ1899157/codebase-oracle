from pathlib import Path

from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_python_file


def test_build_graph_batch_creates_file_and_symbol_nodes(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
class Greeter:
    def hello(self):
        return "hi"
""".strip(),
        encoding="utf-8",
    )

    parsed = parse_python_file(file_path)
    batch = build_graph_batch(file_path, parsed)

    assert [node.kind for node in batch.nodes] == ["file", "class", "function"]
    assert [edge.relation for edge in batch.edges] == ["CONTAINS", "CONTAINS"]
