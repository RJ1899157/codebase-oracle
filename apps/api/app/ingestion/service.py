from __future__ import annotations

from pathlib import Path

SUPPORTED_EXTENSIONS = {
    # Python
    ".py", ".pyw",
    # JavaScript / TypeScript / Frontend
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte",
    # Systems & Compiled
    ".go", ".rs", ".java", ".kt", ".kts", ".cs", ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp",
    # Scripting
    ".rb", ".php", ".swift", ".sh", ".bash", ".zsh",
    # Configuration & Docs
    ".json", ".yaml", ".yml", ".toml", ".md", ".sql", ".graphql", ".prisma",
}

IGNORED_DIRS = {
    ".git", ".github", "node_modules", "dist", "build", ".next", "__pycache__",
    ".venv", "venv", "env", "target", "vendor", ".turbo", ".idea", ".vscode",
    "coverage", ".pytest_cache",
}

IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".pdf", ".zip", ".tar",
    ".gz", ".exe", ".bin", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mp3",
    ".pyc", ".lock",
}


def discover_code_files(repo_root: Path, max_files: int = 400) -> list[Path]:
    discovered: list[Path] = []

    for path in repo_root.rglob("*"):
        if not path.is_file():
            continue

        # Skip ignored directory parts (relative to repo_root)
        try:
            rel_parts = path.relative_to(repo_root).parts
            if any(ignored in rel_parts for ignored in IGNORED_DIRS):
                continue
        except Exception:
            pass

        ext = path.suffix.lower()

        # Skip binary / non-code extensions
        if ext in IGNORED_EXTENSIONS:
            continue

        # Support recognized code extensions or key repo files
        if ext in SUPPORTED_EXTENSIONS or path.name in {"Dockerfile", "Makefile", "README.md"}:
            try:
                if path.stat().st_size < 400_000:
                    discovered.append(path)
            except Exception:
                continue

        if len(discovered) >= max_files:
            break

    return sorted(discovered)


# Backward compatibility alias
def discover_python_files(repo_root: Path) -> list[Path]:
    # If explicitly searching for python files in older tests, return py files
    files = discover_code_files(repo_root)
    return [f for f in files if f.suffix.lower() in {".py", ".pyw"}]