from pathlib import Path

from app.ingestion.github_repo import process_repository

def test_process_repository_extracts_graph_and_chunks(tmp_path: Path) -> None:
    code_file = tmp_path / "calculator.py"
    code_file.write_text(
        """
import math

class Calculator:
    def add(self, a, b):
        return a + b
""".strip(),
        encoding="utf-8",
    )

    result, batch, chunks = process_repository(tmp_path, "https://github.com/example/calc")

    assert result.file_count == 1
    assert result.node_count > 0
    assert result.edge_count > 0
    assert result.chunk_count > 0
    assert any(n.name == "Calculator" for n in batch.nodes)