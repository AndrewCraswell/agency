# ESP32 scoring development board

## Purpose

Build one simple carrier that lets us write and test scoring firmware on real hardware. It is deliberately oversized,
module-based, and suitable for hand modification. Success means the first boards can be powered, programmed, connected
to fencing conductors, and used to exercise scoring behavior.

This is not a production scoring machine, a certification sample, an enclosure design, or a cost-optimized PCB.

## Hardware boundary

| Function | Prototype implementation |
| --- | --- |
| Processor and scoring | ESP32-S3-WROOM-1-N16R2 running the portable C17 scoring core |
| Ethernet | Socketed or directly soldered WIZ850io module |
| Power | USB-C into an off-board SparkFun DEV-15801 PD board and Pololu D36V50F5 regulator; fused 5 V enters the carrier |
| Scoring inputs | Existing seven-line source, sink, protection, mux, ADC, and reference circuit |
| Weapon connection | Large solder landings for the validated Ok Fencing cable/socket wires; a custom production connector is deferred |
| Display | Buffered HUB75 connector with a fused 5 V branch |
| Remote | TSOP38438 receiver connected to an ESP32 RMT input |
| Local outputs | Protected lamp and buzzer drivers |
| Development access | ESP32 native USB, EN, BOOT, UART, and useful test points |

USB-C PD remains the normal system power input. The PD and high-current conversion boards are wired off-carrier because
putting their circuitry on this prototype would add layout work without improving firmware development. WIZ850io avoids
rebuilding the Ethernet PHY, transformer, crystal, and RJ45 interface.

## Design rules

- Add a component only when the first prototype needs it to function or survive ordinary bench handling.
- Prefer modules, common connectors, direct soldering, and bodge-wire repair over custom production circuitry.
- Keep one ESP32. Preserve logical firmware boundaries so a later product may split scoring onto another MCU.
- Keep the C17 core hardware-independent and make it the only scoring authority.
- Keep outputs disabled during reset until firmware explicitly enables them.
- Use a roomy 250 mm by 180 mm four-layer board with a continuous ground plane. Do not optimize board area yet.
- Use a conventional PCB editor for final placement, routing, ERC/DRC, Gerbers, drills, BOM, and placement output.
- Do not create per-part qualification records, evidence ledgers, validators, routing-parity gates, production test
  fixtures, environmental tests, or homologation paperwork for this board.

## First-board acceptance

The board is ready to order when the schematic is electrically connected, footprints are usable for the intended
hand/prototype assembly, the PCB editor reports no blocking ERC/DRC errors, and the order files have been visually
checked. It does not need production certification or proof that every possible operating condition is covered.

After assembly, bring-up is intentionally short: verify power and USB programming, verify Ethernet/display/IR/outputs,
exercise all seven scoring conductors, and run the foil/epee/sabre corpus plus practical timing and resistance checks.
Anything beyond that belongs to the later production design.
