from __future__ import annotations

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

    def to_react_flow(self, github_url: str, max_modules: int = 6) -> dict[str, Any]:
        repo = self.get(github_url)
        if not repo:
            return {"github_url": github_url, "nodes": [], "edges": []}

        # 1. Group nodes by file_path
        file_map: dict[str, list[GraphNode]] = defaultdict(list)
        for node in repo.batch.nodes:
            file_map[node.file_path].append(node)

        # Prioritize core non-test architecture modules
        sorted_files = sorted(
            file_map.keys(),
            key=lambda f: (
                1 if "test" in f else 0,
                0 if any(k in f.lower() for k in ["app.py", "main.py", "blueprints.py", "config.py", "ctx.py", "scaffold.py", "views.py"]) else 1,
                -len(file_map[f]),
            ),
        )

        selected_files = sorted_files[:max_modules]
        display_nodes_set: set[str] = set()
        nodes_list = []
        edges_list = []

        # 2. Layered Architecture Layout (Spaced columns with hierarchical vertical drop)
        col_spacing = 340
        row_spacing = 120

        for col_idx, file_path in enumerate(selected_files):
            x_pos = col_idx * col_spacing + 100
            nodes_in_file = file_map[file_path]

            file_node = next((n for n in nodes_in_file if n.kind == "file"), None)
            classes = [n for n in nodes_in_file if n.kind == "class"]
            functions = [n for n in nodes_in_file if n.kind == "function"]
            calls_and_imports = [n for n in nodes_in_file if n.kind in {"import", "call"}]

            current_row = 0

            # Level 1: Root Module Node
            if file_node:
                display_nodes_set.add(file_node.id)
                nodes_list.append(
                    {
                        "id": file_node.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": file_node.name,
                            "kind": "file",
                            "file_path": file_node.file_path,
                            "start_line": file_node.start_line,
                            "end_line": file_node.end_line,
                            "symbol_count": len(nodes_in_file) - 1,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 80},
                    }
                )
                current_row += 1

            # Level 2: Classes
            for cls in classes[:3]:
                display_nodes_set.add(cls.id)
                nodes_list.append(
                    {
                        "id": cls.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": cls.name,
                            "kind": "class",
                            "file_path": cls.file_path,
                            "start_line": cls.start_line,
                            "end_line": cls.end_line,
                            "bases": getattr(cls, "bases", None) or [],
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 80},
                    }
                )
                current_row += 1

            # Level 3: Functions & Methods
            for fn in functions[:4]:
                display_nodes_set.add(fn.id)
                nodes_list.append(
                    {
                        "id": fn.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": fn.name,
                            "kind": "function",
                            "file_path": fn.file_path,
                            "start_line": fn.start_line,
                            "end_line": fn.end_line,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 80},
                    }
                )
                current_row += 1

            # Level 4: Dependencies / Calls
            for dep in calls_and_imports[:2]:
                display_nodes_set.add(dep.id)
                nodes_list.append(
                    {
                        "id": dep.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": dep.name,
                            "kind": dep.kind,
                            "file_path": dep.file_path,
                            "start_line": dep.start_line,
                            "end_line": dep.end_line,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 80},
                    }
                )
                current_row += 1

        # 3. Clean Relationship Edges with smooth curves
        for idx, edge in enumerate(repo.batch.edges):
            if edge.source_id in display_nodes_set and edge.target_id in display_nodes_set:
                rel = edge.relation
                edge_color = (
                    "#38bdf8" if rel == "CALLS" else
                    "#c084fc" if rel == "INHERITS" else
                    "#f59e0b" if rel == "IMPORTS" else
                    "#475569"
                )
                edges_list.append(
                    {
                        "id": f"edge-{idx}-{rel}",
                        "source": edge.source_id,
                        "target": edge.target_id,
                        "type": "smoothstep",
                        "label": rel,
                        "animated": rel in {"CALLS", "IMPORTS"},
                        "style": {
                            "stroke": edge_color,
                            "strokeWidth": 1.5,
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