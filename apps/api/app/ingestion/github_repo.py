from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

from app.graph.service import build_graph_batch
from app.ingestion.parser import parse_python_file
from app.ingestion.service import discover_python_files
from app.models import GraphBatch


@dataclass(frozen=True)
class IngestResult:
    github_url: str
    file_count: int
    graph_batches: list[GraphBatch]


def ingest_github_repo(github_url: str) -> IngestResult:
    with TemporaryDirectory() as temp_dir_name:
        temp_dir = Path(temp_dir_name)
        repo_path = temp_dir / "repo"

        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", github_url, str(repo_path)],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError:
            return IngestResult(github_url=github_url, file_count=0, graph_batches=[])

        python_files = discover_python_files(repo_path)
        graph_batches: list[GraphBatch] = []

        for file_path in python_files:
            parsed = parse_python_file(file_path)
            graph_batches.append(build_graph_batch(file_path, parsed))

        return IngestResult(
            github_url=github_url,
            file_count=len(python_files),
            graph_batches=graph_batches,
        )