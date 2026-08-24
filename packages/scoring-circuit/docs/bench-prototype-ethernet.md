# BP-140 W5500 support-network import

## Boundary

BP-140 imports the committed W5500 controller and local support-network
decisions into the one-board bench-prototype namespace. It does not modify the
retained multi-board circuit model. It is a drift-detecting electrical contract,
not an integrated schematic, footprint release, PCB layout, order BOM,
fabrication approval, or permission to apply power. Integration and fabrication
remain `DENY`.

## Exact imported population

| Function | Reference | Exact MPN |
| --- | --- | --- |
| Ethernet controller | `U_W5500` | WIZnet `W5500`, LQFP-48, 7 mm by 7 mm body, 0.5 mm pitch |
| 25 MHz crystal | `Y_W5500` | ECS `ECS-250-18-33B-JGN-TR` |
| Matched 18 pF load capacitors | `C_W5500_XI`, `C_W5500_XO` | TDK `CGA3E2C0G1H180J080AA` |
| 1 MOhm crystal feedback | `R_W5500_XTAL` | Panasonic `ERJ3EKF1004V` |
| 0 Ohm crystal series link | `R_W5500_XO` | Panasonic `ERJ3GEY0R00V` |
| 12.4 kOhm EXRES1 reference | `R_W5500_EXRES` | Panasonic `ERJ3EKF1242V` |
| 4.7 uF TOCAP capacitor | `C_W5500_TOCAP` | Murata `GRM21BR71C475KA73L` |
| 10 nF 1V2O capacitor | `C_W5500_1V2O` | Murata `GRM188R71H103KA01D` |
| VDD and six AVDD 100 nF bypasses | `C_W5500_VDD`, `C_W5500_AVDD_1` through `_6` | Murata `GRM188R71C104KA01D` |
| Ferrite-input 100 nF bypass | `C_ETH_AVDD_FERRITE_INPUT` | Murata `GRM188R71C104KA01D` |
| AVDD ferrite | `FB_W5500_AVDD` | Murata `BLM21PG221SN1D` |

`V3_3` feeds W5500 VDD directly and feeds `ETH_AVDD` through the selected
ferrite. Each of the six AVDD pins has its own local bypass to `APP_GND`;
W5500 VDD has its own local bypass; and the ferrite input has a separate local
bypass. All W5500 analog, digital, crystal-shield, and support returns use
`APP_GND`. They do not tie to the scoring ground.

## Reset and interrupt

`APP_W5500_RESET_N` joins `U_APP_RESET_FANOUT.Y2`, exact Yageo
`RC0603FR-0710KL` 10 kOhm pull-up `R_W5500_RESET_PULLUP`, W5500 `RST_N`, and
the required `TP_W5500_RESET_N` observation point. BP-123 selects exact TI
`SN74LVC2G07DCKR` as the dual non-inverting open-drain fanout from
`APP_SUPERVISOR_RESET_N`. Y2 is the Ethernet-only output; Y1 separately drives
`EN_RESET`. Therefore watchdog, manual, or STM32-request sinks on `EN_RESET`
cannot reset W5500. No ESP32 GPIO is connected to the Ethernet reset net, so
firmware cannot override a supervisor brownout or release delay.

W5500 `INT_N` is an active-low push-pull output. The unconsumed output reaches
`TP_W5500_INT_N` and the reserved `R_W5500_INT_BIAS` position, but no ESP32
GPIO. The bias value remains `TBD` on `V3_3`; BP-123 must select it or record an
explicit DNP after power-sequence review. Firmware polls the controller over
SPI regardless.

BP-123 owns the exact supervisor, timing capacitor, fanout, reset pull-up, and
reset timing; BP-142 owns the application rail. Their schematic inputs have
converged, while footprints, placement, and measured sink/timing behavior
remain open. The interrupt bias-or-DNP decision also remains open.

## Still open

- Release every controller and support-part land pattern and assembly drawing.
- Review crystal placement and return paths, then measure oscillator startup,
  frequency, drive, and at least 200 Ohm negative-resistance magnitude on the
  released layout.
- Measure AVDD/VDD impedance and ripple, ferrite heating, EMC, ESD, and thermal
  behavior.
- Complete BP-141 for W5500 MDI pin mapping, the Würth `7499011121A`,
  termination, shield/ESD return, surge behavior, and 100 Ohm routing.
- Integrate the BP-142 application rail and BP-123 supervisor, fanout, exact
  reset pull-up, and timing network; close the interrupt bias-or-DNP decision
  before schematic integration.

The source evidence remains
[`w5500-support-network-selection.md`](./w5500-support-network-selection.md),
the executable `ethernetSupportNetwork` record, and the component decision
register. BP-140 stores a separate immutable literal provenance snapshot and
compares the live source registries against it. Any MPN, value, reference,
count, connection, rail, or reset-policy drift must update the snapshot,
contract, and review evidence explicitly.
