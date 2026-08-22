# Judge adjudication

The LLM reviews are advisory. Findings were accepted when they exposed a misleading claim, an unsafe boundary, or a
missing executable contract. Requests that belong to physical validation remain gates so this architecture increment
does not become premature production engineering.

## Corrected in this increment

- The replay decoder now verifies CRC-32C, strict sample ordering, capture endpoints, sequence range, firmware digest,
  scoring boot identity, and timing metadata.
- Documentation separates the production replay target from the currently implemented qualified-epee record.
- Watchdog and voltage-supervisor reset outputs reach each controller's reset input.
- The piste input passes through an explicit protected-front-end boundary instead of appearing connected directly to an
  MCU pin.
- Unresolved analog blocks and the ESP32 module are do-not-place; no guessed module footprint is presented as a
  fabrication choice.
- Structural tests assert the protected piste path, processor separation, and supervised reset paths.
- The preview opens both drawings at full size, and the component research snapshot has an explicit as-of date.

## Deliberately retained as release gates

- Exact three-weapon analog values and protection parts require FIE-derived limits, SPICE, and fixture measurements.
- Connector families, magnetics, display current, thermal margin, enclosure acoustics, and alternate sources require
  physical and supplier evidence.
- Routed barrier geometry, return paths, creepage, ERC/DRC, SI/PI, EMC, safety, and manufacturing outputs start only
  after the analog gate.
- Hardware-in-the-loop starts when boards exist. It is not useful as a dependency of the architecture model.

This is therefore an architecture prototype with honest blockers, not a PCB-fabrication release.
