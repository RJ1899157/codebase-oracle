from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class RepoRequest:
    github_url: str


@dataclass(frozen=True)
class Citation:
    file_path: str
    start_line: int
    end_line: int
    github_url: Optional[str] = None


@dataclass(frozen=True)
class AnswerRequest:
    github_url: str
    question: str

