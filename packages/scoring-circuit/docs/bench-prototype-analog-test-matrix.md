# BP-106 analog test matrix and evidence contract

**DENY.** BP-106 freezes what the prototype analog characterization must record. It does not authorize an energized test, fabrication, a production fixture, or seven-channel release. A manual laboratory fixture is acceptable; BP-105 automation is post-order work.

The executable contract is `src/bench-prototype-analog-test-matrix.ts`. Before consuming the BP-101 snapshot, it validates the frozen BP-101 reference-drive decision and source provenance, then reuses the BP-101 one-channel archive schema, including its commanded-versus-observed source, sink, force relay, current trip, dwell-timer witness, watchdog, reference, rails, overload, ADC-code, trace, and 10-second guarded-pulse checks. The evaluator validates BP-102 and BP-104 directly, embeds frozen snapshots of the BP-102 guarded envelope, interlock and physically incompatible connectors, and the BP-104 exact connector identity and pin map, then checks their canonical SHA-256 digests. It rejects an altered embedded snapshot even if an attacker recomputes that snapshot's digest.

## Frozen matrix

Normal `J_FIXTURE` points are the Cartesian product of:

- resistance: 0, 10, 95, 100, 105, 195, 200, 205, 245, 250, 255, 445, 450, 455, 470, 475, 480, 495, 500, and 505 ohms;
- line capacitance: 0.5, 2, 5, and 10 nF; and
- temperature: -40, 25, 85, and 125 C.

These points cover normative zero, 10-ohm epee contact, the 100-ohm epee-exceptional/sabre-exterior neighborhood, 200-ohm foil closed-circuit neighborhood, 250-ohm sabre control-break neighborhood, 450/475-ohm foil insulation bounds, and 500-ohm foil exterior neighborhood. They characterize analog resistance only; they do not claim weapon-rule timing or FIE approval.

Guarded `J_GUARDED_FORCE` points use -24, -7, -3, -1, -0.5, -0.3, -0.1, +0.1, +0.3, +0.5, +1, +3, +7, and +24 V across the same capacitance and temperature corners. Each is a maximum 100 ms pulse separated from the preceding force pulse by at least 10 seconds. Zero volts is a deenergized baseline, not an energized guarded point. Normal and guarded connectors are physically incompatible and must never be adapted into one live connector.

## Instruments and records

The run manifest requires unique identified resistance and capacitance standards, temperature reference, DMM, oscilloscope, programmable force source, and force-current monitor. Every item carries manufacturer, model, serial number, calibration certificate identity, immutable content-addressed URI and digest, calibration dates, a typed minimum/maximum/unit range, and a nonnegative expanded uncertainty with unit and coverage factor. Every favorable BP-101 measurement's `calibrationId` must resolve to that embedded manifest. The evaluator rejects duplicate certificates, an unresolved digest, inverted ranges, use before calibration, or use after its due instant.

The fixture configuration, fixture-harness evidence, and every raw evidence bundle carry immutable artifact identities whose canonical serialization must match their stored digest. Firmware uses a content digest and immutable content-addressed URI. The upstream snapshots, calibration manifest, and complete run are canonically serialized with sorted object keys and hashed; changing embedded content without updating a digest fails, and updating the digest after changing canonical upstream content still fails the validated snapshot comparison.

Records run normal points first, then guarded points, in the frozen temperature/capacitance/value order. A missing, extra, duplicate, reordered, mismatched, stale-calibration, or unsafe measured record fails closed. An interlock trip, unhealthy rail/reference, overload, unexpected ADC code, timer failure, or any other incident is archived as `unavailable`; it never becomes a favorable measurement.

Only a complete measured one-channel matrix makes `sevenChannelEligible` true. That result permits planning the later seven-channel evidence run, not applying power. The return value always keeps `energizedAuthorized: false`; the reviewed bench procedure, competent operator, and apparatus-specific safety review remain separate prerequisites.
