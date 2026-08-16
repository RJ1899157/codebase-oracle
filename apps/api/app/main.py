from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.core.config import get_settings
from app.evaluation.service import run_evaluation
from app.graph.registry import global_registry
from app.graph.service import Neo4jGraphStore
from app.ingestion.github_repo import ingest_github_repo
from app.models import (
    ChatMessage,
    CodeChunk,
    EvalTestCase,
    GraphBatch,
    IngestRequest,
)
from app.retrieval.pipeline import answer_question
from app.vectors.service import QdrantVectorStore


class AskPayload(BaseModel):
    question: str
    github_url: str | None = None
    history: list[dict[str, str]] = []


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    neo4j_store = Neo4jGraphStore(
        uri=settings.neo4j_uri,
        user=settings.neo4j_user,
        password=settings.neo4j_password,
    )
    app.state.neo4j_store = neo4j_store

    qdrant_store = QdrantVectorStore(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
    )
    app.state.qdrant_store = qdrant_store

    yield

    neo4j_store.close()
    qdrant_store.close()


app = FastAPI(title="codebase-oracle-api", version="0.1.0", lifespan=lifespan)

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


@app.get("/status")
def status() -> dict:
    groq_key = os.getenv("GROQ_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    active_model = "Local AST Retrieval Engine"
    if groq_key:
        active_model = "Groq LLaMA 3.3 70B (llama-3.3-70b-versatile)"
    elif gemini_key:
        active_model = "Google Gemini 2.0 Flash"

    return {
        "groq_configured": bool(groq_key),
        "gemini_configured": bool(gemini_key),
        "active_model": active_model,
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
def ask(payload: AskPayload) -> dict:
    repo_data = global_registry.get(payload.github_url) if payload.github_url else None
    chunks = repo_data.chunks if repo_data else []
    batch = repo_data.batch if repo_data else GraphBatch(nodes=[], edges=[])

    chat_history = [
        ChatMessage(role=msg.get("role", "user"), content=msg.get("content", ""))
        for msg in payload.history
    ]

    result = answer_question(
        question=payload.question,
        chunks=chunks,
        batch=batch,
        github_url=payload.github_url,
        history=chat_history,
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
def get_graph(
    github_url: str = Query(..., description="The GitHub repository URL"),
    layout: str = Query("layered", description="Graph layout mode: layered or radial"),
) -> dict:
    graph_data = global_registry.to_react_flow(github_url, layout=layout)
    if not graph_data["nodes"]:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{github_url}' has not been ingested yet.",
        )
    return graph_data


def _build_dynamic_eval_cases(repo_data) -> list[EvalTestCase]:
    cases: list[EvalTestCase] = []

    def is_core_source_node(n) -> bool:
        path = n.file_path.lower()
        if any(ign in path for ign in ["docs", "tutorial", "test", "benchmark", "example", "site-packages", ".github"]):
            return False
        ext = n.file_path.split(".")[-1].lower() if "." in n.file_path else ""
        if ext not in {"py", "ts", "js", "go", "rs", "java", "cpp", "c", "cs"}:
            return False
        return len(n.name) <= 35 and n.name.isidentifier()

    classes = [n for n in repo_data.batch.nodes if n.kind in {"class", "interface", "struct"} and is_core_source_node(n)]
    functions = [n for n in repo_data.batch.nodes if n.kind == "function" and is_core_source_node(n)]

    # Fallback to any code node if core filter was too strict
    if not classes:
        classes = [n for n in repo_data.batch.nodes if n.kind in {"class", "interface", "struct"}]
    if not functions:
        functions = [n for n in repo_data.batch.nodes if n.kind == "function"]

    if classes:
        target_cls = classes[0]
        matching_files = list({n.file_path for n in repo_data.batch.nodes if n.name == target_cls.name})
        cases.append(
            EvalTestCase(
                question=f"Where is the {target_cls.name} class defined and what is its role?",
                ground_truth_answer=f"{target_cls.name} is defined in {target_cls.file_path}",
                expected_files=matching_files or [target_cls.file_path],
                should_refuse=False,
            )
        )

    if functions:
        target_fn = functions[0]
        matching_files = list({n.file_path for n in repo_data.batch.nodes if n.name == target_fn.name})
        cases.append(
            EvalTestCase(
                question=f"What is the implementation and purpose of {target_fn.name} in {target_fn.file_path}?",
                ground_truth_answer=f"{target_fn.name} is implemented in {target_fn.file_path}",
                expected_files=matching_files or [target_fn.file_path],
                should_refuse=False,
            )
        )

    if len(classes) > 1:
        target_cls_2 = classes[1]
        matching_files = list({n.file_path for n in repo_data.batch.nodes if n.name == target_cls_2.name})
        cases.append(
            EvalTestCase(
                question=f"How is {target_cls_2.name} structured in {target_cls_2.file_path}?",
                ground_truth_answer=f"{target_cls_2.name} is in {target_cls_2.file_path}",
                expected_files=matching_files or [target_cls_2.file_path],
                should_refuse=False,
            )
        )

    # Negative refusal test case (hallucination defense)
    cases.append(
        EvalTestCase(
            question="How does quantum teleportation neural blockchain consensus work in this repo?",
            ground_truth_answer="",
            expected_files=[],
            should_refuse=True,
        )
    )

    return cases


@app.get("/evaluate")
def evaluate(github_url: str = Query(..., description="The GitHub repository URL")) -> dict:
    repo_data = global_registry.get(github_url)
    if not repo_data:
        raise HTTPException(status_code=404, detail=f"Repository '{github_url}' not ingested yet.")

    benchmark_cases = _build_dynamic_eval_cases(repo_data)

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