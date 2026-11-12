# Cloud-first release acceptance checklist

This release introduces experimental Jira Cloud ScriptRunner analysis, Automation export assessment and Data Center → Cloud migration inventory. It does **not** claim full compatibility coverage.

## Browser smoke checks

1. Open the published GitHub Pages URL and refresh fully.
2. Default Cloud ScriptRunner: click **Load example** and **Run assessment**. Expect CLD001 for the DC-only import, plus review findings as applicable.
3. Switch to Cloud Automation: load JSON example, run. Expect several AUT findings, not an empty success.
4. Switch to DC → Cloud: use example. Expect MIG001 and MIG002.
5. Switch to Data Center: load example and expect the original 4 findings.
6. Confirm CSV, HTML, JSON, SARIF exports contain no input source text.
7. Test an unrelated JSON object (`{"x":1}`); expect an error instead of zero findings.
8. Confirm hidden controls change with analysis mode, and try mobile viewport.

## CI

Browser tests cover Cloud scripting patterns, safe/clean inputs, malformed/oversized JSON, automation export structure, migration indicators, and shared export compatibility. Existing Data Center Python and browser suites remain active.

## Remaining technical risks

- Source checks are regex-based, not complete language parsers.
- Automation export schemas are not exhaustively supported or validated against real site exports.
- No verified end-to-end browser automation.
- No full ScriptRunner feature parity mapping or migration estimates.
- No production security certification or permissioned enterprise dataset testing.

Do not upload confidential scripts, credentials, identifiable customer details or unapproved company material to this public repository.
