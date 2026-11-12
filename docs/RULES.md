# Rule catalog (v0.4)

This project is an **offline heuristic** that flags patterns for human review. It is **not** a Groovy parser, a Jira API compatibility certificate, or a vulnerability scanner. The default severity indicates triage priority, not verified exploitability.

| Rule | Default | Category | Why review it | Typical action |
| --- | --- | --- | --- | --- |
| JSA001 | HIGH | Security | A credential-like variable receives a quoted literal | Confirm whether it is real, then use an approved secret/configuration source |
| JSA002 | MEDIUM | Performance | `Thread.sleep(...)` blocks the current worker | Consider a scheduler, async workflow or alternative coordination |
| JSA003 | LOW | Observability | `println(...)` bypasses common structured logs | Prefer the logger provided by the relevant ScriptRunner context |
| JSA004 | MEDIUM | Performance | A no-argument `getIssues()` may yield many issues | Confirm result size, permissions and paging |
| JSA005 | MEDIUM | Maintainability | SQL-style execution methods may touch a database | Verify supported APIs, transactions and query safety |
| JSA006 | LOW | Observability | Console printing and stack traces make logging hard to control | Use structured logging, avoid sensitive information |
| JSA007 | MEDIUM | Reliability | Direct HTTP construction merits timeout/TLS review | Inspect timeouts, exception handling and secure credentials |
| JSA008 | MEDIUM | Reliability | Broad exception catches can hide failures | Catch specific exceptions and handle failures explicitly |
| JSA009 | MEDIUM | Security | Process execution may be dangerous in shared environments | Avoid shell execution where possible; never pass untrusted inputs |
| JSA010 | LOW | Privacy | Debug logs can leak sensitive data or produce excessive logging | Review level, retention and payload contents |

## Suppressing an intentional finding

Only suppress after reviewing the issue. The directive applies to its own line, or to the next line when written as a standalone comment.

```groovy
// jsa-ignore JSA003
println("synthetic demo")
```

```groovy
println("synthetic demo") // jsa-ignore JSA003
```

You may also disable an entire rule from the browser UI or with `--disable JSA003` in the CLI.

## Important limitations

- The scanner uses regular expressions and a simple mask for quoted strings and comments. It is not a complete Groovy lexer/parser, and slashy or dollar-slashy strings and interpolation are incompletely understood.
- A finding might be safe in context; a missing finding never guarantees safety.
- The scanner does not authenticate to Jira or check your installed Jira, ScriptRunner, Java or app versions.
- It makes **no claims about deprecated or removed APIs** without version-scoped validation.
- Files are read locally; the browser application does not transmit code. Company policy may nevertheless prohibit use of unapproved external websites for source-code analysis.
- Synthetic demo credentials must never be replaced with live secrets in public commits.

## Export formats

- **JSON**: machine-readable findings and counts, no source snippets.
- **CSV**: spreadsheet-friendly list; exercise care when sharing file paths.
- **SARIF 2.1.0**: static analysis interchange format; produced reports are not automatically uploaded to GitHub code scanning.
- **HTML (browser and Python CLI)**: offline report with escaped output.

## Future validation

Before claiming production readiness, test with authorized diverse ScriptRunner scripts; document Jira and ScriptRunner release versions, validate rule precision/recall, and add integration/end-to-end testing.
