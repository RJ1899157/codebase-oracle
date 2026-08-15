from fastapi.testclient import TestClient

from app.main import app


def test_ingest_route_accepts_request() -> None:
    client = TestClient(app)

    response = client.post(
        "/ingest",
        json={
            "github_url": "https://github.com/user/repo",
        },
    )

    assert response.status_code == 200