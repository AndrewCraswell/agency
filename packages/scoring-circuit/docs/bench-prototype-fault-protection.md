# BP-102 connector-side fault protection

## Decision

BP-102 freezes the one-channel paper design at the connector boundary. It
selects the existing `TPD4E05U06DQAR` shunt, 22-ohm
`CRCW060322R0FKEAHP` series resistor, `TMUX1112PWR`, and isolated
`ADA4177-1BRZ` buffer chain. It also freezes the separate guarded-force lane:
a normally-open, externally interlocked fixture relay drives `LINE` only through
the 56-kohm, 1-percent `CRCW120656K0FKEAHP` resistor.

```text
J_FIXTURE pin 1 LINE -> TPD4E05U06DQAR pin 1 LINE_SHUNT
J_FIXTURE pin 1 LINE -> 22 ohm -> TMUX1112 QUIET -> ADA4177-1BRZ
TPD4E05U06DQAR pins 3 and 8 -> SGND (canonical SCORING_SGND)
external force source -> external normally-open relay -> J_GUARDED_FORCE pin 1 FORCE -> 56 kohm guard -> LINE
J_FIXTURE pin 2 and J_GUARDED_FORCE pin 2 -> SGND
ADA4177-1BRZ -> 20 ohm -> ADS8881 AINP
```

The guarded lane is a source-energy limit, not a fault-survival claim. The
normal source and guarded force are mutually exclusive.

`J_FIXTURE` pin 3 is explicitly `ESD_RETURN_RESERVED_NC`: it is electrically
unconnected and no separate `ESD_RETURN` net is released. The current circuit
ties both TPD ground pins directly to `SGND`. Any later split-return proposal
must define its controlled tie point and receive a new review; the reserved pin
cannot be populated or connected from this contract.

## Connector separation

The normal fixture uses the male Molex `43650-0300` three-position 3.0-mm
Micro-Fit header and mate `43645-0300`. The guarded force path uses the male
JST `B2B-PH-K-S(LF)(SN)` two-position 2.0-mm PH header and mate `PHR-2`.
The different pitch, position count, shroud, polarization, and mating family
make the two harnesses physically incompatible. This is connector-family
evidence only. Cable drawings, pin-one orientation, strain relief, drill
pattern, and an assembled keying test remain required before connection.

## Guarded envelope

With the minimum-tolerance 55.44-kohm guard, the maximum permitted 24-V,
100-ms pulse is limited to 0.4329 mA, 10.39 mW, and 1.039 mJ at the source.
The fixture must hold at least ten seconds between guarded pulses.

Those values allocate the entire voltage to the guard resistor. They give no
credit to the TPD, buffer, ADC, rails, clamps, thermal behavior, recovery, or
component ratings. They do not approve sustained plus or minus 24 V, surge,
ESD, EFT, brownout, or any direct connection to a weapon, piste cable, or
force source.

## Required evidence gates

Before a guarded pulse, the externally interlocked relay must be normally open
until a fixture permit, armed current trip, healthy watchdog, disabled source,
disabled sink, observed mutual exclusion, dwell timer, and inter-pulse timer
all agree. Any disagreement, rail/reference fault, overload, unexpected code,
or missing trace produces an unavailable record, never a favorable measurement.
Measured records explicitly require healthy positive and negative rails, a
healthy reference, no observed overload, and an expected ADC code. These are
typed Boolean evidence, not inferences from a trace or absence of a fault code.

Unpowered behavior remains **unvalidated and denied**. A review needs plus and
minus guarded-pulse traces at `LINE`, post-TPD, buffer input/output, ADS8881
AINP, and analog rails; component rating margins using measured voltage/current/
power/energy; and post-pulse leakage, continuity, startup, reference, ADC, and
buffer-recovery records. Powered and unpowered cold, ambient, and hot runs are
required, with the normal source disabled during every guarded pulse.

The executable, fail-closed decision is
[`bench-prototype-fault-protection.ts`](../src/bench-prototype-fault-protection.ts).
It rejects altered canonical data and mutable upstream connector/fault evidence.
Its authority remains `releaseState: deny`: no schematic integration,
fabrication, sustained-fault, unpowered-fault, or recovery approval is granted.
The selected-part evidence rows include their primary manufacturer links and
must remain unique in the readiness BOM. The validator also binds this decision
to BP-100's frozen normal/guarded chains and exact selected references.
The nine authoritative identities are independent deep-frozen literals. A
live BOM row cannot establish its own expected MPN, package, or link: missing,
duplicate, sentinel-valued, or mismatched rows are rejected. The same check
runs during module initialization, so drift that exists before BP-102 loads
cannot be adopted as the contract authority.
