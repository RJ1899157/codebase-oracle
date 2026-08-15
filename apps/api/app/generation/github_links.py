from __future__ import annotations


def build_github_line_link(github_url: str, file_path: str, start_line: int, end_line: int) -> str:
    cleaned_base = github_url.rstrip("/")
    cleaned_path = file_path.lstrip("/")
    return f"{cleaned_base}/blob/main/{cleaned_path}#L{start_line}-L{end_line}"