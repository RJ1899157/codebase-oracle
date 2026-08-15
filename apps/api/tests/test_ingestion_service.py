from pathlib import Path

from app.ingestion.service import discover_python_files


def test_discover_python_files(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("print('a')\n", encoding="utf-8")
    (tmp_path / "nested").mkdir()
    (tmp_path / "nested" / "b.py").write_text("print('b')\n", encoding="utf-8")
    (tmp_path / "ignore.txt").write_text("nope\n", encoding="utf-8")

    files = discover_python_files(tmp_path)

    assert files == [tmp_path / "a.py", tmp_path / "nested" / "b.py"]