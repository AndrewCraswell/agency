# Scoring documentation

Use this directory for current product contracts and executable behavior evidence. Source code and tests own
implementation details. Historical task reports, superseded architecture plans, and completed implementation diaries
are not retained here.

## Canonical plans

- [C17 and WebAssembly migration](c17-wasm-simulator-migration.md) owns the single portable scoring core.
- [Encrypted IR remote-control contract](encrypted-ir-remote-control-contract.md) owns referee-control behavior and
  security requirements.
- [USB scoring platform](../../../packages/scoring-circuit/usb-scoring-platform/README.md) describes the current native
  KiCad board. Its [design review](../../../packages/scoring-circuit/usb-scoring-platform/design-review.md) owns hardware
  findings, remaining verification, and assembly constraints.
- [Technical debt](technical-debt.md) contains only current, actionable cleanup findings.

Use these plans rather than the completed checklist for the earlier ESP32-only carrier.

## Normative inputs

The preserved [specifications](specifications/README.md) directory contains FIE rules, commercial-machine references,
protocol material, prior art, and the approved product specification. It is research and traceability input, not a claim
that the prototype is homologated.

## Scoring behavior

- [Scoring glossary](scoring-glossary.md)
- [Decision records](decision-record-contract.md)
- [Timing tables](timing-table-contract.md)
- [Epee logical cases](epee-resistance-logical-cases.md)
- [Foil state machine](foil-state-machine-contract.md)
- [Sabre state machine](sabre-state-machine-contract.md)
- [Golden scenarios](golden-scenario-contract.md)
- [Behavior oracle](behavior-oracle-contract.md)
- [Scenario runner](scenario-runner-contract.md)
- [Seeded protocol fuzz evidence](seeded-protocol-fuzz-evidence.md)

## Replay, workflow, and remote control

- [Bout state](bout-state-contract.md)
- [Replay renderer](replay-renderer-contract.md)
- [Application time metadata](application-time-metadata-contract.md)
- [Event capture](event-capture-contract.md)
- [Event journal](event-journal-contract.md)
- [Remote authority](remote-control-authority-adr.md)
- [Remote button reference](remote-control-button-reference.md)
- [Encrypted IR security](encrypted-ir-security-contract.md)

## Product safety and recovery

- [Product release manifest](product-release-manifest-contract.md)

The current board has separate acquisition, application, and primary power-control processors. Consult the board's
[power-mode contract](../../../packages/scoring-circuit/usb-scoring-platform/usb-acquisition-power.md) and
[power-controller firmware](../firmware/power-control/README.md) for that boundary. Hardware selection does not by
itself prove the release or recovery firmware is complete.
