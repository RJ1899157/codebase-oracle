from pathlib import Path

from app.ingestion.parser import parse_python_file


def test_parse_python_file_extracts_imports_and_calls(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
import os
from math import sqrt


def run():
    print(os.getcwd())
    return sqrt(4)
""".strip(),
        encoding="utf-8",
    )

    parsed = parse_python_file(file_path)

    assert [imp.name for imp in parsed.imports] == ["import os", "from math import sqrt"]
    assert [call.name for call in parsed.calls] == ["print", "os.getcwd", "sqrt"]