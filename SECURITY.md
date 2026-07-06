# Security Policy

## Supported Versions

The `main` branch is the supported development line.

## Reporting a Vulnerability

Please do not publish exploit details in a public issue. Use GitHub private vulnerability reporting if it is enabled on the repository, or contact the repository owner directly.

When reporting, include:

- Affected route, script, or component
- Steps to reproduce
- Expected and actual impact
- Any relevant logs with secrets removed

## Secret Handling

AetherForge must run safely without credentials. Keep API keys in `.env.local` or deployment secrets only. Do not commit local OAuth token files, `.aetherforge/`, scratch evidence, or generated build outputs.
