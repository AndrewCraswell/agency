# ESP32 firmware-development carrier

## Purpose

This board exists to let us write and test the scoring-machine firmware on real hardware. It is a bench prototype, not
a production scoring box, a homologation sample, or a final cost-reduced design.

The prototype succeeds when assembled hardware can:

- read the seven weapon and piste conductors through the custom scoring front end;
- run the portable C17 scoring core on one ESP32-S3;
- drive lamps, buzzer, a HUB75 display, and the encrypted-IR receiver;
- communicate over Ethernet and USB diagnostics; and
- survive normal bench mistakes well enough to continue firmware development.

Production certification, enclosure work, production test fixtures, long-term component sourcing, exact impedance
coupons, redundant supervisors, and cost optimization are explicitly deferred.

## Simplified hardware

Only the scoring-specific electronics remain custom. Commodity functions use replaceable modules or a simple wired
bench assembly:

| Function | Prototype choice | Carrier connection |
| --- | --- | --- |
| Processor | ESP32-S3-WROOM-1-N16R2 | Existing module footprint, native USB, EN, BOOT, UART, and GPIO |
| Ethernet | WIZnet WIZ850io | Two 1x6 2.54 mm sockets carrying 3.3 V, ground, SPI, interrupt, and reset |
| USB-C PD sink | SparkFun DEV-15801 STUSB4500 board | Off-board power assembly; USB-C is the normal system input |
| 20 V to 5 V conversion | Pololu D36V50F5 module | Off-board power assembly feeding the carrier's fused 5 V/GND screw terminal |
| Scoring acquisition | Existing phased source/sink/sense circuit | Custom muxes, protection, buffers, ADC, reference, and weapon landings |
| Display | Existing reset-safe HUB75 buffers | Keyed HUB75 connector and fused 5 V branch |
| Remote | TSOP38438 receiver | ESP32 RMT input with the existing small filter/protection network |
| Outputs | Existing protected driver | Lamp and buzzer connector |

The WIZ850io already contains the W5500, transformer, and RJ45, so the carrier does not reproduce its crystal,
magnetics, termination, or PHY layout. The STUSB4500 board performs USB-C negotiation, and the Pololu module performs
the high-current conversion. They are wired together off-board for the prototype, so neither their internal components
nor their mechanical footprints are part of the carrier BOM or routing problem.

References:

- [WIZ850io product and pinout](https://wiznet.io/products/ethernet-modules/wiz850io)
- [SparkFun STUSB4500 USB-C PD board](https://www.sparkfun.com/sparkfun-power-delivery-board-usb-c-qwiic.html)
- [Pololu D36V50F5 regulator](https://www.pololu.com/product/4091/specs)

## What is removed from this prototype

- Discrete W5500, crystal, magnetics, termination, and Ethernet differential-pair layout.
- Discrete USB-PD controller, eFuse, 20 V buck regulator, their support networks, and all 20 V carrier routing.
- External ESP32 supervisor and watchdog; the prototype uses ESP32 reset circuitry and its internal watchdogs.
- Production telemetry, redundant testpoints, order-specific impedance coupons, and fabrication-evidence machinery.
- Any requirement that the tscircuit autorouter complete the board. The schematic/netlist may remain code-generated,
  but final placement and routing use a conventional PCB editor and its DRC.

## What must remain

- USB-C PD is the normal power input.
- Ethernet, HUB75, encrypted IR, USB recovery, direct weapon-wire landings, and protected outputs remain available.
- The portable C17 core is the only scoring authority.
- The analog front end must support foil, epee, and sabre timing and resistance behavior. Public/open designs are prior
  art only; bench measurements determine whether this prototype is suitable for further development.
- The board must fail safe on reset: scoring excitation and primary outputs remain disabled until firmware explicitly
  enables them.

## Layout and order standard

Start with a roomy 250 mm by 180 mm four-layer carrier so placement, routing, probing, and hand modifications remain
easy. Layer 2 is a continuous ground plane. Board-area optimization is explicitly deferred. Do not delay the prototype
for production impedance or stack-up optimization: follow the module vendors' carrier guidance, run the PCB editor's
DRC, review Gerbers and drill files, and order a small batch.

The previous 250-component, 708-connection integrated board is retired as the prototype implementation. Its scoring
front end, ESP32 allocation, HUB75, IR, output, and direct-landing work remain reusable evidence.
