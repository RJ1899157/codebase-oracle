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

    def to_react_flow(self, github_url: str, max_modules: int = 7, layout: str = "layered") -> dict[str, Any]:
        repo = self.get(github_url)
        if not repo:
            return {"github_url": github_url, "nodes": [], "edges": []}

        file_map: dict[str, list[GraphNode]] = defaultdict(list)
        for node in repo.batch.nodes:
            file_map[node.file_path].append(node)

        # Prioritize core non-test architecture modules
        sorted_files = sorted(
            file_map.keys(),
            key=lambda f: (
                1 if "test" in f.lower() else 0,
                0 if any(k in f.lower() for k in ["app.py", "main.py", "blueprints.py", "config.py", "ctx.py", "scaffold.py", "views.py", "core.py"]) else 1,
                -len(file_map[f]),
            ),
        )

        selected_files = sorted_files[:max_modules]
        display_nodes_set: set[str] = set()
        nodes_list = []
        edges_list = []

        if layout == "radial":
            # Radial Galaxy Mode
            total_clusters = len(selected_files)
            galaxy_radius = max(380.0, total_clusters * 90.0)
            center_x, center_y = 600, 450

            for cluster_idx, file_path in enumerate(selected_files):
                angle = (2 * math.pi / max(total_clusters, 1)) * cluster_idx
                hub_x = center_x + galaxy_radius * math.cos(angle)
                hub_y = center_y + galaxy_radius * math.sin(angle)

                nodes_in_file = file_map[file_path]
                file_node = next((n for n in nodes_in_file if n.kind == "file"), None)
                child_symbols = [n for n in nodes_in_file if n.kind != "file"]

                if file_node:
                    display_nodes_set.add(file_node.id)
                    nodes_list.append({
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
                        "position": {"x": round(hub_x, 1), "y": round(hub_y, 1)},
                    })

                for child_idx, child in enumerate(child_symbols[:8]):
                    child_angle = angle + (math.pi * 1.3 * (child_idx - (len(child_symbols[:8]) - 1) / 2) / max(len(child_symbols[:8]), 1))
                    cx = hub_x + 190.0 * math.cos(child_angle)
                    cy = hub_y + 190.0 * math.sin(child_angle)
                    display_nodes_set.add(child.id)
                    nodes_list.append({
                        "id": child.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": child.name,
                            "kind": child.kind,
                            "file_path": child.file_path,
                            "start_line": child.start_line,
                            "end_line": child.end_line,
                        },
                        "position": {"x": round(cx, 1), "y": round(cy, 1)},
                    })
        else:
            # Layered Architecture Tree Mode (Default)
            col_spacing = 330
            row_spacing = 115

            for col_idx, file_path in enumerate(selected_files):
                x_pos = col_idx * col_spacing + 80
                nodes_in_file = file_map[file_path]

                file_node = next((n for n in nodes_in_file if n.kind == "file"), None)
                classes = [n for n in nodes_in_file if n.kind == "class"]
                functions = [n for n in nodes_in_file if n.kind == "function"]
                calls_and_imports = [n for n in nodes_in_file if n.kind in {"import", "call"}]

                current_row = 0

                # Module Header
                if file_node:
                    display_nodes_set.add(file_node.id)
                    nodes_list.append({
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
                        "position": {"x": x_pos, "y": current_row * row_spacing + 60},
                    })
                    current_row += 1

                # Classes
                for cls in classes[:3]:
                    display_nodes_set.add(cls.id)
                    nodes_list.append({
                        "id": cls.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": cls.name,
                            "kind": "class",
                            "file_path": cls.file_path,
                            "start_line": cls.start_line,
                            "end_line": cls.end_line,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 60},
                    })
                    current_row += 1

                # Functions
                for fn in functions[:4]:
                    display_nodes_set.add(fn.id)
                    nodes_list.append({
                        "id": fn.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": fn.name,
                            "kind": "function",
                            "file_path": fn.file_path,
                            "start_line": fn.start_line,
                            "end_line": fn.end_line,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 60},
                    })
                    current_row += 1

                # Dependencies
                for dep in calls_and_imports[:2]:
                    display_nodes_set.add(dep.id)
                    nodes_list.append({
                        "id": dep.id,
                        "type": "customCodeNode",
                        "data": {
                            "label": dep.name,
                            "kind": dep.kind,
                            "file_path": dep.file_path,
                            "start_line": dep.start_line,
                            "end_line": dep.end_line,
                        },
                        "position": {"x": x_pos, "y": current_row * row_spacing + 60},
                    })
                    current_row += 1

        # Bold high-contrast edge colors
        for idx, edge in enumerate(repo.batch.edges):
            if edge.source_id in display_nodes_set and edge.target_id in display_nodes_set:
                rel = edge.relation
                edge_color = (
                    "#00f0ff" if rel == "CALLS" else
                    "#ffb700" if rel == "INHERITS" else
                    "#ff3366" if rel == "IMPORTS" else
                    "#00ff66"
                )
                edges_list.append({
                    "id": f"edge-{idx}-{rel}",
                    "source": edge.source_id,
                    "target": edge.target_id,
                    "type": "smoothstep",
                    "label": rel,
                    "animated": rel in {"CALLS", "IMPORTS"},
                    "style": {
                        "stroke": edge_color,
                        "strokeWidth": 2.0 if rel in {"CALLS", "INHERITS"} else 1.2,
                    },
                })

        return {
            "github_url": github_url,
            "nodes": nodes_list,
            "edges": edges_list,
        }


# Global singleton registry
global_registry = RepositoryRegistry()