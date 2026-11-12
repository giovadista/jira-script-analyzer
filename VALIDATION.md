# Validation checklist

Version 0.5 is an independently implemented, heuristic analyzer. Check each item before claiming production readiness.

## Automated checks

- Python unit tests on 3.10, 3.12 and 3.13 (GitHub Actions)
- Browser JavaScript unit tests on Node.js 22 (GitHub Actions)
- JavaScript syntax verification
- Sample HTML report generation
- Negative cases for comments, quoted strings and suppression markers
- CSV formula injection and HTML escaping checks
- Version-scoped Jira DC 10.4 SearchProvider detection

## Manual browser smoke test

1. Open the published GitHub Pages application.
2. Click **Load example** then **Analyze script**. Expect 4 findings (1 HIGH, 2 MEDIUM, 1 LOW).
3. Filter by severity and search by rule ID (e.g., `JSA002`).
4. Export JSON, HTML, CSV and SARIF and verify files contain results but no source code.
5. Choose Jira DC 10.4–10.x, paste `import com.atlassian.jira.issue.search.SearchProvider` and run. Expect JSA011.
6. Choose Jira 10.3 or earlier and rerun. JSA011 should not appear.
7. Test both suppression styles documented in `docs/RULES.md`.
8. Test with a clean synthetic example; expect no findings.
9. On a narrow browser viewport verify all controls remain accessible.

## Release gates not yet achieved

- Browser end-to-end UI automation and cross-browser test matrix
- Validated Jira/ScriptRunner compatibility beyond the single documented Jira 10.4+ warning
- High-volume benchmark and fuzz testing for malformed Groovy
- Professional security review and documented false-positive/false-negative measurements
- Observed sustained maintenance over time

**Do not upload client/company scripts, credentials, or sensitive reports into this public repository.**
