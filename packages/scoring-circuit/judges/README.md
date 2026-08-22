# Board review judges

These workflows use `codex exec` as a read-only, structured-output reviewer. They do not edit the repository and they do
not turn an architecture model into a fabrication release.

- `pnpm judge:reliability` checks fault containment, lifecycle, thermal/power margin, replay integrity, security,
  serviceability, and whether component claims are appropriately qualified.
- `pnpm judge:manufacturability` checks schematic/PCB completeness, footprints, connector mechanics, test coverage,
  compliance gates, sourcing, and whether the readiness statement is honest.

Each run writes its JSON result under `judges/results/`. A human must reproduce factual findings against manufacturer
datasheets and correct accepted findings before release. A judge pass is advisory; analog validation, ERC, DRC, an
independent hardware review, and physical validation remain mandatory.
