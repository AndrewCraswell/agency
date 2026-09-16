# Legislation tools

Specialist maintenance and evaluation programs are grouped by ownership here. Run a tool from the app directory with:

```text
pnpm tool <area>/<file-name-without-extension> [arguments]
```

Use `pnpm tool --list` to print every available command. A tool belongs here only while it supports an unfinished
operational gate or a recurring evaluation. Delete temporary diagnostics, pilots, and acceptance harnesses after their
evidence is retained. The areas are:

- `agent`: recurring research-agent evaluation and comparison
- `openstates`: unfinished state ingestion, recovery, and repair operations
- `regulations`: eCFR, CFR, and Federal Register acquisition and validation
- `search`: active projection backfills, synchronization, and release checks
- `trigger`: Trigger.dev backfill and schedule administration

The `scripts` directory is reserved for package lifecycle shims, release smoke tests, and test harnesses that are
invoked directly by builds or deployment automation.
