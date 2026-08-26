# M4-10 reel-socket selection and physical plug-fit study

Status: `DENY` for procurement and release. The central-apparatus female socket selection is unresolved. This artifact records candidates and evidence gates for a physical study. It does not approve a part, buy a part, or release a footprint.

## Decision

No socket is selected. The previous proposal of OK Fencing `17-2017-03` was incorrect for this role: its manufacturer describes it as an **Epee Socket** used with body wires. It remains a rejected bodywire/fencer-end candidate, not evidence of a central-apparatus female socket.

The current research candidates are Favero `900-09`, identified in the manufacturer's Millennium Reel manual as the **Three sockets connector on reel-case**, and the current Allstar/Uhlmann listing **Allstar spool 3 pin socket**, which has no exact MPN in the listing. Both are reel/spool candidates, not selected central-apparatus parts. Neither has a verified orderable identity, mechanical drawing, or physical fit record for this design.

The study requests `Red` for the apparatus left position and `Blue` for the apparatus right position, but no candidate has a verified manufacturer color suffix or variant code. Supplier confirmation is required before any purchase order is possible.

Color is a service and inspection marker only. It is not a logical signal name and does not encode left/right A/B/C, a scoring output, polarity, protective earth, chassis, or processor ground. Green is intentionally not selected because the current cited manufacturer page does not list it.

Generic triangular 3-pole XLRs are rejected as a substitution. Their familiar microphone geometry is not the FIE reel interface.

## Normative interface to measure

The FIE Material Rules, m.55, specify three 4 mm plug pins arranged in a straight line. The two outer pin offsets from the centre are 15 mm and 20 mm. The fencer-end socket must have a visually verifiable safety device that prevents use unless the plug is correctly inserted and prevents separation during a bout. FIE also limits each spool wire socket-to-socket to 3 ohms and each connecting-cable wire to 2.5 ohms. m.56 calls for a three-core rubber-covered connecting cable for humidity and blows.

M4-10 records the physical positions as `outer-near-15 mm`, `centre`, and `outer-far-20 mm`. It deliberately does not assign those positions to logical A/B/C or `piste`. M0-03 and M4-13 own the released pin map, keying, bonding, and harness record.

## Candidate identities and mating samples

| Role | Candidate catalogue identity | What is frozen | What remains unproven |
| --- | --- | --- | --- |
| Reel-case candidate | Favero, `900-09`, Three sockets connector on reel-case | Official manufacturer item identity in the Millennium Reel manual | Standalone current orderability, central-apparatus role, dimensions, panel cutout, terminal style, plating, retention, contact resistance, mating life, and environmental rating |
| Spool/reel candidate | Allstar/Uhlmann, Allstar spool 3 pin socket | Current catalogue listing and general spool/reel context | Exact MPN, central-apparatus role, dimensions, panel cutout, terminal style, plating, retention, contact resistance, mating life, and environmental rating |
| Rejected bodywire candidate | OK Fencing, `17-2017-03`, Epee Socket Transparent | Manufacturer, MPN, and published color names | It is not evidence for a central-apparatus socket; its dimensions, panel cutout, terminal style, plating, retention, contact resistance, mating life, and environmental rating are also unverified |
| Mating sample | Favero art. `910`, 3-PIN PLUG for floor and body cord | Obtain one lot-identified sample | Fit, insertion depth, retention, and electrical contact with the surviving socket candidate |
| Mating sample | Favero art. `903`, 14 m cable from piste to signalling apparatus with 3-pin plugs | Obtain one lot-identified sample | Fit, insertion depth, retention, and electrical contact with the surviving socket candidate |
| Comparison sample | Allstar/Uhlmann, Allstar spare spool cable (20M) | Obtain one current catalogue sample if available | Fit and interchangeability; no exact MPN or connector drawing is published in the cited listing |

The requested color entries are not selections:

| Apparatus position | Requested manufacturer color | MPN color suffix | Release state |
| --- | --- | --- | --- |
| left | Red | Not published | No candidate selected; supplier confirmation and physical sample required |
| right | Blue | Not published | No candidate selected; supplier confirmation and physical sample required |

Do not convert these colors to `left.A`, `left.B`, `left.C`, `right.A`, `right.B`, `right.C`, or `piste`. Those are the logical nets in the seven-conductor contract.

## Physical plug-fit study

Obtain one lot-controlled sample of each surviving candidate and the Favero 910 and 903 plugs. Keep photographs, lot or article identifiers, and the measured setup with the study record.

For every socket and plug pair:

1. Measure contact diameter, straight-line arrangement, and both outer offsets against the FIE values. Record actual tolerances, not only a pass/fail statement.
2. Mate without force, rocking, or partial insertion. Record insertion depth, full-insertion indication, orientation, and any safety or retention feature.
3. Repeat with the proposed panel stack-up, gasket, strain relief, and terminated harness. Bare-bench fit is insufficient.
4. Apply the axial retention test below and record force, direction, dwell, and failure mode.
5. Monitor continuity while flexing the terminated harness and while applying and removing the retention load.

The current candidate sources do not publish enough mechanical evidence to prove a central-apparatus socket. In particular, the OK Fencing page describes a bodywire socket and cannot be treated as proof of the required role or plug fit.

## Contact, retention, and cycle targets

FIE publishes the whole-wire resistance limits, not a contact-resistance limit for this socket. The following are engineering targets for the physical gate, not FIE requirements or OK Fencing claims:

| Measurement | Target |
| --- | --- |
| Initial resistance per mated contact | No more than 50 milliohms |
| Post-qualification resistance per mated contact | No more than 100 milliohms |
| Axial retention | No uncommanded separation under a 30 N axial pull held for 10 seconds |
| Mating life | 5,000 complete insertion and withdrawal cycles |

The cycle test passes only if there is no latch or retention failure, intermittent open, short, cracked housing, loosened terminal, unacceptable wear, loss of full-insertion indication, or contact resistance above the post-qualification limit. The test fixture must measure the socket, plug, panel, and harness as an assembly.

## Harness termination and electrical boundary

Each socket is a three-conductor branch. The terminal method is not frozen until the selected part's terminal style is confirmed; use the vendor-approved solder or crimp process and a local strain relief so insertion force is not carried by the terminals. M4-13 owns the released three-core rubber-covered cable, gauge/current calculation, physical pin map, keying, and bonding.

Before release, the harness study must show:

- 100% continuity from every socket contact to its harness endpoint.
- 100% open/short checks between the three contacts and adjacent sockets.
- Mated-interface contact resistance measured separately from wire resistance.
- No bond to protective earth, chassis, or processor ground unless a later approved EMC record requires it.

The `piste` conductor is the conductive piste reference. It is not protective earth, chassis, or processor ground.

## Sweat and salt exposure plan

This screen has not been run. It covers the socket, mating plug, terminal area, panel interface, and harness strain relief, not the powered electronics assembly.

Use a bounded aqueous 0.9% sodium-chloride screening solution. This is an engineering screen, not a claim of compliance with a named corrosion standard. Before execution, the reliability owner must freeze solution pH, wetting volume, fixture, and laboratory record.

1. Record baseline appearance, full insertion, retention, continuity, and per-contact resistance.
2. Apply the controlled solution to mated and unmated contact areas without immersing the electronics assembly.
3. Run 10 documented wet/dry cycles, then allow 24 hours of dry recovery.
4. Repeat insertion, retention, continuity, and contact-resistance measurements.
5. Inspect contacts, terminals, plating, latch, seal, panel interface, and strain relief for corrosion, residue, swelling, cracks, or looseness.

Pass requires no visible corrosion product or insertion-blocking residue, no intermittent continuity or short under flex and retention checks, each contact at or below 100 milliohms, and retained full-insertion and service-identification behavior.

## Evidence gates and explicit unknowns

The selection remains `DENY` and unresolved until all of these are complete:

- An exact, current, orderable female socket intended for the reel or central apparatus is identified. A bodywire or fencer-end socket such as OK Fencing `17-2017-03` is not acceptable evidence for this role.
- The supplier confirms the exact MPN, role, color suffix or variant code where applicable, and supplies lot-controlled samples.
- The Favero 910 and 903 mating samples, and the Allstar comparison cable if available, are physically retained and identified.
- Actual 4 mm, straight-line, 15 mm, and 20 mm geometry is measured on the proposed mate, with tolerance and orientation recorded.
- Panel-stack-up fit, full insertion, visual indication, and axial retention are tested with the actual harness termination.
- The 5,000-cycle test and the sweat/salt screen are completed with contact resistance measured before and after.
- CAD footprint, panel cutout, terminal process, physical pin map, keying, and bonding are frozen in the M4-13 release record.

Known unknowns are the candidate role and orderability, exact MPN where absent, color suffixes, socket dimensions, CAD, panel cutout, terminal style, contact material or plating, ingress or salt rating, retention force, contact resistance, mating life, and compatibility with Favero or Allstar plugs. The FIE rules do not supply the missing socket-specific limits. The 5,000-cycle, 50 milliohm, 100 milliohm, and 30 N values are engineering targets only.

## Sources

- [FIE Material Rules, December 2025 English edition](https://static.fie.org/uploads/38/190667-book%20m%20ang.pdf), m.55 and m.56.
- [Favero Millennium Reel technical information and spare-parts manual](https://www.favero.com/get_file.php?id=51&lang=_en), official item identity Art. 900-09, three sockets connector on reel-case, plus Art. 910 and Art. 903.
- [Favero current fencing reel, cables, connectors and accessories catalogue](https://favero.com/en1_fencing_winding_cables_reel_spools_accessories_and_equipment-18.html), articles 903, 906, and 910.
- [OK Fencing product 17-2017-03](https://www.okfencing.com/product-220.html), current product identity and published color options; its description identifies an epee/bodywire socket, so it is rejected for the central-apparatus role.
- [Allstar/Uhlmann scoring equipment catalogue](https://allstaruhlmann.com/product-category/scoring-equipment/), current 3-pin socket, retaining clip, and 20 m spare spool cable listings.
