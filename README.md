# Jira Script Analyzer

[![Tests](https://github.com/giovadista/jira-script-analyzer/actions/workflows/tests.yml/badge.svg)](https://github.com/giovadista/jira-script-analyzer/actions/workflows/tests.yml)

An **offline, open-source, heuristic static analyzer** for Groovy scripts used in Jira ScriptRunner. This project is independent of Atlassian and Adaptavist.

> **Prototype warning:** This is not a full Groovy parser or security audit. It does not execute scripts or contact Jira. Findings are best-effort, and false positives or negatives are possible.

## Browser app (no installation)

The browser interface is in [docs/index.html](docs/index.html). It is a static application powered by `docs/engine.js`; your code is analyzed **locally in the browser**. No source code is transmitted to a server. There are no analytics or external JavaScript dependencies.

**GitHub Pages setup (repository owner):**
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch **main**, folder **/docs**, then **Save**.
4. When GitHub finishes publishing, open **https://giovadista.github.io/jira-script-analyzer/**.

Note: This Pages address will not work until Pages is enabled and the first deployment succeeds. Keep employer/client code out of the public repository. The browser app can process local files, but workplace policy still applies.

**Browser features:** paste Groovy; select up to 30 local `.groovy` files (1 MB each); enable/disable individual rules; filter and search findings; see rule-specific review guidance; export JSON, CSV or SARIF reports. For deliberate exceptions, add `// jsa-ignore JSA003` on the finding line or on a standalone comment line immediately before it. The browser and Python analyzers use independently implemented heuristic checks and may differ in edge cases.

**Browser engine tests:** GitHub Actions runs `npm test` with Node.js. Node is needed only to develop/test the browser engine outside GitHub; end users do not install anything.

## Requirements

Python 3.10 or newer; no third-party dependencies.

## Get started

```bash
python analyzer.py examples/demo.groovy
python analyzer.py examples --format html --output report.html
python -m unittest discover -s tests -v
```

Open the generated `report.html` in a browser. Pass a directory to recursively scan its `.groovy` files.

## Command-line usage

```bash
python analyzer.py /path/to/groovy --format json --output report.json
python analyzer.py /path/to/groovy --disable JSA003
python analyzer.py /path/to/groovy --format sarif --output report.sarif
python analyzer.py /path/to/groovy --format csv --output report.csv
python analyzer.py /path/to/groovy --fail-on high
```

Exit codes: `0` means scan completed without reaching the configured fail threshold; `1` means findings reached `--fail-on`; `2` means input or output error.

## Built-in rules

| Rule | Severity | Finding |
| --- | --- | --- |
| JSA001 | HIGH | Possible hard-coded credential |
| JSA002 | MEDIUM | Blocking `Thread.sleep` |
| JSA003 | LOW | `println` instead of structured logging |
| JSA004 | MEDIUM | Potentially unbounded `getIssues()` |
| JSA005 | MEDIUM | Review SQL `executeQuery` / `executeUpdate` |
| JSA006 | LOW | `System.out` / `printStackTrace` |
| JSA007 | MEDIUM | Direct `URL` / `HttpURLConnection` |
| JSA008 | MEDIUM | Broad `catch (Exception/Throwable)` |
| JSA009 | MEDIUM | Process execution through Runtime/ProcessBuilder |
| JSA010 | LOW | Potentially sensitive debug logging |

See [Rule catalog](docs/RULES.md) for explanations, remediation ideas and limitations. Rules are **review hints**, not proofs of security vulnerabilities or API obsolescence. JavaScript and Python implementations are similar but may differ on edge cases.

## Output

JSON reports include schema version, counts, paths, positions and findings, but never source snippets. CSV is suitable for spreadsheets; SARIF 2.1.0 is available for code-scanning tooling; the Python CLI also generates standalone HTML. Source text is not embedded in the exported reports.

Directory scans exclude typical build and tool directories: `.git`, `.venv`, `venv`, `node_modules`, `build`, `target`.

## Roadmap

- Improve tokenization for Groovy slashy/dollar-slashy literals and GString interpolation
- Add configurable severities, baseline comparison and ignore patterns
- Add documented, version-scoped Jira and ScriptRunner API checks using official references
- Add larger synthetic fixture packs and browser end-to-end tests
- Establish release tags, regular maintenance, and real-world validation with authorized scripts

## Privacy and responsible use

Upload only source code you own or have explicit permission to release. **Never commit client/employer scripts, customer information or real credentials.** Example scripts are synthetic. Scanning is local-only and does not transmit source code.

## Development and CI

Run `python -m unittest discover -s tests -v`. GitHub Actions runs tests on Python 3.10, 3.12 and 3.13 after pushes and pull requests. Issues and constructive pull requests are welcome.

## Project maturity and Alignerr applications

This is a newly created **v0.4 working prototype** with a roadmap. It has not yet demonstrated a substantial ongoing development history. Any external application must accurately describe its actual maturity, ownership, and the author's hands-on role.

## License

MIT. See [LICENSE](LICENSE).
