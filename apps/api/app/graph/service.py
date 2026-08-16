from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings
from app.ingestion.parser import ParsedFile
from app.models import GraphBatch, GraphEdge, GraphNode


def build_graph_batch(file_path: Path, parsed: ParsedFile) -> GraphBatch:
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

        if symbol.kind == "class" and symbol.bases:
            for base in symbol.bases:
                base_id = f"class::{base}"
                nodes.append(
                    GraphNode(
                        id=base_id,
                        kind="class",
                        name=base,
                        file_path=file_path.as_posix(),
                        start_line=symbol.start_line,
                        end_line=symbol.end_line,
                    )
                )
                edges.append(
                    GraphEdge(
                        source_id=symbol_id,
                        target_id=base_id,
                        relation="INHERITS",
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
    def __init__(self, uri: str | None = None, user: str | None = None, password: str | None = None) -> None:
        from neo4j import GraphDatabase

        settings = get_settings()
        self._driver = GraphDatabase.driver(
            uri or settings.neo4j_uri,
            auth=(user or settings.neo4j_user, password or settings.neo4j_password),
        )

    def close(self) -> None:
        self._driver.close()

    def write_batch(self, batch: GraphBatch) -> None:
        with self._driver.session() as session:
            session.execute_write(self._write_batch_tx, batch)

    @staticmethod
    def _write_batch_tx(tx, batch: GraphBatch) -> None:
        for node in batch.nodes:
            tx.run(
                """
                MERGE (n:Entity {id: $id})
                SET n.kind = $kind,
                    n.name = $name,
                    n.file_path = $file_path,
                    n.start_line = $start_line,
                    n.end_line = $end_line
                """,
                id=node.id,
                kind=node.kind,
                name=node.name,
                file_path=node.file_path,
                start_line=node.start_line,
                end_line=node.end_line,
            )

        for edge in batch.edges:
            tx.run(
                """
                MATCH (source:Entity {id: $source_id})
                MATCH (target:Entity {id: $target_id})
                MERGE (source)-[r:RELATION {kind: $relation}]->(target)
                """,
                source_id=edge.source_id,
                target_id=edge.target_id,
                relation=edge.relation,
            )
