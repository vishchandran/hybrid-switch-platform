# Software supply-chain security baseline

## Required controls

- Commit `package-lock.json` and use `npm ci`.
- Resolve dependencies from the configured npm registry.
- Disable dependency lifecycle scripts unless a reviewed exception is required.
- Pin GitHub Actions to reviewed commit SHAs.
- Grant workflows read-only token access and prevent checkout credential persistence.
- Audit production and complete dependency trees on dependency pull requests and weekly.
- Review Dependabot updates; major upgrades require compatibility testing.
- Keep credentials and environment files out of source and workflow logs.

## Audit findings — 2026-11-17

| Finding | Severity | Evidence | Risk | Status |
| --- | --- | --- | --- | --- |
| Mutable GitHub Action tags | High | CI used checkout and setup-node v4 tags. | A moved or compromised tag could execute unreviewed code. | Remediated with reviewed v5 commit SHAs. |
| Implicit permissions and persisted credentials | High | CI had no explicit permissions; checkout retained credentials. | A compromised step could misuse the workflow token. | Remediated with read-only contents and no persisted credentials. |
| No automated dependency monitoring | Medium | No audit workflow or Dependabot configuration. | Vulnerabilities could remain unnoticed. | Remediated with PR/weekly audits and non-major update PRs. |
| Unrestricted lifecycle scripts | High | Standard `npm ci` allowed install scripts. | A compromised package could execute during installation. | Remediated with `ignore-scripts=true`; no exception is currently required. |
| No committed container build | Informational | Repository has no Dockerfile. | Container-runtime hardening is not applicable to this repository today. | Reassess if a container image is introduced. |

## Validation and residual risk

The manifest, lockfile, GitHub Actions, ignore rules, and application structure were inspected. Authorization, routing, failover, stand-in processing, reversals, event processing, PostgreSQL, Redis, and BullMQ logic is unchanged.

GitHub Actions provide executed reproducible-install, audit, and test evidence. Audit findings require production-reachability review; scanning does not guarantee that a dependency is safe. Repository settings should additionally enforce required reviews, branch protection, secret scanning, and Dependabot alerts where available.
