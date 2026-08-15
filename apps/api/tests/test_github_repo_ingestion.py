from pathlib import Path

from app.ingestion.github_repo import IngestResult
from app.ingestion.service import discover_python_files


def test_discover_python_files_on_local_repo(tmp_path: Path) -> None:
    (tmp_path / "a.py").write_text("print('a')\n", encoding="utf-8")
    (tmp_path / "nested").mkdir()
    (tmp_path / "nested" / "b.py").write_text("print('b')\n", encoding="utf-8")

    files = discover_python_files(tmp_path)

    assert len(files) == 2
    assert all(path.suffix == ".py" for path in files)