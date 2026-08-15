from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.evaluation.service import EvalTestCase, run_evaluation
from app.graph.registry import global_registry
from app.ingestion.github_repo import ingest_github_repo
from app.models import AskRequest, GraphBatch, IngestRequest
from app.retrieval.pipeline import answer_question

app = FastAPI(title="codebase-oracle API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "codebase-oracle API",
        "status": "running",
        "docs_url": "/docs",
        "health_url": "/health",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/status")
def status() -> dict:
    settings = get_settings()
    active_llm = "None (Offline Fallback)"
    if settings.groq_api_key:
        active_llm = f"Groq LLaMA 3.3 70B ({settings.groq_model})"
    elif settings.gemini_api_key:
        active_llm = f"Google Gemini Flash ({settings.gemini_model})"

    return {
        "groq_configured": bool(settings.groq_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "active_model": active_llm,
    }


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


@app.get("/evaluate")
def evaluate(github_url: str = Query(..., description="The GitHub repository URL")) -> dict:
    repo_data = global_registry.get(github_url)
    if not repo_data:
        raise HTTPException(status_code=404, detail=f"Repository '{github_url}' not ingested yet.")

    benchmark_cases = [
        EvalTestCase(
            question="Where is Calculator or core math class defined?",
            ground_truth_answer="Calculator is defined in calculator.py",
            expected_files=["calculator.py", "math_lib.py"],
            should_refuse=False,
        ),
        EvalTestCase(
            question="How does quantum teleportation blockchain work in this repo?",
            ground_truth_answer="",
            expected_files=[],
            should_refuse=True,
        ),
    ]

    report = run_evaluation(
        test_cases=benchmark_cases,
        chunks=repo_data.chunks,
        batch=repo_data.batch,
        github_url=github_url,
    )

    return {
        "github_url": github_url,
        "total_cases": report.total_cases,
        "passed_cases": report.passed_cases,
        "mean_faithfulness": report.mean_faithfulness,
        "mean_context_precision": report.mean_context_precision,
        "refusal_accuracy": report.refusal_accuracy,
        "details": [
            {
                "question": d.question,
                "faithfulness": d.faithfulness_score,
                "precision": d.context_precision_score,
                "refusal_accurate": d.refusal_accurate,
                "passed": d.passed,
            }
            for d in report.details
        ],
    }