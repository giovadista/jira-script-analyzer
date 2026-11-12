# Script converter beta acceptance checklist

- Run `npm test` and all Python tests on GitHub Actions.
- Confirm an isolated `ComponentAccessor.getIssueManager().getIssueByCurrentKey("TEST-123")` statement produces an **unverified REST v3 candidate**.
- Confirm multi-statement scripts, dynamic issue keys and unsupported execution contexts produce **manual-review-required** output.
- Confirm source values and secret strings do not appear in the generated manual-review output.
- Confirm the original source is unchanged.
- Verify the browser converter panel displays the candidate and its documentation links.
- Confirm legacy four analysis modes still function.
- Manually validate any generated candidate in an approved ScriptRunner Cloud sandbox before claiming executable compatibility.

**Release limitation:** This converter handles only a narrowly scoped static issue lookup. It is not a general DC script translator.
