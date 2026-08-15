from fastapi.testclient import TestClient

from app.main import app


def test_evaluate_route_returns_404_for_uningested_repo() -> None:
    client = TestClient(app)
    response = client.get("/evaluate?github_url=https://github.com/example/repo")

    assert response.status_code == 404
    assert response.json()["detail"] == "Repository 'https://github.com/example/repo' not ingested yet."
