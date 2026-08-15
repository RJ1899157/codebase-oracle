from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from app.models import CodeChunk, GraphBatch, GraphNode, GraphEdge


@dataclass
class RepositoryData:
    github_url: str
    batch: GraphBatch
    chunks: list[CodeChunk]


class RepositoryRegistry:
    def __init__(self) -> None:
        self._repos: dict[str, RepositoryData] = {}

    def register(self, github_url: str, batch: GraphBatch, chunks: list[CodeChunk]) -> None:
        self._repos[github_url] = RepositoryData(
            github_url=github_url,
            batch=batch,
            chunks=chunks,
        )

    def get(self, github_url: str) -> RepositoryData | None:
        return self._repos.get(github_url)

    def list_repositories(self) -> list[str]:
        return list(self._repos.keys())

    def to_react_flow(self, github_url: str) -> dict[str, Any]:
        repo = self.get(github_url)
        if not repo:
            return {"github_url": github_url, "nodes": [], "edges": []}

        nodes_list = []
        edges_list = []

        total_nodes = len(repo.batch.nodes)
        radius = max(200.0, total_nodes * 35.0)

        for idx, node in enumerate(repo.batch.nodes):
            angle = (2 * math.pi / max(total_nodes, 1)) * idx
            x = 400 + radius * math.cos(angle)
            y = 300 + radius * math.sin(angle)

            nodes_list.append(
                {
                    "id": node.id,
                    "type": "customCodeNode",
                    "data": {
                        "label": node.name,
                        "kind": node.kind,
                        "file_path": node.file_path,
                        "start_line": node.start_line,
                        "end_line": node.end_line,
                    },
                    "position": {"x": round(x, 1), "y": round(y, 1)},
                }
            )

        for idx, edge in enumerate(repo.batch.edges):
            edges_list.append(
                {
                    "id": f"edge-{idx}-{edge.source_id}->{edge.target_id}",
                    "source": edge.source_id,
                    "target": edge.target_id,
                    "label": edge.relation,
                    "animated": edge.relation in {"CALLS", "IMPORTS"},
                }
            )

        return {
            "github_url": github_url,
            "nodes": nodes_list,
            "edges": edges_list,
        }


# Global singleton registry for in-memory graph & chunk state
global_registry = RepositoryRegistry()