# Listener Migration Workbench — release validation

Scope: structural inventory, exact line ranges, restricted Cloud REST candidate snippets,
non-executable Groovy blueprint, detailed Markdown TODOs and source-line navigation.

Acceptance:
- [ ] GitHub Actions JavaScript and Python tests all pass.
- [ ] Browser syntax checks cover groovy-structure.js and listener-workbench.js.
- [ ] A synthetic 100+ line listener produces an inventory and exact line references.
- [ ] Unrecognized and mutation operations remain explicit manual tasks.
- [ ] Generated blueprint is all comments and cannot execute side effects.
- [ ] Secret values are not copied to generated plans.
- [ ] Browser selects source lines and downloads Markdown, JSON and blueprint.

Not yet validated: full Groovy language grammar, live ScriptRunner Cloud execution,
real client scripts, Cloud app version-specific parity, and cross-browser end-to-end testing.
