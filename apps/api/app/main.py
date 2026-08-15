from fastapi import FastAPI

from app.models import AskRequest, GraphBatch, IngestRequest
from app.retrieval.pipeline import answer_question
from app.ingestion.github_repo import ingest_github_repo

app = FastAPI(title="codebase-oracle API", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ask")
def ask(request: AskRequest) -> dict:
    result = answer_question(
        question=request.question,
        chunks=[],
        batch=GraphBatch(nodes=[], edges=[]),
        github_url=request.github_url,
    )
    return {
        "answer": result.answer,
        "refused": result.refused,
        "reason": result.reason,
        "citations": [
            {
                "file_path": citation.file_path,
                "start_line": citation.start_line,
                "end_line": citation.end_line,
                "github_url": citation.github_url,
            }
            for citation in result.citations
        ],
    }


@app.post("/ingest")
def ingest(request: IngestRequest) -> dict:
    result = ingest_github_repo(request.github_url)
    return {
        "github_url": result.github_url,
        "file_count": result.file_count,
    }