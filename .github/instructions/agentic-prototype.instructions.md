---
description:
  "Use when working anywhere in the agentic prototype project. Enforces forward-only implementation, disposable
  prototype data, and deliverable-level verification."
applyTo: "apps/agentic/**"
---

# Agentic Prototype Development

The Agentic application is an unreleased prototype. It has never had production users or a supported public release.

- Do not preserve backward compatibility. Replace obsolete contracts and implementations directly.
- Do not create version-suffixed files, symbols, schemas, routes, or APIs such as `V2`, `Phase2`, `legacy`, or
  compatibility aliases. Keep one canonical implementation.
- Fix forward. Update the current implementation and its original migration baseline instead of adding compatibility
  migrations, data rewrites, shims, fallbacks, or dual paths for unreleased behavior.
- Prioritize correctness over expediency. Fix root causes and maintain coherent contracts even when resetting prototype
  state is faster than preserving it.
- Treat prototype data as disposable. Do not preserve, migrate, or repair stale workflow or execution data unless the
  user explicitly requests it. Prefer a clean database reset or targeted deletion of stale prototype records.
- Preserve integration credentials and unrelated external configuration when resetting application data unless the user
  explicitly requests a full reset.
- Complete the entire coherent deliverable before running tests, type-checks, lint, formatting checks, browser
  acceptance, or repository verification.
- After the deliverable is complete, run the smallest relevant focused checks, repair related failures in one batch, and
  then run the required final repository verification.
- Do not run verification after each incremental edit or partial implementation.
