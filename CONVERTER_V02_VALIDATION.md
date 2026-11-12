# Converter v0.2 validation

The conversion engine produces only **read-only** Cloud candidates for exact, recognized Jira DC issue lookups and a single supported issue accessor. It cannot certify compatibility.

Checks:
- Existing lookup recipe remains functional
- Summary, issue key, status name and project key map to Cloud REST response fields
- Unsupported mutations are explicitly refused with categorized review guidance
- Scripts with arbitrary extra operations or imports are not converted
- No raw input or secret literal leaks into unsupported reports
- No Jira site connection, execution or source upload occurs
- GitHub Actions JavaScript and Python suites are green

Further validation requires an authorized Jira Cloud sandbox and a suitable ScriptRunner Cloud execution context.
