# Scoring

This package contains the deterministic fencing-rule implementation, executable behavior corpus, referee workflow, and
browser simulator.

## Current architecture

The product direction is one ESP32-S3 prototype board running one portable C17 scoring core. Native host tests compile
the same core, and the browser simulator will load it as WebAssembly. TypeScript owns orchestration, validation,
workflow, replay, and presentation; after the migration it will not contain a fallback scoring engine.

The current transition is tracked in [`docs/c17-wasm-simulator-migration.md`](docs/c17-wasm-simulator-migration.md).
Until that migration closes, the TypeScript weapon scorers remain the simulator reference and the legacy
`firmware/stm32` target remains only as migration and comparison evidence. Neither is the prototype hardware
architecture.

The clean-sheet board backlog is
[`packages/scoring-circuit/docs/esp32-prototype-backlog.md`](../../packages/scoring-circuit/docs/esp32-prototype-backlog.md).
Encrypted referee-control behavior is tracked in
[`docs/encrypted-ir-remote-control-contract.md`](docs/encrypted-ir-remote-control-contract.md).

## Golden scenario runner

Build the package, then run either the complete corpus or one scenario:

```text
pnpm run:scenarios -- docs/golden-scenario-manifest.json
pnpm run:scenarios -- docs/golden-scenarios/epee-contact-boundaries.json
```

Exit code `0` means the selected expectations passed, `1` means a result differed, and `2` means the input or contract
was invalid. Scenario success is software evidence; it does not prove analog thresholds, board timing, or FIE
homologation.

## Verification

Use the package scripts in `package.json`. In particular, `pnpm test:c-coverage` enforces 100% line, function, and
branch coverage for the C scoring core and at least 80% for every other first-party C or C++ source.

Start with [`docs/README.md`](docs/README.md) for the remaining current contracts and executable evidence.
