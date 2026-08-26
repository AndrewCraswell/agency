# BP-034 connector samples, mates, and physical-fit evidence

BP-034 is the pre-order evidence contract for the bench board. It is deliberately
fail-closed: it freezes the exact samples to acquire, but it does not claim any
part has been ordered, received, mated, photographed, continuity-tested, or
approved for fabrication.

The executable contract is
[`src/bench-prototype-connector-preorder.ts`](../src/bench-prototype-connector-preorder.ts).

## Required samples

| Interface | Board or cable identity | Required mate or cable |
| --- | --- | --- |
| USB-C normal input | Amphenol `10177070-00011LF` | **Blocked:** an exact source-backed 20 V, 3 A cable MPN is not yet selected |
| Lab injection | One Molex `43045-0400` | One `43025-0400` housing and four `43030-0007` terminals |
| Measurement links | Four Molex `39-28-1023` | Four `39-01-2020` housings and eight `39-00-0039` terminals |
| Weapon fixture | One Molex `43045-1200` | One `43025-1200` housing and seven populated `43030-0007` terminals |
| Weapon test plug | Molex `44242-0005` | `43045-1200` only, de-energized |
| STM32 service | Samtec `FTSH-105-01-L-DV-007-K` | Samtec `FFSD-05-D-06.00-01-N` |
| ESP32 service | Samtec `TSW-106-07-G-S` | Samtec `SSW-106-01-G-S` |
| Ethernet | Würth `7499011121A` | **Blocked:** an exact source-backed 8P8C test-plug or patch-cable MPN is not yet selected |
| HUB75 signal | Samtec `TST-108-04-G-D-RA` | Adafruit `4170` |
| HUB75 panel power | Adafruit `4767` | JST `SMR-04V-N` with `SYM-001T-P0.6`, JST `SMP-04V-NC` with `SHF-001T-0.8BS`, and Adafruit `2277` |

## Acceptance record

An accepted evidence record must contain all of the following for every row:

- Receipt identity for the exact full component set: manufacturer, MPN,
  supplier, receipt, lot/date code, and exact quantity. Missing, extra,
  reordered, duplicated, under-counted, or over-counted mate components are
  rejected.
- Exact drawing revision plus immutable drawing and imported-CAD artifact IDs,
  each linked to a SHA-256, with footprint reference, pin-one overlay,
  board-edge/keepout review, and reviewer.
- Immutable SHA-linked photos of the pin-one/key feature and a fully seated mate, with the
  insertion direction, retention observation, and a rejected wrong-mate or
  reversal attempt.
- Immutable SHA-linked records for the independent load path, retention, and strain relief. USB-C
  and Ethernet plug loads may not rely on PCB solder joints alone.
- Typed de-energized, discharged continuity measurements with calibrated
  equipment provenance, pinout/checklist revision, artifact linkage, and the
  exact frozen `from` and `to` endpoint including its net name. A correct pin
  ID paired with a different endpoint is rejected. Each contact path must be
  no more than 2 ohms with no more than 0.2 ohms compensated lead residual;
  polarity, swap, reversal, and intentional-open rejection cases are recorded.

Evidence is accepted only as a dense tree of plain records and plain arrays
with exactly the declared enumerable data keys. Accessors are rejected without
being invoked. Hidden properties, symbols, extra fields, sparse or subclassed
arrays, cycles, and object aliases are rejected. Artifact IDs are exclusive to
one CAD, photo, retention, strain, or test record. The sole permitted reuse is
an explicitly identical calibration-certificate ID and SHA-256 across
measurements made with that same calibrated instrument.
The instrument identity is the exact manufacturer, model, and serial-number
tuple; a shared certificate ID cannot cross to a different tuple even when its
SHA-256 is identical.

The weapon fixture does not use the generic connector measurement shape.
BP-034 invokes the BP-104 evaluator directly and therefore requires its exact
seven end-to-end readings, 66 unique isolation readings, five intentional-open
readings, four negative cases, maximum 2 ohm contact paths, minimum 10 Mohm
isolation at 5 V, and maximum 0.2 ohm compensated lead residual.

The canonical lab connector reference is `J_LAB_INJECTION`. The ESP32 service
record explicitly recognizes `J_ESP_SERVICE` as the physical alias of
`J_ESP32_SERVICE`.

The BP-050 power contract is the authority for every measurement-link split
net. BP-034 binds both pins for all four links, including the distinct
source-side and load-side net names, and rejects a correct pin identifier with
the wrong net.

Passing BP-034 confirms connector identity and physical fit only. It does not
clear the USB-C power, weapon isolation, service recovery, Ethernet electrical,
or display inrush and thermal gates held by BP-050, BP-104, BP-124, BP-141,
and BP-143.
