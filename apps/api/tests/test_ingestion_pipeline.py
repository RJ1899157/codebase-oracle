from pathlib import Path

from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_python_file
from app.ingestion.service import discover_python_files


def test_ingestion_pipeline_builds_graph_batches(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
import os


class Greeter:
    def hello(self):
        print(os.getcwd())
""".strip(),
        encoding="utf-8",
    )

    python_files = discover_python_files(tmp_path)
    assert python_files == [file_path]

    parsed = parse_python_file(file_path)
    batch = build_graph_batch(file_path, parsed)

    assert batch.nodes
    assert batch.edges