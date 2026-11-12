# Data Center → Cloud Script Converter (experimental)

The browser app includes **Data Center → Cloud · Script converter (beta)**. It is a **conservative, offline migration assistant**, not a general Groovy-to-Groovy compiler. It never sends source to a server or executes the input.

## What it currently converts

An isolated single-line Data Center issue lookup using:

```groovy
import com.atlassian.jira.component.ComponentAccessor
def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("TEST-123")
```

When used in the Script Console or Scheduled Job context, the converter produces a **Cloud REST API v3 candidate** resembling:

```groovy
def response = get("/rest/api/3/issue/TEST-123").asObject(Map)
if (response.status != 200) {
    throw new IllegalStateException("Issue lookup failed: HTTP " + response.status)
}
def issue = response.body
```

This is **not semantically identical**: the Data Center return value is an Issue object whereas the Cloud response body is a Map. A script that uses getters, setters, persistence or subsequent statements needs a full rewrite. Cloud permissions, authentication, scopes, execution context and response processing must be tested in a permitted Cloud sandbox.

The tool also recognizes an isolated `Issues.getByKey("TEST-123")` HAPI lookup and **retains it as a verification candidate**, rather than claiming full API parity.

## What it deliberately refuses

Any script with multiple statements beyond the supported import and isolated lookup, dynamic issue keys, listeners, scripted fields, workflow extensions, Behaviours or unrecognized APIs receives a **manual-conversion-required** response, not guessed executable code.

The converter accepts a single input script (1 MB maximum). It provides proposed source, a migration assessment, notices and links to relevant documentation. It does **not** change the original script, deploy anything or call Jira Cloud.

## Safety

Avoid submitting real credentials or company/client source without authorization, even though processing occurs locally. The generated candidate must be reviewed by a qualified engineer. A successful code-generation step is not proof of Cloud compatibility.

## Future work

- More safe, strictly validated recipe patterns for field reads, comments and search
- Multi-statement control-flow-aware analysis with a proper Groovy parser
- Context-specific rewrite templates (listeners, jobs, scripted fields)
- Source-to-source mapping with explicit unsupported nodes
- Test fixtures for ScriptRunner Cloud and user-approved sandbox validation
- Optional interactive AI guidance only with explicit consent and disclosure of code transfer

## Official documentation

- [Adaptavist rewrite hints and tips](https://docs.adaptavist.com/sr4js/latest/scriptrunner-migration/scriptrunner-migration-to-cloud/rewrite-scripts-for-cloud-hints-and-tips/)
- [Atlassian Jira Cloud issue REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/)
