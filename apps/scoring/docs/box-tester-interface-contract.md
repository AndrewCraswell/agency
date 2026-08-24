# Tester hardware interface contract

**Contract:** BT-02
**Status:** root review pending; physical/tester release DENY

The executable form is
[`../src/box-tester-interface-contract.ts`](../src/box-tester-interface-contract.ts).
BT-02 depends on completed M0-03, M0-10, and BT-01. It fixes tester interface
identity and rejects any substitution, but does not select a connector, assign
physical contacts, publish a schematic, or authorize hardware work.

| Boundary | Contract |
| --- | --- |
| Reels | `tester.left.reel` maps abstract contacts `A`, `B`, `C` only to `left.A`, `left.B`, `left.C`; `tester.right.reel` maps `A`, `B`, `C` only to `right.A`, `right.B`, `right.C`. Both must be unmistakably and differently keyed. All tester paths are open when unpowered. |
| Piste | `tester.piste` maps separate abstract contact `P` only to the measured `piste` reference. It is not protective earth, chassis, processor ground, or a return for tester logic. |
| Normal stimulus envelope | M4-02's committed 2,500 millivolt source through at least 2,490 ohms is capped at 1,100 microamps. This is a source-side bound only, not a DUT line-state, survival, or scoring claim. |
| Guarded fault/test envelope | BP-102's committed guarded limit is plus or minus 24,000 millivolts for at most 100 milliseconds, capped at 433 microamps and 1,040 microjoules. It is source-envelope arithmetic only, not a clamp, rail, DUT, or board-survival claim. |
| Unresolved DUT boundary | DUT line-state, output-sense, leakage, isolation, and fault-survival limits remain blocked pending BT-03 measured evidence against these source limits. No energized connection, source, sink, output sense, or passing result is authorized. |
| Floating boundary | The relation interface is polarity-independent and floating. It forbids ties to DUT power return, protective earth, tester chassis, and tester logic ground. BT-03 and BT-08 must prove unpowered isolation and no-back-power in both directions. |
| Physical observation | Electrical sensing through a defined output connector is preferred. Calibrated optical and acoustic sensing are permitted observer methods. DUT records are secondary correlation only, never the physical-output oracle. |
| Apparatus power | USB-C PD remains the sole normal external apparatus input, with the planned 20 V, 3 A request. The tester cannot connect to USB-C VBUS, CC, or apparatus power return and has independent power, clock, calibration, and result identity. |

## Misuse and release boundary

Missing or wrong reel cables, an invalid piste tie, an unpowered tester or DUT,
unknown DUT electrical conditions, or absent observer/calibration identity force
`infrastructureError` with open tester paths and no passing result. Connector
selection, mechanical keying implementation, mating parts, harness relief,
unresolved DUT electrical limits, switch architecture, calibration, and
physical-output correlation remain later work.

The executable source binds the exact SHA-256 digest of M0-03's seven-conductor
contract, M4-02's analog-protection screen, and BP-102's guarded-fault source.
Those source bounds close the BT-02 interface-envelope review only. They do not
close the blocked DUT boundary or authorize physical use.

This contract is not a fabrication approval, physical qualification, FIE approval,
or tester-hardware approval.
