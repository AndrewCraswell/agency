# Scenario runner contract

M2-12 provides the bounded host-side runner for the M0-07 golden scenario
format. The JSON Schema files remain the authoring contract:
[`golden-scenario.schema.json`](golden-scenario.schema.json) validates an
individual scenario and
[`golden-scenario-manifest.schema.json`](golden-scenario-manifest.schema.json)
validates a corpus index. The runner performs the strict fields and
cross-record checks needed to execute those documents, including exact object
keys, required values, unique input and line IDs, declared line membership,
manifest path and order, and manifest source/weapon identity.

## Invocation

From `apps/scoring`, run either one scenario or a manifest:

```text
pnpm run:scenarios -- docs/golden-scenarios/epee-contact-boundaries.json
pnpm run:scenarios -- docs/golden-scenario-manifest.json
```

The command emits exactly one pretty-printed JSON report on standard output.
The report has format `scoring-golden-run-report`, schema version `1.1.0`, a
stable lexicographic scenario order, deterministic actual results, mismatch
details, and a summary. Qualified-hit and off-target comparisons include the
canonical signal snapshot and exact listed `sourceInputIds`; descriptive
decision `id` values are not runtime identities. Planned manifest entries are not executed; active
entries must resolve to files and agree with their manifest IDs, weapons, and
source IDs.

Report `1.1.0` emits Sabre host `diagnostics` for canonical scenario version
`1.1.0` and Foil host `classifications` for canonical scenario version `1.2.0`.
The runner derives both from the listed inputs rather than replaying expectation
records. Sabre diagnostics are ordered by timestamp and side, and include only
the one or two input IDs that establish their onset, clearing edge, or qualified
duration.

Exit status is part of the interface:

- `0`: every selected scenario matched its declared accepted or rejected result;
- `1`: a scenario executed but its result differed from its expectation;
- `2`: the input path, JSON, schema fields, or manifest contract was invalid.

The runner invokes the selected host weapon scorer and preserves listed input
order. It does not sort invalid timestamps, replay stored decision records, or
claim physical hardware, analog, firmware, or FIE approval evidence.

## Bounded input

The runner rejects an input file larger than 4 MiB before parsing. It also
enforces fixed limits for manifest entries, source records and IDs, line names,
scenario snapshots, lines per snapshot, expected decisions, diagnostics,
diagnostic source input IDs, classifications, non-events, uncertainties, and
coverage references. The diagnostic limits are 4,096 records per scenario and
two source input IDs per record. These limits are exported by the runner module
so tests and tooling can exercise the exact boundaries. A
malformed or over-limit document is exit status `2`; an unexpected internal
failure is reported as `execution-error`, also with exit status `2`.
