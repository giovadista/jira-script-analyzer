# Jira Script Analyzer

An early-stage, offline proof of concept for rule-based checks of Groovy scripts used with Jira ScriptRunner. **This is not a Groovy parser or a full security scanner.** Findings are heuristic and may include false positives or miss issues.

## Requirements

Python 3.10+; no third-party dependencies.

## Run

```bash
python analyzer.py examples/demo.groovy
python analyzer.py examples --output report.json
python -m unittest discover -s tests -v
```

## Current rules

- `JSA001`: possible hard-coded credentials
- `JSA002`: blocking `Thread.sleep`
- `JSA003`: `println` instead of structured logging
- `JSA004`: review unbounded `getIssues()` calls

## Roadmap

- Ignore comments and string literals where appropriate
- Configurable rule severity and suppressions
- HTML reports and CI integration
- Jira-specific API compatibility rules validated against official docs
- Larger synthetic test fixture set

## Privacy and ownership

Only upload code you own or have explicit permission to publish. Never upload production scripts, tokens, customer information, or company-confidential material.

## Status

Starter prototype. Not yet a substantial project for a job application requiring an actively maintained GitHub repository.
