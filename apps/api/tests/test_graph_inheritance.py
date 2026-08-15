from pathlib import Path

from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_python_file


def test_build_graph_batch_includes_inheritance(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
class Base:
    pass


class Child(Base):
    pass
""".strip(),
        encoding="utf-8",
    )

    parsed = parse_python_file(file_path)
    batch = build_graph_batch(file_path, parsed)

    assert any(edge.relation == "INHERITS" for edge in batch.edges)