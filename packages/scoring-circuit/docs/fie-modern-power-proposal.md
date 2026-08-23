# Proposal for modern scoring-apparatus power

## Position

The December 2025 FIE Material Rules prescribe a 12 V +/- 5% apparatus supply and refer specifically to VRLA
batteries. Those constraints are historical implementation choices. The sporting requirements are uninterrupted,
safe, deterministic scoring and electrical behavior at the weapon interfaces, none of which inherently requires a
12 V input or lead-acid chemistry.

Our product should use a simpler modern architecture and take its power specification through FIE approval:

- one protected USB-C PD SPR sink accepts a 20 V, 3 A contract from a certified external adapter;
- USB-C also carries native USB 2.0 service data; the PD controller prevents the apparatus rails from receiving initial 5 V or an inadequate contract;
- regulated system, scoring, and 2.5 V reference rails isolate scoring behavior from input variation;
- any required backup function is an external qualified USB-PD UPS or adapter capability; the apparatus contains no battery or charger;
- there is no 12 V compatibility path, input-source multiplexer, or internal battery pack.

This is not compliant with the present m.58 voltage wording. FIE acceptance of the exact design is therefore a product
release dependency, not a future compatibility claim.

## Proposed rule outcome

Replace the prescriptive 12 V and VRLA language in m.44 and m.58 with performance requirements:

1. The apparatus must use a protected extra-low-voltage DC source or a certified external power supply.
2. Loss or transfer of the normal source must not interrupt scoring during a bout.
3. Backup capacity must provide at least the existing minimum runtime under the apparatus's declared maximum load.
4. The manufacturer must declare input range, connector, polarity, power, backup state, and fault indication.
5. Scoring timing and resistance behavior must remain within Annex B limits across the full input range and during
   source transfer.
6. Power, battery, and charging systems must meet the applicable safety, transport, EMC, and regional requirements.

The initial request should preserve the existing five-minute minimum so the discussion stays focused on removing an
obsolete voltage and chemistry mandate rather than renegotiating competition operations.

## Evidence package for FIE SEMI

The FIE rules allow the SEMI Committee to examine a constructor's prototype even before a specific competition and
require a complete apparatus and detailed construction drawing for event approval. Submit:

- the complete USB-PD prototype, certified 20 V, 3 A adapter, declared UPS if one is required, spools, and connections;
- automated timing and resistance reports at input tolerance limits and during source transfer;
- oscilloscope evidence showing no scoring interruption during source removal and transfer;
- input fault, brownout, overvoltage, reverse-polarity, thermal, EMC, ESD, and runtime reports;
- a power architecture drawing showing certified mains isolation outside the apparatus and isolation of scoring from
  display and communications noise;
- proposed replacement wording plus a compatibility statement for existing venue power systems.

Start the technical conversation before freezing the power connector module. Submit the prototype at least six months
before the intended competition, as required by m.46.

## Product gate

Do not claim that the USB-PD source is approved for official FIE competition until the SEMI Committee has accepted that
exact apparatus design. If FIE will not approve it or amend m.58, the power-entry design must be revisited before an
official-event release; the production board will not carry dormant 12 V complexity as insurance.
