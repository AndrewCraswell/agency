# BP-033 Yageo RC0603FR-07100RL encrypted-IR resistor review candidate

## Scope and root handoff

This isolated review candidate covers exactly two encrypted-IR support-network
references:

- `R_IR_VS`: `APP_3V3` to the filtered receiver supply.
- `R_IR_OUT`: receiver output to `IR_RX_GPIO35`.

Both are YAGEO `RC0603FR-07100RL`, 100 ohm, 1%, 0603 / 1608. The candidate
contains an explicit root-integration handoff requiring exactly these two rows
with that manufacturer, MPN, and package in the mutable canonical application
ledger. It deliberately does not hash or modify that ledger.

The stable BP-146 encrypted-IR selection contract is retained as
`bench-prototype-ir-receiver-selection.ts`, SHA-256
`D716C2702606A7EA7A00D72ED0434B56A3BF4F13B6F9638E92221BDF9E68852D`.
It binds the supply-isolation and output fault/backfeed roles, but does not
authorize a board placement or release.

## Exact primary evidence

The retained official YAGEO one-page product specification is
[`yageo-rc0603fr-07100rl-datasheet.pdf`](evidence/bp-033/yageo-rc0603fr-07100rl-datasheet.pdf),
SHA-256 `FA83985D9865FE54D18F0B3BFF57200829EDD95CB4C2EB4694C45BB92EB18C07`.
The official source URL is
<https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL>.

Page 1 binds the exact orderable, 100 ohms, 1%, 0.1 W at 70 C, 0603 / 1608,
75 V maximum continuous voltage, minus 55 C to plus 155 C operating range,
and the 1.6 mm by 0.8 mm by 0.45 mm body envelope. The specification does not
publish copper lands, solder mask, paste apertures, courtyard, or a CAD object.

## Project review input and denied gates

The two-pad project review geometry uses 0.90 mm by 0.90 mm pads, a 0.50 mm
inner gap, 0.05 mm per-edge mask margin, 0.05 mm per-edge paste reduction, and
a 2.40 mm by 1.40 mm courtyard. These are project review inputs from the
package envelope, not YAGEO land-pattern or CAD data. The generated isolated
artwork hash is `C7F7B09F6AA395F0828ED993D2801D6AEB08D8533C3D8933DD64187423B4B1A8`.

The resistor is non-polar and no pin-one claim is made. Printed-value
orientation, placement, clearance, flex stress, and assembly direction remain
open independent reviews. Manufacturer CAD, project CAD import, board
placement, geometry acceptance, orientation acceptance, fabrication, release,
and acceptance all remain denied.

The private frozen baseline and descriptor-safe validator reject changed values,
accessors without reading them, hidden and symbol fields, prototype changes,
aliases, and cycles. Focused tests also bind the evidence hash, upstream
selection hash, exact two-row handoff, and isolated rendered geometry.
