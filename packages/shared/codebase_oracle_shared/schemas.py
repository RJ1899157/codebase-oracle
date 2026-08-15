from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ReactFlowNodeData:
    label: str
    kind: str
    file_path: str
    start_line: int
    end_line: int


@dataclass
class ReactFlowNode:
    id: str
    type: str
    data: ReactFlowNodeData
    position: dict[str, float] = field(default_factory=lambda: {"x": 0.0, "y": 0.0})


@dataclass
class ReactFlowEdge:
    id: str
    source: str
    target: str
    label: str
    animated: bool = False


@dataclass
class ReactFlowGraphResponse:
    github_url: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]