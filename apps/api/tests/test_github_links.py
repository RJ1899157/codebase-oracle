from app.generation.github_links import build_github_line_link


def test_build_github_line_link_formats_line_anchor() -> None:
    link = build_github_line_link(
        "https://github.com/user/repo",
        "src/main.py",
        10,
        20,
    )

    assert link == "https://github.com/user/repo/blob/main/src/main.py#L10-L20"