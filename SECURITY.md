# Security Policy

## Supported Versions

Currently, GIG is in its Alpha phase. Only the following versions are supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| Alpha v0.1 | :white_check_mark: |
| < Alpha v0.1 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in GIG, please report it via email to the maintainers at security@example.com. 
Please **do not** report security vulnerabilities through public GitHub issues.

### What constitutes a security vulnerability?
- Authentication bypass
- Authorization flaws (e.g., accessing data of other users)
- SQL Injection (especially related to our Supabase PostgreSQL integration)
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Exposure of sensitive credentials or secrets

### Response Timeline
We aim to acknowledge receipt of vulnerability reports within 48 hours and provide an estimated timeline for resolution. We will keep you updated throughout the patch process.

## Alpha Software Disclaimer
Please note that GIG Alpha v0.1 is alpha software. While we take security seriously, this software is in active development and may contain bugs or vulnerabilities. Use in production environments is at your own risk.
