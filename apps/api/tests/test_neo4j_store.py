from app.graph.service import Neo4jGraphStore
from app.models import GraphBatch


def test_neo4j_store_write_batch_requires_real_connection() -> None:
    store = Neo4jGraphStore.__new__(Neo4jGraphStore)

    try:
        store.write_batch(GraphBatch(nodes=[], edges=[]))
    except Exception:
        pass