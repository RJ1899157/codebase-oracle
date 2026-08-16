from __future__ import annotations

import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory

from app.graph.registry import global_registry
from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_file
from app.ingestion.service import discover_code_files
from app.models import CodeChunk, GraphBatch, IngestResult
from app.vectors.service import chunk_text


def process_repository(repo_path: Path, github_url: str) -> tuple[IngestResult, GraphBatch, list[CodeChunk]]:
    code_files = discover_code_files(repo_path)

    all_nodes = []
    all_edges = []
    all_chunks = []

    for file_path in code_files:
        rel_path = file_path.relative_to(repo_path).as_posix()
        parsed = parse_file(file_path)
        batch = build_graph_batch(Path(rel_path), parsed)

        all_nodes.extend(batch.nodes)
        all_edges.extend(batch.edges)

        source_code = file_path.read_text(encoding="utf-8", errors="replace")
        chunks = chunk_text(text=source_code, file_path=rel_path)
        all_chunks.extend(chunks)

    aggregated_batch = GraphBatch(nodes=all_nodes, edges=all_edges)
    result = IngestResult(
        github_url=github_url,
        file_count=len(code_files),
        node_count=len(all_nodes),
        edge_count=len(all_edges),
        chunk_count=len(all_chunks),
    )

    # Save into the active registry for queries & React Flow visualization
    global_registry.register(github_url, aggregated_batch, all_chunks)

    return result, aggregated_batch, all_chunks


def ingest_github_repo(github_url: str) -> IngestResult:
    with TemporaryDirectory() as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        repo_path = temp_dir / "repo"
        subprocess.run(
            ["git", "clone", "--depth", "1", github_url, str(repo_path)],
            check=True,
            capture_output=True,
            text=True,
        )
        result, _, _ = process_repository(repo_path, github_url)
        return result