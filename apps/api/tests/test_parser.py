from pathlib import Path

from app.ingestion.parser import parse_python_file


def test_parse_python_file(tmp_path: Path) -> None:
    file_path = tmp_path / "sample.py"
    file_path.write_text(
        """
class Greeter:
    def hello(self):
        return "hi"


def add(a, b):
    return a + b
""".strip(),
        encoding="utf-8",
    )

    parsed = parse_python_file(file_path)

    assert [s.kind for s in parsed.symbols] == ["class", "function", "function"]
    assert [s.name for s in parsed.symbols] == ["Greeter", "hello", "add"]