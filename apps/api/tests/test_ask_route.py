from fastapi.testclient import TestClient

from app.main import app


def test_ask_route_refuses_without_context() -> None:
    client = TestClient(app)

    response = client.post(
        "/ask",
        json={
            "github_url": "https://github.com/user/repo",
            "question": "What does add do?",
        },
    )

    assert response.status_code == 200
    assert response.json()["refused"] is True
    assert response.json()["reason"] == "insufficient_context"