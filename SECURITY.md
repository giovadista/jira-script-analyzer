# Security and privacy

This application performs best-effort static analysis of local text in the user's browser. No source-code upload endpoint, server-side analysis, analytics or external JavaScript dependencies are intentionally included in the static application. Review the deployed website and your organization's policies before using it with any sensitive material.

**Do not enter real passwords, tokens, production configuration, client information, or employer-owned source unless your employer explicitly permits this use.** Do not publish sensitive examples in this public GitHub repository.

The application is not a security scanner and cannot establish that a script is safe. Reports deliberately omit source snippets but may contain filenames; treat those as potentially sensitive.

For privately reporting a potential vulnerability, use GitHub's repository security advisory feature if enabled; otherwise contact the maintainer through a private channel. Do not publish exploit details or sensitive information in a public issue.

Current constraints: no full Groovy parser, no dependency analysis, no runtime execution, no Jira authentication, no CVE/version mapping, and no guaranteed detection.
