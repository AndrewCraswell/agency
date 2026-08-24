# Bench prototype BOM baseline

This page defines the BP-020 baseline BOM contract for the accessible,
one-board bench prototype. It is intentionally separate from any production
BOM and is not a purchase list.

The executable source of truth is
`packages/scoring-circuit/src/bench-prototype-bom.ts`. The validator rejects
unknown or malformed runtime data, duplicate references, incomplete selected
rows, placeholder selected MPNs, provenance mismatches, sparse arrays,
accessors, cycles, aliases, symbol or extra keys, and any attempt to mark this
artifact as an order BOM or fabrication release.

## Exact selected identities

The prototype uses the same intended silicon for the behavior that must be
validated on the bench:

| Function | Reference | Exact MPN |
| --- | --- | --- |
| Authoritative scoring MCU | `U_SCORING` | `STM32G474RET3TR` |
| Application and network MCU | `U_APP` | `ESP32-S3-WROOM-1U-N16R2` |
| Main processor isolation | `U_ISO_MAIN` | `ISO7762FDWR` |
| Auxiliary processor isolation | `U_ISO_AUX` | `ISO7721FDR` |
| Isolated scoring power | `U_ISO_POWER` | `NXE1S0505MC`, surface-mount 14-position package with 5 solder lands at positions 1, 3, 7, 8, 14; four functional connections and position 14 NA/no-connect |
| Scoring reference | `U_REF` | `REF5025AQDRQ1` |
| Ethernet controller | `U_W5500` | `W5500`, LQFP-48, 7 mm by 7 mm body, 0.5 mm pitch |
| Integrated-magnetics Ethernet jack | `J_ETH` | `7499011121A` |
| USB-C power and service receptacle | `J_USB_C` | `10177070-00011LF` |
| USB-PD sink controller | `U_USB_PD` | `TPS25730ADREFR` |
| CC1/CC2/SBU1/SBU2 protection | `U_USB_PORT_PROTECT` | `TPD4S201TRGRRQ1` |
| USB D-/D+ ESD protection | `U_USB2_ESD` | `TPD2EUSB30DRTR` |
| VBUS transient clamp | `D_USB_PD_VBUS_TVS` | `TVS2200DRVR` |
| Disconnect-surge Schottky | `D_USB_PD_VBUS_DISCONNECT` | `B340A-13-F` |
| Reverse-blocking eFuse | `U_EFUSE` | `TPS259474ARPWR` |
| PPHV bulk capacitor | `C_USB_PD_PPHV` | `T523H107M035APE070` |
| PD 3.3 V LDO capacitor | `C_USB_PD_LDO` | `T55A106M010C0200` |
| Test-only injection connector | `J_LAB_INJECTION` | `43045-0400` |
| Hard source selector | `S_POWER_SOURCE_SELECTOR` | `7101SYZQE` |
| HUB75 buffer A/B | `U_DISPLAY_BUFFER_A`, `U_DISPLAY_BUFFER_B` | `SN74AHCT245PWR` |

The W5500 crystal, passives, ferrite, and supply capacitors are also included
as selected rows. Their source and package data are reused from the committed
Ethernet support-network record. Ethernet is therefore part of this prototype
even though final EMC, surge, shield, and production-layout evidence remains
open.

The `U_W5500` package identity is also checked against the existing WIZnet
manufacturer footprint evidence. It is the 48-pin LQFP package, not a QFN
package. Its manufacturer CAD still requires independent import, overlay, and
lot/package-revision review before footprint closure.

The Murata `NXE1S0505MC` package identity is a surface-mount 14-position
geometry with five solder lands at positions 1, 3, 7, 8, and 14. Four are
functional connections. The manufacturer pin map is 1 = -Vin, 3 = +Vin, 7 =
-Vout, 8 = +Vout, and 14 = NA (not available for electrical connection).
Murata's recommended 5-pad
footprint is source guidance only; it is not project CAD, generated artwork,
or footprint approval. BP-032 remains DENY until its independent drawing, CAD,
artwork, and orientation gates close.

Adafruit product `2277`, the 64-by-32 1/16-scan HUB75 panel, is recorded as a
selected external item. It is not assigned a PCB reference because it remains
off-board. The exact purchased revision, display cable, current draw, logic
thresholds, and thermal behavior remain measurement gates.

## Explicitly unresolved or deferred rows

The baseline keeps work visible without pretending it is closed:

- `REF5025AQDRQ1` itself is selected. Analog acquisition, protection, the
  reference input/output support network, and scoring regulation remain `TBD`
  until the one-channel experiment and measurements close.
- Weapon fixture, HUB75, SWD, service, and speaker connectors remain `TBD`
  until sample fit, pinout, mating, and harness evidence closes.
- BP-124 freezes the SWD candidate as Samtec `FTSH-105-01-L-DV-007-K` with
  pin 7 omitted and the ESP32 service candidate as Samtec `TSW-106-07-G-S`.
  Their BOM rows remain `TBD` and DNP until the exact footprint, mating,
  continuity, orientation, voltage, and recovery evidence is archived.
- The primary lamp and buzzer output connector is represented by
  `J_PRIMARY_OUTPUTS` and remains `TBD` until its connector, mate, pinout, load
  ratings, and harness are selected.
- USB-C PD is required. The Amphenol receptacle, TPS25730A controller,
  connector protection, VBUS TVS, disconnect Schottky, reverse-blocking eFuse,
  and committed bulk capacitors are selected. Remaining PD strap, timing,
  bypass, and USB 2.0 series parts are required `TBD` rows until exact MPNs and
  tolerance evidence close. Native USB 2.0 service data continues to the
  ESP32-S3 through `TPD2EUSB30DRTR`; `TPD4S201TRGRRQ1` owns only CC1, CC2,
  SBU1, and SBU2 protection.
- BP-050 permits a test-only 20 V, 2.3 A post-eFuse laboratory source through
  `J_LAB_INJECTION`. Exact `7101SYZQE` SPDT selection physically chooses the
  normal `PD_EFUSE_OUT_20V` source or the diagnostic `LAB_POST_EFUSE_20V`
  source. Both sources must be de-energized before moving the selector. This is
  not a second product input and never connects to raw VBUS, PPHV, CC, or USB
  data.
- Battery/UPS remains explicit `DNP`; it does not replace the required USB-C
  PD input.
- The external antenna remains `TBD`; wired Ethernet is the required network
  path for this baseline.

`TBD` means a reserved prototype position with an expected quantity but no
orderable identity. `DNP` means the position is intentionally unpopulated and
has quantity zero. A `selected` row must have a positive quantity, exact MPN,
manufacturer, allowed lifecycle, package description, and an HTTPS source.
`B340A-13-F`, `T523H107M035APE070`, `T55A106M010C0200`, `43045-0400`, and
`7101SYZQE` retain explicit `unresolved` lifecycle status because their present
records prove exact identity/footprint or BP-050 use, not current lifecycle.
Their lifecycle must be checked against a real manufacturer lifecycle source
before the order-candidate BOM.

## Release boundary

The executable object is permanently marked with `isOrderBom: false`,
`fabricationRelease: false`, and `releaseState: "deny"`. Passing its tests only
proves that the baseline contract is internally coherent. It does not prove
footprints, schematic/ERC, layout/DRC, thermal behavior, supply closure,
connector fit, or fabrication output.

The canonical object and all nested rows, sources, arrays, and external items
are deep-frozen. A caller cannot mutate the exported baseline and thereby
redefine the expectations used by runtime validation. Runtime selected-field
checks compare against those frozen rows, not the mutable component-decision,
Ethernet-support, USB-PD-footprint, or BP-050 exports used to construct the
initial snapshot.

The later order-candidate and fabrication gates must produce a new reviewed
artifact after all populated rows are exact, footprints are independently
verified, the schematic is accepted, and unresolved `TBD` rows are either
selected or explicitly removed.

## Verification

Run the focused package checks:

```text
pnpm --filter @repo/scoring-circuit exec vitest run src/bench-prototype-bom.test.ts
pnpm --filter @repo/scoring-circuit check:types
pnpm --filter @repo/scoring-circuit lint
pnpm exec oxfmt --check packages/scoring-circuit/src/bench-prototype-bom.ts packages/scoring-circuit/src/bench-prototype-bom.test.ts
```
