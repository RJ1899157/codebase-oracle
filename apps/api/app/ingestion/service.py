from __future__ import annotations

from pathlib import Path


def discover_python_files(repo_root: Path) -> list[Path]:
    return sorted(
        path for path in repo_root.rglob("*.py") if ".git" not in path.parts
    )