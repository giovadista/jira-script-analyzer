"""Small, offline, rule-based Groovy source scanner (not a Groovy parser)."""
import argparse
import json
import re
from pathlib import Path

RULES = [
    ("JSA001", "HIGH", r'(?i)\b(password|api[_-]?token|secret)\s*=\s*[\'\"][^\'\"]+[\'\"]', "Possible hard-coded credential"),
    ("JSA002", "MEDIUM", r'(?m)^\s*Thread\.sleep\s*\(', "Blocking sleep call"),
    ("JSA003", "LOW", r'(?m)\bprintln\s*\(', "Console printing; consider structured logging"),
    ("JSA004", "MEDIUM", r'(?m)\bgetIssues\s*\(\s*\)', "Review unbounded issue retrieval"),
]


def analyze(text: str, filename: str) -> list[dict]:
    findings = []
    for rule_id, severity, pattern, message in RULES:
        for match in re.finditer(pattern, text):
            findings.append({"file": filename, "line": text.count("\n", 0, match.start()) + 1,
                             "rule": rule_id, "severity": severity, "message": message})
    return sorted(findings, key=lambda f: (f["line"], f["rule"]))


def scan(path: Path) -> dict:
    files = sorted(path.rglob("*.groovy")) if path.is_dir() else [path]
    findings = []
    for file in files:
        if file.suffix != ".groovy":
            continue
        findings.extend(analyze(file.read_text(encoding="utf-8"), str(file)))
    return {"files_scanned": sum(f.suffix == ".groovy" for f in files), "findings": findings}


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline Groovy source checks for Jira ScriptRunner")
    parser.add_argument("path", type=Path, help="Groovy file or directory")
    parser.add_argument("--output", type=Path, help="Optional JSON report destination")
    args = parser.parse_args()
    if not args.path.exists():
        parser.error(f"Path does not exist: {args.path}")
    report = scan(args.path)
    output = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    else:
        print(output)


if __name__ == "__main__":
    main()
