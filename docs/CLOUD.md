# Cloud-first analysis and migration assessment

Jira Script Analyzer performs **offline, heuristic analysis**. Its browser modes use no network calls and never execute uploaded source code. Exported reports contain locations and rule descriptions, **not source snippets, passwords or JSON configuration values**. File names may still be sensitive.

## Modes

| Mode | Input | What is checked | What is NOT checked |
| --- | --- | --- | --- |
| **Jira Cloud · ScriptRunner** | `.groovy`, `.js`, `.ts`, or pasted source | Some Data Center Java APIs, credentials, identity lookups, REST call review hints | Syntactic validity, runtime compatibility, account scopes, exhaustive Cloud APIs |
| **Jira Cloud · Automation** | Exported `.json` (up to 5 MB) | Review of outgoing requests, field IDs, owners/identities, disabled flows | Importability, true security posture, triggers' correctness, all schema versions |
| **Data Center → Cloud** | `.groovy` scripts | Java API and filesystem dependencies, legacy identities, ScriptRunner parity reminders | Automatic script translation, complete effort estimate or migration success |
| **Data Center Groovy** | `.groovy` scripts | Existing 11 Data Center rules, including optional Jira 10.4+ warning | Full Groovy parsing, runtime testing, Jira connection |

JSON automation export schemas vary. Recognized shapes include an array of rules, `{ "rules": [...] }`, `{ "flows": [...] }`, and an individual named rule. Unexpected formats fail with a clear error rather than falsely reporting a clean result. Automation locations are **rule ordinals**, not source-code line numbers.

## How to obtain Jira Cloud Automation JSON

Atlassian Cloud currently documents **Jira settings → System → Automation flows → More actions → Export flows**. Global administrators can export flows. Importing exports into another site can require remapping fields, work item types, statuses, projects and users; imported flows are initially disabled.

Official guide: https://support.atlassian.com/cloud-automation/docs/import-and-export-jira-automation-rules/

Never add raw automation exports from employer/client environments to public GitHub repositories. Browser inspection itself may require corporate approval.

## ScriptRunner Cloud language and migration differences

ScriptRunner Cloud supports **Groovy** for some scripting features such as Script Listeners, Scheduled Jobs and Scripted Fields, **JavaScript/TypeScript** for Behaviours and certain Fragments, and **Jira Expressions** for selected workflow conditions/validations. Jira Cloud scripts generally use REST APIs instead of in-process Jira Server/DC Java APIs. Some HAPI code may simplify porting, but parity depends on the feature and version.

Official docs:
- https://docs.adaptavist.com/sr4jc/latest/get-started/scripting-in-scriptrunner-for-jira-cloud/
- https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/
- https://www.scriptrunnerhq.com/help/migration/jiracheatsheet

## Migration workflow

1. Inventory Groovy script files and their real usage (listeners, scripted fields, jobs, conditions, behaviour scripts, etc).
2. Run **Data Center → Cloud** on authorized synthetic or approved source only.
3. Group findings by category: in-process Java APIs, filesystem/database dependencies, identities and feature-parity issues.
4. Verify alternatives and manual remediation in official documentation.
5. Test rewrites and validate app feature parity in a Cloud sandbox with appropriate approval.
6. Document unresolved work and estimate effort manually after discovery.

Effort levels (`HIGH`, `MEDIUM`, `UNKNOWN`) are **per-pattern triage indicators**, not total implementation hours, percentages of migratability, or objective risk scores.

## Scope and limitations

- No Jira API connections, credentials, server-side persistence, or paid services are required.
- Regular expression matching is not a Groovy, JavaScript or TypeScript parser and can yield false positives and missed findings.
- Exports deliberately omit source values; references contain documentation URLs only.
- Some cloud rule matches in strings are deliberately conservative and may create false positives.
- CSV and HTML outputs escape/neutralize common injection vectors, but downstream tools remain responsible for secure handling.
- Neither Cloud nor DC audit results are a substitute for expert review, production testing or Atlassian/Adaptavist certification.

See [VALIDATION.md](../VALIDATION.md) and [RULES.md](RULES.md).
