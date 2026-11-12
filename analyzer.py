"""Offline heuristic Groovy checks for Jira ScriptRunner. Not a full Groovy parser."""
from __future__ import annotations

import argparse
import csv
import html
import io
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

VERSION = "0.4.0"
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


# Tuple: id, severity, regex, message, match original source (for literals).
RULES = (
    ("JSA001", "HIGH", r"""\b(?:password|api[_-]?token|secret|accessToken|clientSecret|privateKey)\s*=\s*(['"])(?:\\.|(?!\1)[^\r\n\\])+\1""", "Possible hard-coded credential", True),
    ("JSA002", "MEDIUM", r"\bThread\s*\.\s*sleep\s*\(", "Blocking Thread.sleep call", False),
    ("JSA003", "LOW", r"\bprintln\s*\(", "Prefer structured logging to println", False),
    ("JSA004", "MEDIUM", r"\bgetIssues\s*\(\s*\)", "Review unbounded issue retrieval", False),
    ("JSA005", "MEDIUM", r"\b(?:executeQuery|executeUpdate)\s*\(", "Review direct database operations", False),
    ("JSA006", "LOW", r"\b(?:System\s*\.\s*out\s*\.\s*print(?:ln)?|printStackTrace)\s*\(", "Prefer application logger", False),
    ("JSA007", "MEDIUM", r"\b(?:URL|HttpURLConnection)\s*\(", "Review network calls and timeouts", False),
    ("JSA008", "MEDIUM", r"\bcatch\s*\(\s*(?:Exception|Throwable)\s+\w+\s*\)", "Broad exception catch", False),
    ("JSA009", "MEDIUM", r"\b(?:Runtime\s*\.\s*getRuntime\s*\(\s*\)\s*\.\s*exec|ProcessBuilder)\s*\(", "Process execution", False),
    ("JSA010", "LOW", r"\b(?:log|logger)\s*\.\s*debug\s*\(", "Potential debug output", False),
)


def mask_non_code(source: str) -> str:
    """Blank comments and basic quoted strings, preserving offsets and newline positions."""
    out = list(source)
    i, n = 0, len(source)
    while i < n:
        start = i
        if source.startswith("//", i):
            j = source.find("\n", i)
            i = n if j < 0 else j
        elif source.startswith("/*", i):
            depth = 1
            i += 2
            while i < n and depth:
                if source.startswith("/*", i):
                    depth += 1
                    i += 2
                elif source.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
        elif source[i] in ("'", '"'):
            quote = source[i]
            delimiter = quote * (3 if source.startswith(quote * 3, i) else 1)
            i += len(delimiter)
            while i < n:
                if source[i] == "\\":
                    i = min(n, i + 2)
                elif source.startswith(delimiter, i):
                    i += len(delimiter)
                    break
                else:
                    i += 1
        else:
            i += 1
            continue
        for p in range(start, i):
            if source[p] not in "\r\n":
                out[p] = " "
    return "".join(out)


def _suppressed(lines: list[str], rule_id: str, line: int) -> bool:
    directive = re.compile(r"//\s*jsa-ignore\s+" + re.escape(rule_id) + r"\b", re.I)
    current = lines[line - 1]
    previous = lines[line - 2] if line > 1 else ""
    return bool(directive.search(current) or
                (re.match(r"^\s*//", previous) and directive.search(previous)))


def analyze(source: str, filename: str, disabled_rules: set[str] | None = None) -> list[Finding]:
    code = mask_non_code(source)
    lines = source.splitlines() or [""]
    findings = []
    for rule_id, severity, pattern, message, raw in RULES:
        if rule_id in (disabled_rules or set()):
            continue
        for match in re.finditer(pattern, source if raw else code, re.I):
            pos = match.start()
            if raw and code[pos:pos + 1] == " ":
                continue
            line = source.count("\n", 0, pos) + 1
            if _suppressed(lines, rule_id, line):
                continue
            newline = source.rfind("\n", 0, pos)
            findings.append(Finding(filename, line, pos - newline, rule_id, severity, message))
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
    return {"schema_version": 2, "engine": "python", "engine_version": VERSION,
            "files_scanned": len(files),
            "counts": {level: sum(f["severity"] == level for f in findings) for level in SEVERITY},
            "findings": findings}


def to_sarif(report: dict) -> dict:
    levels = {"HIGH": "error", "MEDIUM": "warning", "LOW": "note"}
    return {"version": "2.1.0", "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
            "runs": [{"tool": {"driver": {
                "name": "Jira Script Analyzer", "version": VERSION,
                "informationUri": "https://github.com/giovadista/jira-script-analyzer",
                "rules": [{"id": rid, "shortDescription": {"text": message}}
                          for rid, _, _, message, _ in RULES]}},
                "results": [{"ruleId": f["rule"], "level": levels[f["severity"]],
                             "message": {"text": f["message"]},
                             "locations": [{"physicalLocation": {
                                 "artifactLocation": {"uri": f["file"]},
                                 "region": {"startLine": f["line"], "startColumn": f["column"]}}}]}
                            for f in report["findings"]]}]}


def to_csv(report: dict) -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    fields = ("file", "line", "column", "rule", "severity", "message")
    writer.writerow(fields)
    writer.writerows([finding.get(field, "") for field in fields] for finding in report["findings"])
    return output.getvalue()


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
    parser.add_argument("--format", choices=("json", "html", "csv", "sarif"), default="json")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--disable", action="append", default=[], metavar="RULE_ID")
    parser.add_argument("--fail-on", choices=("none", "low", "medium", "high"), default="none")
    args = parser.parse_args(argv)
    unknown = set(args.disable) - {r[0] for r in RULES}
    if unknown:
        parser.error("Unknown rule(s): " + ", ".join(sorted(unknown)))
    try:
        report = scan(args.path, set(args.disable))
        if args.format == "html":
            rendered = render_html(report)
        elif args.format == "csv":
            rendered = to_csv(report)
        else:
            rendered = json.dumps(to_sarif(report) if args.format == "sarif" else report, indent=2) + "\n"
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
