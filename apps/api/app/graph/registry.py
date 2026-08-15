from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
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

    def to_react_flow(self, github_url: str, max_files: int = 8) -> dict[str, Any]:
        repo = self.get(github_url)
        if not repo:
            return {"github_url": github_url, "nodes": [], "edges": []}

        # 1. Group nodes by file_path
        file_map: dict[str, list[GraphNode]] = defaultdict(list)
        for node in repo.batch.nodes:
            file_map[node.file_path].append(node)

        # Prioritize core non-test files (e.g. app.py, scaffold.py, blue_prints.py)
        sorted_files = sorted(
            file_map.keys(),
            key=lambda f: (
                1 if "test" in f else 0,
                0 if ("app" in f or "core" in f or "main" in f) else 1,
                -len(file_map[f]),
            ),
        )

        selected_files = sorted_files[:max_files]
        display_nodes_set: set[str] = set()
        display_nodes: list[GraphNode] = []

        # Collect file nodes + child classes, functions, and key calls
        for f in selected_files:
            nodes_in_file = file_map[f]
            # Prioritize: file node, then classes, then top functions/calls
            ranked = sorted(
                nodes_in_file,
                key=lambda n: (
                    0 if n.kind == "file" else 1 if n.kind == "class" else 2 if n.kind == "function" else 3
                ),
            )
            for n in ranked[:12]:  # up to 12 symbols per file cluster
                display_nodes.append(n)
                display_nodes_set.add(n.id)

        # 2. Hierarchical Cluster Positioning (Column per File cluster)
        nodes_list = []
        x_gap = 320
        y_gap = 130

        for col_idx, file_path in enumerate(selected_files):
            file_cluster_nodes = [n for n in display_nodes if n.file_path == file_path]
            for row_idx, node in enumerate(file_cluster_nodes):
                x = col_idx * x_gap + 80
                y = row_idx * y_gap + 80

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
                        "position": {"x": x, "y": y},
                    }
                )

        # 3. Filter and animate edges connecting the rendered nodes
        edges_list = []
        for idx, edge in enumerate(repo.batch.edges):
            if edge.source_id in display_nodes_set and edge.target_id in display_nodes_set:
                edges_list.append(
                    {
                        "id": f"edge-{idx}-{edge.relation}",
                        "source": edge.source_id,
                        "target": edge.target_id,
                        "label": edge.relation,
                        "animated": edge.relation in {"CALLS", "IMPORTS", "INHERITS"},
                        "style": {
                            "stroke": "#818cf8" if edge.relation == "CALLS" else "#c084fc" if edge.relation == "INHERITS" else "#34d399",
                            "strokeWidth": 2,
                        },
                    }
                )

        return {
            "github_url": github_url,
            "nodes": nodes_list,
            "edges": edges_list,
        }


# Global singleton registry
global_registry = RepositoryRegistry()