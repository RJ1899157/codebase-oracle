from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.graph.registry import global_registry
from app.ingestion.github_repo import ingest_github_repo, process_repository
from app.models import AskRequest, GraphBatch, IngestRequest
from app.retrieval.pipeline import answer_question

app = FastAPI(title="codebase-oracle API", version="0.1.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest")
def ingest(request: IngestRequest) -> dict:
    result = ingest_github_repo(request.github_url)
    return {
        "github_url": result.github_url,
        "file_count": result.file_count,
        "node_count": result.node_count,
        "edge_count": result.edge_count,
        "chunk_count": result.chunk_count,
    }


@app.post("/ask")
def ask(request: AskRequest) -> dict:
    repo_data = global_registry.get(request.github_url)
    chunks = repo_data.chunks if repo_data else []
    batch = repo_data.batch if repo_data else GraphBatch(nodes=[], edges=[])

    result = answer_question(
        question=request.question,
        chunks=chunks,
        batch=batch,
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


@app.get("/graph")
def get_graph(github_url: str = Query(..., description="The GitHub repository URL")) -> dict:
    graph_data = global_registry.to_react_flow(github_url)
    if not graph_data["nodes"]:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{github_url}' has not been ingested yet.",
        )
    return graph_data