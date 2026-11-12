"""Offline heuristic checker for Jira ScriptRunner Groovy code (not a full parser)."""
from __future__ import annotations
import argparse
import html
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

SEVERITY = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "build", "target"}

@dataclass(frozen=True)
class Finding:
    file: str
    line: int
    column: int
    rule: str
    severity: str
    message: str

RULES = (
    ("JSA001", "HIGH", r"""\b(?:password|api[_-]?token|secret|accessToken)\s*=\s*(['"])(?:(?!\1).)+\1""", "Possible hard-coded credential", True),
    ("JSA002", "MEDIUM", r"\bThread\s*\.\s*sleep\s*\(", "Blocking Thread.sleep call", False),
    ("JSA003", "LOW", r"\bprintln\s*\(", "Prefer structured logging to println", False),
    ("JSA004", "MEDIUM", r"\bgetIssues\s*\(\s*\)", "Review unbounded issue retrieval", False),
    ("JSA005", "MEDIUM", r"\b(?:executeQuery|executeUpdate)\s*\(", "Review direct database access", False),
    ("JSA006", "LOW", r"\b(?:System\.out\.print(?:ln)?|printStackTrace)\s*\(", "Prefer application logger", False),
    ("JSA007", "MEDIUM", r"\b(?:URL|HttpURLConnection)\s*\(", "Review network calls and timeouts", False),
)

def mask_non_code(source: str) -> str:
    """Blank comments and basic Groovy strings while preserving character offsets."""
    out = list(source)
    i, n = 0, len(source)
    while i < n:
        if source.startswith("//", i):
            p = source.find("\n", i)
            j = n if p == -1 else p
        elif source.startswith("/*", i):
            p = source.find("*/", i + 2)
            j = n if p == -1 else p + 2
        elif source[i] in ("'", '"'):
            quote = source[i]
            delim = quote * (3 if source.startswith(quote * 3, i) else 1)
            j = i + len(delim)
            while j < n:
                if source[j] == "\\":
                    j += 2
                elif source.startswith(delim, j):
                    j += len(delim)
                    break
                else:
                    j += 1
            j = min(j, n)
        else:
            i += 1
            continue
        for k in range(i, j):
            if source[k] != "\n":
                out[k] = " "
        i = j
    return "".join(out)

def analyze(source: str, filename: str, disabled_rules: set[str] | None = None) -> list[Finding]:
    code = mask_non_code(source)
    findings = []
    for rule_id, severity, pattern, message, raw in RULES:
        if rule_id in (disabled_rules or set()):
            continue
        for match in re.finditer(pattern, source if raw else code, re.IGNORECASE):
            pos = match.start()
            if raw and not code[pos:pos + 1].strip():
                continue
            newline = source.rfind("\n", 0, pos)
            findings.append(Finding(filename, source.count("\n", 0, pos) + 1,
                                    pos - newline, rule_id, severity, message))
    return sorted(findings, key=lambda f: (f.file, f.line, f.column, f.rule))

def scan(path: Path, disabled_rules: set[str] | None = None) -> dict:
    path = path.resolve()
    if path.is_file():
        if path.suffix.lower() != ".groovy":
            raise ValueError("Expected a .groovy file")
        files = [path]
    elif path.is_dir():
        files = sorted(f for f in path.rglob("*") if f.is_file() and f.suffix.lower() == ".groovy"
                       and not any(p in SKIP_DIRS for p in f.relative_to(path).parts))
    else:
        raise ValueError(f"Path does not exist: {path}")
    findings = []
    for file in files:
        name = file.relative_to(path).as_posix() if path.is_dir() else file.name
        try:
            content = file.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError) as exc:
            raise ValueError(f"Cannot read {name}: {exc}") from exc
        findings.extend(asdict(f) for f in analyze(content, name, disabled_rules))
    return {"schema_version": 1, "files_scanned": len(files),
            "counts": {level: sum(f["severity"] == level for f in findings) for level in SEVERITY},
            "findings": findings}

def render_html(report: dict) -> str:
    rows = []
    for finding in report["findings"]:
        cells = (finding[key] for key in ("file", "line", "column", "rule", "severity", "message"))
        rows.append("<tr>" + "".join(f"<td>{html.escape(str(v))}</td>" for v in cells) + "</tr>")
    table = "\n".join(rows) or '<tr><td colspan="6">No findings</td></tr>'
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Jira Script Analyzer</title><style>'
            'body{font:16px system-ui,sans-serif;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#172b4d}'
            'table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.7rem;border-bottom:1px solid #ddd}'
            'th{background:#edf2fa}tr:hover{background:#f8fafc}</style></head><body>'
            '<h1>Jira Script Analyzer report</h1>'
            f'<p>Scanned {report["files_scanned"]} files; {len(report["findings"])} findings.</p>'
            '<p>Heuristic results only. Validate each finding manually.</p>'
            '<table><thead><tr><th>File</th><th>Line</th><th>Column</th><th>Rule</th>'
            '<th>Severity</th><th>Message</th></tr></thead><tbody>'
            + table + '</tbody></table></body></html>\n')

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Offline ScriptRunner Groovy source checks")
    parser.add_argument("path", type=Path)
    parser.add_argument("--format", choices=("json", "html"), default="json")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--disable", action="append", default=[], metavar="RULE_ID")
    parser.add_argument("--fail-on", choices=("none", "low", "medium", "high"), default="none")
    args = parser.parse_args(argv)
    unknown = set(args.disable) - {r[0] for r in RULES}
    if unknown:
        parser.error("Unknown rule(s): " + ", ".join(sorted(unknown)))
    try:
        report = scan(args.path, set(args.disable))
        rendered = render_html(report) if args.format == "html" else json.dumps(report, indent=2) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
    except (ValueError, OSError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2
    if args.fail_on != "none" and any(SEVERITY[f["severity"]] >= SEVERITY[args.fail_on.upper()]
                                     for f in report["findings"]):
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
