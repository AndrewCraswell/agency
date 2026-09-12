# Scoring

This package contains the deterministic fencing-rule implementation, executable behavior corpus, referee workflow, and
browser simulator.

## Current architecture

The native KiCad designs use STM32G474 for acquisition/scoring, ESP32-S3 for application interfaces and wireless/IR, and
STM32C011 for input-power control. USB transport is board-specific: the virtual box uses a USB-to-UART bridge; the
frozen combined board has a different USB interface. The scoring target remains one portable C17 core shared by
desktop/native tests, STM32 firmware, and WebAssembly. TypeScript owns orchestration, validation, workflow, replay, and
presentation; after the migration it will not contain a fallback scoring engine.

The current transition is tracked in [`docs/c17-wasm-simulator-migration.md`](docs/c17-wasm-simulator-migration.md).
Until that migration closes, the TypeScript weapon scorers remain the simulator reference. Existing firmware must be
checked against the actual board pinout and power sequencing; its presence does not establish hardware readiness.

The [hardware index](../../packages/scoring-circuit/README.md) distinguishes the active
[virtual scoring box](../../packages/scoring-circuit/virtual-scoring-box/README.md), the frozen combined board and the
planned standalone HUB75 board. Consult each board's own handoff rather than transferring its pinout or power budget to
another variant. Encrypted referee-control behavior is tracked in
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
