from __future__ import annotations

from pathlib import Path

from app.ingestion.parser import ParsedPythonFile
from app.models import GraphBatch, GraphEdge, GraphNode


def build_graph_batch(file_path: Path, parsed: ParsedPythonFile) -> GraphBatch:
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []

    file_id = f"file::{file_path.as_posix()}"
    nodes.append(
        GraphNode(
            id=file_id,
            kind="file",
            name=file_path.name,
            file_path=file_path.as_posix(),
            start_line=1,
            end_line=1,
        )
    )

    for symbol in parsed.symbols:
        symbol_id = f"symbol::{file_path.as_posix()}::{symbol.kind}::{symbol.name}"
        nodes.append(
            GraphNode(
                id=symbol_id,
                kind=symbol.kind,
                name=symbol.name,
                file_path=file_path.as_posix(),
                start_line=symbol.start_line,
                end_line=symbol.end_line,
            )
        )
        edges.append(
            GraphEdge(
                source_id=file_id,
                target_id=symbol_id,
                relation="CONTAINS",
            )
        )

    for imp in parsed.imports:
        import_id = f"import::{file_path.as_posix()}::{imp.name}"
        nodes.append(
            GraphNode(
                id=import_id,
                kind="import",
                name=imp.name,
                file_path=file_path.as_posix(),
                start_line=imp.start_line,
                end_line=imp.end_line,
            )
        )
        edges.append(
            GraphEdge(
                source_id=file_id,
                target_id=import_id,
                relation="IMPORTS",
            )
        )

    for call in parsed.calls:
        call_id = f"call::{file_path.as_posix()}::{call.name}"
        nodes.append(
            GraphNode(
                id=call_id,
                kind="call",
                name=call.name,
                file_path=file_path.as_posix(),
                start_line=call.start_line,
                end_line=call.end_line,
            )
        )
        edges.append(
            GraphEdge(
                source_id=file_id,
                target_id=call_id,
                relation="CALLS",
            )
        )

    return GraphBatch(nodes=nodes, edges=edges)


class Neo4jGraphStore:
    def write_batch(self, batch: GraphBatch) -> None:
        raise NotImplementedError("Neo4j writing will be implemented next")