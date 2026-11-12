# Contributing

Thanks for your interest! This is an independent early-stage project.

## Development

- Browser UI: `docs/index.html`, `docs/app.js`, `docs/style.css`
- Browser rule engine: `docs/engine.js`
- Python CLI: `analyzer.py`
- Browser unit tests: `npm test` (Node.js 20+)
- Python unit tests: `python -m unittest discover -s tests -v`

GitHub Actions runs both test suites without requiring local installation for end users.

## Proposing a rule

Open an issue describing a **synthetic** positive and negative example, the relevant Jira/ScriptRunner version if applicable, why the pattern matters and any official sources. Add tests in both engines when applicable. Rules should produce minimal false positives and must not report raw passwords, tokens or script source snippets.

Do not submit confidential employer or customer scripts. Never include live credentials, personal data, proprietary exports or production URLs in issues or commits.

## Pull request checks

Include tests, documentation, a clear scope and an explanation of known limitations. A successful CI run alone does not imply production readiness.
