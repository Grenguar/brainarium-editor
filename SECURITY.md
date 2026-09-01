# Security policy

## Supported versions

Security fixes are provided for the latest release on `main`. Older releases
are not supported unless a release note says otherwise.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or include
private vault content, credentials, or local paths in a report.

Use GitHub's private vulnerability reporting for this repository. Include a
clear reproduction using synthetic data, the affected version, the security
impact, and any suggested mitigation. If private reporting is unavailable,
contact the repository owner through their GitHub profile and request a secure
reporting channel.

We will acknowledge a valid report within 7 days, assess its impact, and work
with the reporter on coordinated disclosure. Please allow time for a fix before
disclosing details publicly.

## Scope

Brainarium is a local-first Electron application and optional local stdio MCP
server. Reports involving vault-boundary escapes, unsafe renderer privileges,
unvalidated IPC, source modification without review, unsafe link handling, or
MCP capability escalation are in scope.
