from app.models import CodeChunk
from app.vectors.service import chunk_text, embed_chunk


def test_chunk_text_splits_code_into_chunks() -> None:
    text = "first block\n\nsecond block\n\nthird block"

    chunks = chunk_text(text, max_chars=20)

    assert [c.text for c in chunks] == ["first block", "second block", "third block"]


def test_embed_chunk_returns_fixed_embedding_shape() -> None:
    chunk = CodeChunk(
        id="1",
        text="def add(a, b): return a + b",
        file_path="sample.py",
        start_line=1,
        end_line=1,
    )

    embedded = embed_chunk(chunk)

    assert embedded.id == "1"
    assert len(embedded.embedding) == 8