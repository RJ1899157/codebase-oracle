from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from tree_sitter import Language, Parser
import tree_sitter_python


@dataclass(frozen=True)
class CodeSymbol:
    name: str
    kind: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class CodeImport:
    name: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class CodeCall:
    name: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class ParsedPythonFile:
    symbols: list[CodeSymbol]
    imports: list[CodeImport]
    calls: list[CodeCall]


def _make_parser() -> Parser:
    parser = Parser()
    parser.language = Language(tree_sitter_python.language())
    return parser


def parse_python_file(file_path: Path) -> ParsedPythonFile:
    source = file_path.read_bytes()
    parser = _make_parser()
    tree = parser.parse(source)
    root = tree.root_node

    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    def node_text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8")

    def visit(node) -> None:
        if node.type == "function_definition":
            name_node = node.child_by_field_name("name")
            if name_node is not None:
                symbols.append(
                    CodeSymbol(
                        name=node_text(name_node),
                        kind="function",
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                    )
                )

        elif node.type == "class_definition":
            name_node = node.child_by_field_name("name")
            if name_node is not None:
                symbols.append(
                    CodeSymbol(
                        name=node_text(name_node),
                        kind="class",
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                    )
                )

        elif node.type in {"import_statement", "import_from_statement"}:
            imports.append(
                CodeImport(
                    name=node_text(node),
                    start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1,
                )
            )

        elif node.type == "call":
            function_node = node.child_by_field_name("function")
            if function_node is not None:
                calls.append(
                    CodeCall(
                        name=node_text(function_node),
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                    )
                )

        for child in node.children:
            visit(child)

    visit(root)
    return ParsedPythonFile(symbols=symbols, imports=imports, calls=calls)