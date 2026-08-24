# Communications and power connector CAD verification

**Task:** M4-11

**Disposition:** Fabrication deny. This is a source and contract reconciliation,
not a CAD or physical-fit approval.

## Power-input boundary

USB-C PD through Amphenol `10177070-00011LF` remains the sole external
apparatus-power input and the USB 2.0 UFP service port. The planned request is
20 V, 3 A. `J_PWR_CARRIER`, Molex `43045-0400`, is a locking internal carrier
power-harness connector. It must not be presented as a second external power
inlet, source, or bypass around the PD controller and upstream eFuse.

## Selected-part reconciliation

| Interface | Selected part | Primary manufacturer source | Current evidence | Fabrication result |
| --- | --- | --- | --- | --- |
| RJ45 | Würth Elektronik `7499011121A`, `J_ETHERNET_MAGJACK` | [Datasheet and recommended holes](https://www.we-online.com/components/products/datasheet/7499011121A.pdf), [exact STEP rev1](https://www.we-online.com/components/products/download/7499011121A%20%28rev1%29.stp) | The drawing and STEP are acquired but not overlaid in released board or enclosure CAD. | Deny |
| USB-C PD and service | Amphenol Communications Solutions `10177070-00011LF`, `J_USB_C` | [Product drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf), [manufacturer 3D archive](https://cdn.amphenol-cs.com/media/wysiwyg/files/3d/s10177070c.zip) | Both sources are manufacturer-listed, but direct project acquisition returned HTTP 403. No geometry has been transcribed or imported. | Deny |
| Locking carrier power | Molex `43045-0400`, `J_PWR_CARRIER` | [Micro-Fit 3.0 manufacturer family page](https://www.molex.com/en-us/products/connectors/wire-to-board-connectors/micro-fit-30-connectors) | The current contract identifies the selected header and mate, but no configured header, mate, terminal, or harness drawing is acquired. | Deny |

The RJ45 manufacturer drawing identifies the through-hole signal, LED, shield,
and retention features. The exact holes, including shell-tab features, are not
approved until the imported footprint, STEP, and drawing are independently
overlaid. The USB-C drawing cannot be used indirectly through a generic Type-C
footprint: contact pads, shell stakes, paste, mask, board edge, 0.80 mm board
thickness, and mating envelope are unknown until the exact drawing and model
are obtained. The current locking power record also has no approved land
pattern or configured drawing.

## Explicitly open gates

All of these gates fail closed. An unknown or unverified entry cannot be
interpreted as a pass.

| Evidence | RJ45 | USB-C | Locking carrier power |
| --- | --- | --- | --- |
| Exact land pattern | Unverified | Unknown | Unverified |
| Board and enclosure CAD overlay | Unverified | Unknown | Unverified |
| Shield tabs or shell stakes | Unverified | Unknown | Unknown |
| Chassis fasteners and load path | Unknown | Unknown | Unknown |
| Installed-module service access | Unverified | Unverified | Unverified |
| Plug or harness strain relief | Unverified | Unverified | Unverified |

No fastener identity, position, or tolerance stack is selected. The provisional
communications-module statement that a tray uses two positive fasteners is not
a drawing-controlled fastener definition and is not evidence of engagement,
service tool access, or a load path. Likewise, no current evidence proves that
an RJ45 or USB-C plug load, or a carrier-power harness pull, bypasses PCB solder
joints.

## Required evidence before release

1. Acquire the exact selected-part manufacturer drawing and CAD files through
   the manufacturer or authorized access path, recording revision, URL, date,
   and checksum.
2. Import each land pattern and CAD model into the released board and enclosure
   assembly. Independently overlay pin one, every copper or hole feature,
   shield tabs or shell stakes, board edge, courtyard, mating axis, and
   enclosure cutout.
3. Release the chassis fastener specification, positions, torque, tolerance
   stack, and independent connector load path.
4. Demonstrate the documented de-energized service sequence with all latches,
   cable anchors, and removal tools accessible.
5. Run plug-fit, extraction, cable-pull, bend, repeated-service, temperature,
   ESD, and EFT tests on production-equivalent board, enclosure, cables, and
   harnesses.

`src/communications-power-connector-cad.ts` is the executable fail-closed
record for this audit. It preserves the selected MPNs and rejects any change
that treats missing land-pattern, CAD-overlay, service, or strain-relief
evidence as fabrication approval.
