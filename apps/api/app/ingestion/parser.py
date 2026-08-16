from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CodeSymbol:
    name: str
    kind: str  # "class", "function", "interface", "struct", "type", "module"
    start_line: int
    end_line: int
    bases: list[str] | None = None


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
class ParsedFile:
    symbols: list[CodeSymbol]
    imports: list[CodeImport]
    calls: list[CodeCall]


# Alias for backward compatibility
ParsedPythonFile = ParsedFile


def _parse_python(source_text: str, file_path: Path) -> ParsedFile:
    # 1. Try tree-sitter if installed
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_python

        parser = Parser()
        parser.language = Language(tree_sitter_python.language())
        source_bytes = source_text.encode("utf-8")
        tree = parser.parse(source_bytes)
        root = tree.root_node

        symbols: list[CodeSymbol] = []
        imports: list[CodeImport] = []
        calls: list[CodeCall] = []

        def node_text(node) -> str:
            return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

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
                super_node = node.child_by_field_name("superclasses")
                bases: list[str] | None = None
                if super_node is not None:
                    raw_bases = node_text(super_node).strip("()")
                    if raw_bases:
                        bases = [b.strip() for b in raw_bases.split(",") if b.strip()]
                if name_node is not None:
                    symbols.append(
                        CodeSymbol(
                            name=node_text(name_node),
                            kind="class",
                            start_line=node.start_point[0] + 1,
                            end_line=node.end_point[0] + 1,
                            bases=bases,
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
                fn_node = node.child_by_field_name("function")
                if fn_node is not None:
                    calls.append(
                        CodeCall(
                            name=node_text(fn_node),
                            start_line=node.start_point[0] + 1,
                            end_line=node.end_point[0] + 1,
                        )
                    )

            for child in node.children:
                visit(child)

        visit(root)
        return ParsedFile(symbols=symbols, imports=imports, calls=calls)
    except Exception:
        pass

    # 2. Pure Python Robust Fallback Parser
    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    lines = source_text.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Class with optional inheritance: class Child(Base, Other):
        class_match = re.search(r"class\s+([A-Za-z0-9_]+)(?:\s*\(([^)]*)\))?", stripped)
        if class_match:
            name, raw_bases = class_match.group(1), class_match.group(2)
            bases = [b.strip() for b in raw_bases.split(",") if b.strip()] if raw_bases else None
            symbols.append(CodeSymbol(name=name, kind="class", start_line=idx, end_line=idx, bases=bases))
            continue

        # Function: def my_func():
        fn_match = re.search(r"def\s+([A-Za-z0-9_]+)\s*\(", stripped)
        if fn_match:
            symbols.append(CodeSymbol(name=fn_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        # Imports: import os, from math import sqrt
        if stripped.startswith("import ") or stripped.startswith("from "):
            imports.append(CodeImport(name=stripped, start_line=idx, end_line=idx))
            continue

        # Function calls: print(...), os.getcwd(...), sqrt(...)
        for call_match in re.finditer(r"\b([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*\(", stripped):
            call_name = call_match.group(1)
            if call_name not in {"if", "for", "while", "with", "elif", "return", "def", "class", "import", "from", "except"}:
                calls.append(CodeCall(name=call_name, start_line=idx, end_line=idx))

    return ParsedFile(symbols=symbols, imports=imports, calls=calls)


def _parse_js_ts(source_text: str) -> ParsedFile:
    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    lines = source_text.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Class match: class Foo extends Bar
        class_match = re.search(r"class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$]+))?", stripped)
        if class_match:
            name = class_match.group(1)
            base = [class_match.group(2)] if class_match.group(2) else None
            symbols.append(CodeSymbol(name=name, kind="class", start_line=idx, end_line=idx, bases=base))
            continue

        # Interface / Type match
        interface_match = re.search(r"(?:interface|type)\s+([A-Za-z0-9_$]+)", stripped)
        if interface_match:
            name = interface_match.group(1)
            symbols.append(CodeSymbol(name=name, kind="interface", start_line=idx, end_line=idx))
            continue

        # Function match: function foo(), const foo = () =>, export function foo()
        fn_match = re.search(r"(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)", stripped)
        if fn_match:
            symbols.append(CodeSymbol(name=fn_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        arrow_match = re.search(r"(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>", stripped)
        if arrow_match:
            symbols.append(CodeSymbol(name=arrow_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        # Import match: import { foo } from 'bar', const foo = require('bar')
        if stripped.startswith("import ") or "require(" in stripped:
            imports.append(CodeImport(name=stripped[:120], start_line=idx, end_line=idx))
            continue

        # Call match: foo()
        for call_match in re.finditer(r"\b([A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*)\s*\(", stripped):
            name = call_match.group(1)
            if name not in {"if", "for", "while", "switch", "catch", "function", "import", "require", "return"}:
                calls.append(CodeCall(name=name, start_line=idx, end_line=idx))

    return ParsedFile(symbols=symbols, imports=imports, calls=calls)


def _parse_go(source_text: str) -> ParsedFile:
    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    lines = source_text.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        type_match = re.search(r"type\s+([A-Za-z0-9_]+)\s+(struct|interface)", stripped)
        if type_match:
            name, kind = type_match.group(1), type_match.group(2)
            symbols.append(CodeSymbol(name=name, kind="class" if kind == "struct" else "interface", start_line=idx, end_line=idx))
            continue

        fn_match = re.search(r"func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(", stripped)
        if fn_match:
            symbols.append(CodeSymbol(name=fn_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        if stripped.startswith("import ") or (stripped.startswith('"') and idx < 30):
            imports.append(CodeImport(name=stripped, start_line=idx, end_line=idx))

    return ParsedFile(symbols=symbols, imports=imports, calls=calls)


def _parse_rust(source_text: str) -> ParsedFile:
    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    lines = source_text.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()

        struct_match = re.search(r"(?:pub\s+)?(struct|enum|trait)\s+([A-Za-z0-9_]+)", stripped)
        if struct_match:
            kind, name = struct_match.group(1), struct_match.group(2)
            symbols.append(CodeSymbol(name=name, kind="class" if kind == "struct" else "interface", start_line=idx, end_line=idx))
            continue

        impl_match = re.search(r"impl(?:\s+([A-Za-z0-9_]+)\s+for)?\s+([A-Za-z0-9_]+)", stripped)
        if impl_match:
            trait_name, struct_name = impl_match.group(1), impl_match.group(2)
            bases = [trait_name] if trait_name else None
            symbols.append(CodeSymbol(name=struct_name, kind="class", start_line=idx, end_line=idx, bases=bases))
            continue

        fn_match = re.search(r"(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)\s*\(", stripped)
        if fn_match:
            symbols.append(CodeSymbol(name=fn_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        if stripped.startswith("use "):
            imports.append(CodeImport(name=stripped, start_line=idx, end_line=idx))

    return ParsedFile(symbols=symbols, imports=imports, calls=calls)


def _parse_generic_code(source_text: str, lang: str = "generic") -> ParsedFile:
    symbols: list[CodeSymbol] = []
    imports: list[CodeImport] = []
    calls: list[CodeCall] = []

    lines = source_text.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue

        class_match = re.search(r"\bclass\s+([A-Za-z0-9_]+)", stripped)
        if class_match:
            symbols.append(CodeSymbol(name=class_match.group(1), kind="class", start_line=idx, end_line=idx))
            continue

        fn_match = re.search(r"\b(?:def|fn|func|function|sub)\s+([A-Za-z0-9_]+)", stripped)
        if fn_match:
            symbols.append(CodeSymbol(name=fn_match.group(1), kind="function", start_line=idx, end_line=idx))
            continue

        if stripped.startswith(("# ", "## ")):
            header = stripped.lstrip("#").strip()
            symbols.append(CodeSymbol(name=header, kind="module", start_line=idx, end_line=idx))
            continue

        if stripped.startswith(("import ", "from ", "require(", "include ", "use ", "using ")):
            imports.append(CodeImport(name=stripped[:100], start_line=idx, end_line=idx))

    return ParsedFile(symbols=symbols, imports=imports, calls=calls)


def parse_file(file_path: Path) -> ParsedFile:
    try:
        source_text = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ParsedFile(symbols=[], imports=[], calls=[])

    ext = file_path.suffix.lower()

    if ext in {".py", ".pyw"}:
        return _parse_python(source_text, file_path)
    elif ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte"}:
        return _parse_js_ts(source_text)
    elif ext == ".go":
        return _parse_go(source_text)
    elif ext == ".rs":
        return _parse_rust(source_text)
    else:
        return _parse_generic_code(source_text, lang=ext.lstrip("."))


# Backward compatibility alias
def parse_python_file(file_path: Path) -> ParsedFile:
    return parse_file(file_path)