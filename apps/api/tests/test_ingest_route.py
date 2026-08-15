from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.models import IngestResult

def test_ingest_route_accepts_request() -> None:
    client = TestClient(app)

    mock_result = IngestResult(
        github_url="https://github.com/user/repo",
        file_count=2,
        node_count=8,
        edge_count=6,
        chunk_count=4,
    )

    with patch("app.main.ingest_github_repo", return_value=mock_result):
        response = client.post(
            "/ingest",
            json={"github_url": "https://github.com/user/repo"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["file_count"] == 2
    assert data["node_count"] == 8
    assert data["chunk_count"] == 4