# BP-040 net classes and return-path contract

## Scope and release state

BP-040 freezes the electrical names and routing boundaries for the one-board
bench prototype. The executable source is
[`src/bench-prototype-net-classes.ts`](../src/bench-prototype-net-classes.ts),
with focused regression coverage in
[`src/bench-prototype-net-classes.test.ts`](../src/bench-prototype-net-classes.test.ts).

This is a schematic and layout contract only. `fabricationRelease` remains
`false` and `releaseState` remains `deny`. It does not create a netlist,
footprint, copper artwork, order BOM, or permission to apply power.

The contract validates the committed BP-010 one-board boundary and the
committed BP-050 power declaration at runtime. If either upstream record is
changed, incomplete, or weakened, BP-040 fails closed.

## Frozen names and classes

| Name | Class and reference | Required rule |
| --- | --- | --- |
| `APP_GND` | Application ground | Continuous reference for ESP32, W5500/Ethernet, USB service, V5, and HUB75 logic. It has no direct `SCORING_SGND`, `CHASSIS`, or `ESD_RETURN` bond. |
| `SCORING_SGND` | Scoring ground | Continuous reference under STM32 acquisition, REF5025, watchdog, lamps, and buzzer. It is separate from `APP_GND` on every layer. |
| `ESD_RETURN` | Connector-side ESD return island | Short, wide return for reviewed body-cord or fixture protection. It is not a signal return, ADC return, reference return, or substitute for either ground plane. |
| `CHASSIS` | Shield and metalwork parent | Connector-entry network for the USB-C shell, approved metalwork, and governed child islands. It is never USB or Ethernet signal return and has no automatic APP_GND DC bond. |
| `ANALOG_QUIET` | Scoring analog class | Guarded fixture-line, REF5025, ADC, and comparator routing referenced locally to `SCORING_SGND`. Keep it away from high-current, switch-node, RF, HUB75, and differential-pair fields. |
| `HIGH_CURRENT` | Power and return class | Short, wide, package-local loops for V20, V5, display, and isolated-scoring current. Every branch has a defined local return and a keyed, strain-relieved harness where it leaves the board. |
| `USB2_DIFF` | USB 2.0 differential class | `USB_DP`/`USB_DN`, 90 ohm target with 10% tolerance, same-layer matched pair over uninterrupted `APP_GND`, no stubs or plane split. `TPD2EUSB30DRTR` and exactly one matched 22 ohm resistor per line remain in the path. |
| `ETHERNET_DIFF` | W5500 MDI differential class | 100 ohm target with 10% tolerance, matched W5500-to-MagJack pairs entirely on this PCB, with no plane split or HUB75 return crossing. |

The USB shield is `CHASSIS`. The Ethernet shield is the governed
`CHASSIS_ETHERNET` child island defined by BP-141, beneath the `CHASSIS`
parent. Neither pair receives a separate signal-ground conductor. `APP_GND`
reference continuity for USB service is provided by the application
power/return contract. BP-141 remains on-board-only and must retain its
no-direct-APP_GND shield rule.

`ESD_RETURN` must not connect directly to `CHASSIS` or `CHASSIS_ETHERNET`.
Any future relationship requires one reviewed single-point bond with
documented impedance, current, and surge evidence; the current contract
contains no such bond.

High-current return references are explicitly domain-local: application and
display branches return to `APP_GND`, while the isolated scoring branch returns
to `SCORING_SGND`. No branch routes its return through the other domain.

## Isolation corridor

`APP_GND` and `SCORING_SGND` are separate on every layer. No direct copper,
zero-ohm link, plane, via, test pad, or routing crosses the physical corridor.
The only permitted crossing parts are:

- `ISO7762FDWR` for the committed isolated SPI/reset/heartbeat channels;
- `ISO7721FDR` for the STM32 heartbeat and service-only reverse channel; and
- `NXE1S0505MC` for isolated scoring power.

`NXE1S0505MC` is a power crossing from the application-side V5 source to the
isolated scoring-side supply. It is not a signal crossing and carries no
application ground or signal return.

The corridor rule is physical, not just a schematic net-name rule. Its slot,
creepage, clearance, keepout, domain-local decoupling, and DRC implementation
remain layout evidence gates.

## High-current source rule

The normal source remains sink-only USB-C PD at 20 V and 3 A. Bring-up may use
the regulated 20 V, 2.3 A maximum `LAB_POST_EFUSE_20V` source only through the
physical `7101SYZQE` SPDT selector to `V20_TO_V5_BUCK`. Source changes are
de-energized only, and simultaneous source drive is prohibited. Diagnostic
injection is not a normal product interface. The display branch retains its
physical disconnect and removable measurement link; panel inrush and thermal
evidence remain open.

## What this closes and what it does not

BP-040 closes the names, reference-domain intent, pair targets, shield
ownership, high-current return policy, and isolation prohibitions needed for a
schematic review. It does not close exact placement, stackup selection,
fabricator geometry, controlled-impedance coupons, ESD/surge performance,
thermal measurements, chassis bonding evidence, or any fabrication gate.
