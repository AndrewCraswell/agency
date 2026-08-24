# M4-10 reel-socket selection and physical plug-fit study

Status: `DENY` for production procurement and release. M4-10 selects the exact **central-apparatus component**, but physical compatibility and the production panel remain unqualified.

## Selected central-apparatus port

Use three insulated, discrete Stäubli Electrical Connectors `SLB4-F/A` female 4 mm panel sockets to make each one FIE central-apparatus port. The selected exact parts are:

| Apparatus position | Part per contact | Quantity per FIE port | Color | Current evidence |
| --- | --- | ---: | --- | --- |
| left | Stäubli `23.3070-22`, SLB4-F/A | 3 | Red | Exact MPN, manufacturer data sheet and a current distributor listing |
| right | Stäubli `23.3070-23`, SLB4-F/A | 3 | Blue | Exact MPN, manufacturer data sheet and current distributor listings |

This is not an approval to build, purchase production quantity, or release a footprint. It resolves the previously missing exact component, color code, and individual-socket drawing. It does not prove that a Favero or Allstar fencing plug mates safely with this socket. `procurementAuthorized` remains false in the machine-readable artifact.

All three sockets in a port use that port's color. Red and blue identify the apparatus position for service and inspection only. They do not identify any logical net, polarity, protective earth, chassis, or processor ground. The released physical pin map remains owned by M0-03 and M4-13.

## FIE geometry and drawing contract

The local August 2026 FIE Material Rules, m.55.6, require the central electrical apparatus to have sockets for the three-pin connecting-cable plugs. The pins are 4 mm diameter in a straight line, with outer contacts 15 mm and 20 mm from the center. m.55.4's visually verifiable retention device applies to the fencer-end socket, not by its text to the central-apparatus socket. m.55.5 limits each connecting-cable wire to 2.5 ohms; m.56.3 calls for a three-core rubber-covered cable. USB-C PD is outside this connector selection and remains unchanged.

The panel drawing must use these coordinates in millimetres, with the centre contact at `(0, 0)`:

| Physical contact | X | Y |
| --- | ---: | ---: |
| outer-near-15 mm | -15 | 0 |
| centre | 0 | 0 |
| outer-far-20 mm | 20 | 0 |

For each Stäubli socket, the manufacturer documentation provides a 4 mm plug system, 12.2 mm panel cutout, 14.5 mm front flange, M12 x 0.75 threaded panel mount, supplied nut and washer, and a 4.8 mm by 0.8 mm flat connecting tab. The item data sheet depicts a 30.5 mm overall length, but the manufacturer main catalogue depicts 30.7 mm. That conflict is an explicit blocker: no enclosure clearance envelope, footprint, or production tolerance may use either value until Stäubli identifies the controlling drawing revision or a received sample is measured. The drawing owner must preserve the FIE contact centres, then apply the resolved individual-hole drawing and document terminal, harness, enclosure, and adjacent-port clearance.

The selected socket's published contact material is CuZn with nickel surface treatment. Its published electrical ratings are 24 A and 1000 V CAT III. Those ratings are not a fencing durability, corrosion, plug-fit, or FIE-homologation claim.

## Acquired primary-source record

The two manufacturer PDFs below are vendored as an immutable engineering record. Their SHA-256 values are verified by the M4-10 unit test. They establish the selected part-family identity and mechanical interface only; neither document proves that a fencing plug fits or that the part is qualified for a central-apparatus panel.

| Snapshot | SHA-256 | Relevant pages | What it establishes |
| --- | --- | --- | --- |
| [Stäubli SLB4-F/A data sheet](evidence/m4-10/staubli-23-3070-en.pdf) | `DB2C84AC0D3FFBB1F29FEE2CE8BE375E8E176F3183BA8B1540379D51176DA80F` | 1 | `23.3070-*` family, rigid 4 mm panel socket, contact material, supplied hardware, and terminal |
| [Stäubli Test accessories main catalogue](evidence/m4-10/staubli-tm-main-11014124-en.pdf) | `3B3E7F6CDC234365D8C413F467EFF08B3D09C176956EC15772DC0DBCCB20CDED` | 6, 82 | Color-code mapping `22` red and `23` blue, `23.3070-*` SLB4-F/A panel socket, and its 4 mm mating-interface statement |

Captured from the manufacturer URLs on 2026-08-24. Stäubli reserves the right to change these documents, so any later part substitution must reacquire and re-review primary evidence rather than inherit this record.

The snapshots also disclose a material discrepancy: the item data sheet shows a 30.5 mm overall length while catalogue page 82 shows 30.7 mm. M4-10 deliberately records this as unresolved rather than choosing a value. It is not an error band or a permissible tolerance.

## What physical evidence still blocks release

The Stäubli documentation describes mating with spring-loaded 4 mm plugs with a rigid insulating sleeve. The Favero `910` plug documentation identifies an orderable 3-pin fencing plug, but does not establish that construction, sleeve clearance, insertion depth, or force. FIE nominal geometry is necessary, but does not prove interchangeability.

Before a production decision, the lab must receive and record lot IDs and photographs for one sample of each selected color and these mating samples:

| Sample | Purpose |
| --- | --- |
| Favero `910`, 3-pin plug | Direct plug fit and contact test |
| Favero `903`, 14 m reel-apparatus cable | Cable-end plug fit test |
| Allstar/Uhlmann spare spool cable, if available | Cross-brand comparison only |

For each selected-socket and plug pair, record all of the following:

1. Actual contact diameter, straight-line geometry, both offsets, and orientation.
2. Insertion without force, rocking, or partial engagement; depth and full-insertion visibility.
3. Panel-stack-up fit with the actual nut, washer, insulation, harness terminal, strain relief, enclosure, and intended adjacent-port clearance.
4. Axial pull of 30 N for 10 seconds, direction, movement, and failure mode. This is an engineering target, not an FIE or Stäubli requirement.
5. Continuity during cable flex and pull, separately measuring mated-contact resistance from wire resistance.

The qualification gate also retains the existing 5,000 mating-cycle and controlled 0.9% sodium-chloride wet/dry screen. Both need the actual full assembly. The 50 milliohm initial limit, 100 milliohm post-qualification limit, 30 N pull, and 5,000-cycle count are project engineering targets, not claims by FIE, Favero, Allstar, or Stäubli.

## Rejected or comparison evidence

Favero `900-09` is a documented reel-case three-socket connector, not a selected or documented central-apparatus part. Allstar/Uhlmann lists an orderable spool 3-pin socket without an exact MPN or drawing. These remain useful comparison samples, not substitutes for the selected Stäubli components.

OK Fencing `17-2017-03` is an epee/bodywire socket and is rejected for this central-apparatus role. Generic triangular three-pole XLR is rejected because it does not have the FIE straight-line three-contact geometry.

## Sources

- Local authoritative evidence: [FIE Material Rules, August 2026 English edition](fie-material-rules-2026-08-en.pdf), m.55 and m.56.
- [Stäubli SLB4-F/A manufacturer data sheet](https://www.staubli.com/content/dam/ecs/technical-documentation/datasheets/TM/23.3070_en.pdf): family `23.3070-*`, 4 mm socket, contact material and terminal.
- [Stäubli Test accessories main catalogue](https://www.staubli.com/content/dam/ecs/catalogs-brochures/TM/TM-Main-11014124-en.pdf): individual-socket mechanical drawing and colour family.
- [Stäubli `23.3070-22` red distributor listing](https://www.buerklin.com/en/p/staeubli-electrical-connectors/laboratory-connectors/23-3070-22/22F272/): exact red MPN, dimensions, and current orderability.
- [Stäubli `23.3070-23` blue distributor listing](https://www.buerklin.com/en/p/staeubli-electrical-connectors/laboratory-connectors/23-3070-23/22F275/): exact blue MPN, dimensions, and current orderability.
- [Favero current reels, cables and connectors catalogue](https://www.favero.com/en1_fencing_winding_cables_reel_spools_accessories_and_equipment-18.html): `910` plug and `903` reel-apparatus cable identities.
- [Favero Millennium Reel technical manual](https://www.favero.com/get_file.php?id=51&lang=_en): `900-09` reel-case comparison part.
- [Allstar/Uhlmann scoring equipment catalogue](https://allstaruhlmann.com/product-category/scoring-equipment/): spool socket and comparison cable listing.
