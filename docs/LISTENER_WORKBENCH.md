# Listener Migration Workbench — Data Center → Jira Cloud

The **Listener Migration Workbench** analyzes Groovy Data Center listeners of hundreds of lines in the browser. It creates a line-mapped **migration plan** instead of falsely claiming to compile/convert arbitrary Groovy into an executable ScriptRunner Cloud listener.

## How to use

1. Open the static web app. Choose **Data Center → Cloud · Listener Workbench**.
2. Paste an **authorized** Data Center Groovy listener or choose one local \`.groovy\` file (1 MB maximum).
3. Choose **Load example** to test with synthetic code, then click **Run assessment**.
4. Read the count of Cloud candidates, manual tasks, control-flow segments and DC dependencies.
5. Click an entry's **DC line** button to jump to its source statement.
6. Download the **Markdown assessment**, **JSON source map** or **comment-only Groovy blueprint**.
7. Rebuild the original listener's behavior in a **new** Cloud listener and verify all acceptance gates in a permitted sandbox.

The exported Groovy blueprint is **entirely commented out**. It cannot be deployed as a converted listener. This is intentional: an incomplete migration must never silently execute partial side effects.

## How the analysis works

A dependency-free tokenizer recognizes ordinary Groovy quoted strings (including triple-quoted forms), comments, nested block comments, dollar-slashy literals, and slashy literals in some unambiguous contexts. It preserves original line and byte offsets. A structural segmenter groups statements, control-flow headers and closures, then classifies known dependencies. This is **not a full Groovy AST**: complex GStrings, interpolation, slashy ambiguity, generic type parsing and chained/multiline DSL syntax may be misidentified. Review all results.

| Disposition | Meaning |
| --- | --- |
| Candidate | A narrowly recognized, read-only Cloud REST/map-field mapping is suggested; it is **unverified** |
| Template | A non-equivalent suggestion, e.g. use Cloud \`logger\`; source messages are not copied |
| Remove | A DC import or manager binding which must be eliminated **only after dependent behavior is migrated** |
| Structural | Control flow, closures and guards needing semantic preservation |
| Manual | Unknown script logic or an operation requiring a contextual rewrite |

Examples of recognized patterns include isolated issue lookups with static keys and simple read-only issue field accessors if their variable derives from a recognized lookup. Every other operation remains an explicit task: issue updates, custom fields, REST/ADF comments, workflow transitions, JQL/pagination, identity, event payloads, Java APIs, direct DB/filesystem/process access, network calls, and secrets.

## Important Cloud listener differences

- Jira DC custom listeners have a JVM event object; ScriptRunner Cloud Script Listeners use webhook/Forge event contexts. Trigger setup and Jira Expression condition are configured **separately** from the Groovy script.
- Cloud context values may have changed as events migrate from Connect to Forge. Adaptavist warns that reading some event properties may trigger API calls or fail due to rate limiting.
- Select the **ScriptRunner Add-on User or Current User** execution context and verify permissions. Never assume a DC listener's user/session context survives migration.
- Editing issues may generate further update webhooks; review idempotency, loops and duplicate side effects.
- Cloud REST API v3 supports different issue field shapes, especially ADF for description, multiline text and comments.
- No automatic porting of arbitrary \`ComponentAccessor\`, \`IssueManager\`, \`SearchService\`, \`CommentManager\`, custom field or workflow calls.

## Security

No source code is uploaded by this static app. **Do not put confidential company/customer code into this public GitHub repository or use the website if your employer prohibits it.** Downloaded blueprints can contain static issue keys and variable names; treat them according to your organization's data classification rules. Generated report metadata is not a substitute for a data protection review.

## Release and acceptance checks

- Unit tests cover tokenization, malformed source, nested blocks, slashy literals, hundred-line listeners, exact line mapping, confidential string omission, non-executable blueprints and unknown operation fallback.
- Browser interaction and syntax are tested in CI only at the JavaScript syntax/unit level; full cross-browser interactive tests remain a future release gate.
- A sandbox run against your exact ScriptRunner Cloud deployment is **required** for functional certification.

## Authoritative references

- [Adaptavist — Rewrite Scripts for Cloud Hints and Tips](https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/rewrite-scripts-for-cloud-hints-and-tips/)
- [Adaptavist — Script Listeners Cloud](https://docs.adaptavist.com/sr4jc/latest/features/script-listeners/)
- [Adaptavist — Forge event behavior changes](https://docs.adaptavist.com/sr4jc/latest/features/script-listeners/concept-8zac6ru5/)
- [Atlassian — Jira Cloud Issue REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
- [Atlassian — Cloud REST rate limiting](https://developer.atlassian.com/cloud/jira/platform/rate-limiting/)
- [Atlassian — ScriptRunner migration overview](https://support.atlassian.com/migration/docs/scriptrunner-for-jira/)
