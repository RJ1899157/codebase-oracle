from pathlib import Path
from fastapi.testclient import TestClient

from app.ingestion.github_repo import process_repository
from app.main import app


def test_graph_and_ask_end_to_end_flow(tmp_path: Path) -> None:
    client = TestClient(app)
    repo_url = "https://github.com/test/mathlib"

    # Create mock python code
    math_file = tmp_path / "math_lib.py"
    math_file.write_text(
        """
import sys

class MathEngine:
    def compute(self, x):
        return x * 2
""".strip(),
        encoding="utf-8",
    )

    # Ingest the mock repo
    process_repository(tmp_path, repo_url)

    # 1. Test GET /graph returns React Flow structure
    graph_resp = client.get(f"/graph?github_url={repo_url}")
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    assert len(graph_data["nodes"]) > 0
    assert len(graph_data["edges"]) > 0
    assert "position" in graph_data["nodes"][0]
    assert "data" in graph_data["nodes"][0]

    # 2. Test POST /ask retrieves from indexed repository
    ask_resp = client.post(
        "/ask",
        json={"github_url": repo_url, "question": "Where is MathEngine defined?"},
    )
    assert ask_resp.status_code == 200
    ask_data = ask_resp.json()
    assert ask_data["refused"] is False
    assert len(ask_data["citations"]) > 0
    assert ask_data["citations"][0]["file_path"] == "math_lib.py"