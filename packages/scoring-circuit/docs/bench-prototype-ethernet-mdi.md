# BP-141 W5500 to MagJack MDI contract

## Boundary

This is the electrical-wiring contract for the one-board bench prototype's
WIZnet `W5500` and Würth Elektronik `7499011121A` integrated-magnetics RJ45.
It imports BP-140's exact controller and support-network record plus the
committed manufacturer footprint evidence. It does not modify the retained
multi-board model.

It is not schematic integration, footprint approval, routed-layout approval,
bench validation, fabrication approval, or permission to apply power. All of
those states remain **DENY**.

## MDI pin map

| W5500 PHY pad | Net | 7499011121A pin | MagJack signal |
| --- | --- | --- | --- |
| `TXP`, pin 2 | `ETH_TX_P` | 1 | `TD+` |
| `TXN`, pin 1 | `ETH_TX_N` | 3 | `TD-` |
| `RXP`, pin 6 | `ETH_RX_P` through `C_ETH_RX_P` (6.8 nF) | 4 | `RD+` |
| `RXN`, pin 5 | `ETH_RX_N` through `C_ETH_RX_N` (6.8 nF) | 6 | `RD-` |

The W5500 data sheet identifies pins 1 and 2 as its transmit differential
pair and pins 5 and 6 as its receive differential pair. The Würth drawing
identifies pins 1 through 6 as `TD+`, `CTD`, `TD-`, `RD+`, `CRD`, and `RD-`.
The mapping preserves each pair's polarity.

All four MDI nets are board copper between `U_W5500` and `J_ETH`. There is no
interboard connector, cable, or harness in either MDI pair. The Ethernet cable
plugs directly into `J_ETH`; a crossed cable is not used to repair a board-side
pin swap. The W5500 itself has no auto-MDIX, so cabling behavior remains a
bench validation item.

## Center taps and termination

`J_ETH.2` (`CTD`) is the transmit-transformer center tap. It receives
`ETH_AVDD` through a 10 Ohm feed and has a local 22 nF capacitor to `APP_GND`.
Each transmit signal has a 49.9 Ohm reference path to `ETH_AVDD`. These values
are copied as an explicit reference topology from WIZnet's W5500 EVB and must
be populated as individual BP-300 schematic references.

`J_ETH.5` (`CRD`) is the receive-transformer center tap and joins
`ETH_RX_BIAS`. `ETH_RX_BIAS` has a 10 nF local capacitor to `APP_GND`; each
W5500 receive pin has a 49.9 Ohm path to it; and each receive signal has a
6.8 nF series capacitor before the MagJack. This is the W5500 EVB reference
topology carried into the prototype contract. BP-300 must independently
review it against the selected MagJack and create every reference designator.

The selected MagJack already contains the cable-side common-mode termination
shown in the Würth drawing: four 75 Ohm resistors and one 0.001 uF / 2 kV
capacitor. Adding a second external Bob Smith network is prohibited.

## LEDs, shield, and ESD return

The selected jack has yellow LED anode/cathode pins 9/10 and green LED
anode/cathode pins 11/12. `ACTLED` (W5500 pin 27, active-low) sinks the yellow
LED cathode; `LINKLED` (pin 25, active-low) sinks the green cathode. Each
anode is fed from `V3_3` through a 330 Ohm current limiter. `SPDLED` and
`DUPLED` are intentionally not connected in this bench configuration.

`J_ETH.8`, the external end of the internal common-mode termination capacitor,
and shield tabs `S1` and `S2` join `CHASSIS_ETHERNET`. Ethernet cable-side ESD
returns use that same local chassis island. It has no direct `APP_GND` or
`SCORING_SGND` connection. The chassis bond, surge energy path, touch/current
behavior, and ESD/EMI results are not implied by this net decision and remain
open measurements.

## Routing plan

Route `ETH_TX_P/N` and `ETH_RX_P/N` as two 100 Ohm differential pairs entirely
on the board. Preserve pair geometry, avoid stubs, and use identical layer
changes and via topology for each conductor of a pair. Exact trace width,
spacing, reference plane, impedance tolerance, and allowed intra-pair skew
come from the selected BP-400 board stackup and fabricator capability; they are
not invented before stackup selection.

Before layout release, review the placement-to-jack path, return continuity,
pair skew, stubs, through-hole escape geometry, chassis-island clearance, and
the isolated application/scoring boundary.

## Evidence and open gates

The executable contract is
`src/bench-prototype-ethernet-mdi.ts`. It checks immutable, pin-for-pin data
and fails if either the BP-140 controller identity or the selected MagJack
evidence drifts.

Primary sources: [W5500 data sheet](https://docs.wiznet.io/img/products/w5500/W5500_ds_v110e.pdf),
[W5500 EVB schematic](https://docs.wiznet.io/img/products/w5500/w5500_evb/w5500_evb_v1.0_140527.pdf),
and [Würth 7499011121A drawing](https://www.we-online.com/components/products/datasheet/7499011121A.pdf).

The receive center-tap network, added-component footprints, 100 Ohm geometry,
return paths, link/traffic/fault captures, ESD, EMI, shield current, and surge
behavior are still required. None of this work releases a PCB for fabrication.
