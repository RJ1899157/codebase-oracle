from app.vectors.service import QdrantVectorStore, VectorChunk


def test_qdrant_store_has_settings_defaults() -> None:
    store = QdrantVectorStore()
    assert store.url.startswith("http")


def test_qdrant_store_methods_are_not_implemented_yet() -> None:
    store = QdrantVectorStore()

    try:
        store.upsert_chunks([VectorChunk("1", "text", "file.py", 1, 1)])
    except NotImplementedError:
        pass
    else:
        raise AssertionError("Expected NotImplementedError")