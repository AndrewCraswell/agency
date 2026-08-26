# Reel-socket selection and plug-fit study

M4-10 research snapshot, 2026-08-22. This is a selection and test plan, not
physical qualification. No XUB-G socket, fencing body-cord plug, harness, or
panel assembly has been received or tested for this project.

## Decision status

`Stäubli XUB-G 66.9684-*` remains the candidate family for the six body-cord
panel sockets: left A/B/C and right A/B/C. This study now fixes the exact
**bench-sample candidates** and records them in the machine-readable readiness
manifest as sample suffixes only. The manifest still does not select a
production-approved part: CAD, harness-keying, plug-fit, salt/sweat, retention,
and endurance evidence remain open.

The final production selection **cannot close in M4-10**. The open work is
material, not procurement paperwork:

1. M0-03 defines the logical A/B/C conductors but expressly does not bind them
   to connector contacts, harness wires, or panel order. SIG-01 through
   SIG-06 and M4-13 own that physical binding. FIE names pin geometry and
   weapon functions, but does not assign the project labels A/B/C or panel
   colours.
2. FIE specifies the spool-end body-cord plug as a three-pin male plug with a
   centre pin, a pin 15 mm from it, and a pin 20 mm from it. It does not
   identify the plug's contact construction as a Stäubli-compatible
   spring-loaded 4 mm plug with a rigid insulating sleeve. Stäubli makes that
   compatibility condition explicit for XUB-G. A dimensional drawing and
   physical samples from the intended body-cord population must therefore
   prove insertion, spacing, shrouding, and retention.
3. The FIE rules require a safety device that prevents the bodywire from
   becoming unplugged during a bout. XUB-G is a friction socket, not a
   documented fencing retention system. The panel needs an independently
   designed and tested cord retainer or shroud before the sockets can claim to
   meet that requirement as an assembly.

### Exact bench-order candidates, not a released BOM

The M4-10 sample order is intentionally simple: red identifies the left
fencer's three-socket cluster and green the right fencer's cluster. It does
not encode A/B/C. The physical positions remain `P15`, `P0`, and `P20` until
M4-13 closes the SIG-01 physical map and harness pinout under the M0-03
logical contract.

| Fencer | Positions | Exact manufacturer part number | Colour | Quantity fitted per apparatus |
| --- | --- | --- | --- | ---: |
| Left | P15, P0, P20 | Stäubli XUB-G `66.9684-22` | Red | 3 |
| Right | P15, P0, P20 | Stäubli XUB-G `66.9684-25` | Green | 3 |

For the study, buy 12 of each MPN, split across two received lot/date codes
where that is available: nine per colour build three paired panel assemblies;
the remaining three per colour are one mated-corrosion coupon, one
unmated/capped-corrosion coupon, and one destructive-inspection coupon. A
single available lot is a recorded limitation and cannot close the supply
consistency gate.

Red/left and green/right are product conventions only. FIE prescribes neither
this side assignment nor socket colours. Do not order production material or
change the readiness manifest's candidate or approval state from this table;
the manifest records these two suffixes as bench samples only. Production
remains denied until M4-13 closes the A/B/C physical binding and every physical
gate below passes on the intended body-cord plugs. If the product convention
later changes to a colour per circuit, that is an M4-13 decision constrained by
M0-03, not an inferred fencing standard.

## Manufacturer evidence

The following information is from Stäubli primary documentation, checked on
2026-08-22.

The Stäubli family page, datasheet, and catalogue were rechecked on 2026-08-23;
no manufacturer-published XUB-G socket contact-resistance or cycle rating was
found, so the open physical gates remain unchanged.

| Property | Evidence and selection consequence |
| --- | --- |
| Family and interface | XUB-G, order-number stem `66.9684-*`; insulated, rigid 4 mm universal socket accepting spring-loaded 4 mm plugs with rigid insulating sleeve. The mating-plug construction is a test gate, not an assumption. |
| Construction | Machined brass; electrical contact base material CuZn and nickel surface treatment. Stäubli does not state the insulating-body polymer or a nickel thickness in the cited family data, so neither is a controlled material or corrosion claim. |
| Electrical rating | The family datasheet states 1000 V CAT II and 20 A. The current main catalogue qualifies that as 600 V CAT II/20 A when surface-mounted and 1000 V CAT II/20 A when flush-mounted or pressed in. These ratings do not establish fencing signal accuracy, low-level contact resistance, or sweat durability. |
| Rear termination | M4 threaded bolt. Use a ring terminal and locking hardware on a replaceable harness. Do not solder a panel socket or let a PCB pad carry body-cord insertion load. |
| Assembly torque | XUB-G assembly instruction MAH507 states a tightening torque no greater than 40 N cm. Treat that as a socket-assembly limit, record the actual value, and do not use it as the torque for an unselected ring-terminal hardware stack. M4-13 must set that stack's fastener specification. |
| Mounting | Surface mounting, flush assembly, or press-in installation in a pre-drilled plastic or metal panel; Stäubli lists press-in tool MB4-S. The drawing calls out a 4 mm plug system, M4 rear stud, 40 mm overall axial envelope, 1.5-12 mm panel-thickness range, and mounting bores of 8 mm, 12 mm, and 11.5 mm for its shown variants. The final drawing must be imported and dimension-checked for the chosen mounting mode before enclosure release; this document does not turn the catalogue illustration into a production hole callout. |
| Unused-socket protection | Optional SD-XUB cap is described as closing an unplugged, unconnected socket to IP67. This does not rate the assembled apparatus, a mated body-cord connection, or a sweat-exposed live socket as IP67. |
| Color suffixes | Standard: `-20` green-yellow, `-21` black, `-22` red, `-23` blue, `-24` yellow, `-25` green, `-27` brown, and `-29` white. Optional: `-26` violet and `-28` grey. Ask Stäubli for lead time and regional availability before purchase; optional status is not stock confirmation. |
| Official CAD | Stäubli's CAD catalogue lists XUB-G article `66.9684`, CAD part `50050252`, with IPT, IGES, SAT, and STEP download formats. CAD availability is therefore manufacturer evidence, but the current manifest must remain `pending` until the exact file is downloaded, version/checksum recorded, and independently compared with the selected mounting drawing. |

Primary sources:

- [XUB-G English family datasheet](https://www.staubli.com/content/dam/ecs/technical-documentation/datasheets/TM/66.9684_en.pdf)
- [Stäubli test accessories main catalogue, XUB-G entry](https://www.staubli.com/content/dam/ecs/catalogs-brochures/TM/TM-Main-11014124-en.pdf)
- [Stäubli color-code assembly instruction](https://www.staubli.com/content/dam/ecs/technical-documentation/assembly-instructions/TM/TM_MA153-de.pdf)
- [Stäubli XUB-G assembly instruction MAH507](https://www.staubli.com/content/dam/ecs/technical-documentation/assembly-instructions/TM/TM_MAH507-de.pdf)
- [Stäubli CAD catalogue](https://standstep.ec.staubli.com/catalog/show/caddata/%7CTM%7CTMline%7C)

### Supply, lifecycle, and counterfeit controls

The manufacturer is still publishing XUB-G and its assembly instruction; that
is evidence of an orderable current family, not a formal longevity commitment.
Stäubli's test-and-measurement distributor page names regional distributors.
At the 2026-08-22 check, Bürklin listed the exact red `66.9684-22` and green
`66.9684-25` variants, including the 12 mm installation diameter, M4 screw
termination, nickel-plated contact, 20 A rating, and an availability snapshot.
That snapshot is not an allocation, lead-time commitment, or lifetime buy
recommendation.

For sample and any later production purchase, use Stäubli direct or a seller
confirmed by Stäubli as authorised for the purchase region. Retain the order
confirmation, distributor name, MPN, received lot/date code, country of
origin, packaging, and photographs of markings. Reject broker, marketplace,
or mixed-lot material without traceability. At EVT and before a production
release, obtain written availability/PCN/EOL contact information for both exact
suffixes and re-check a second authorised channel. This is a counterfeit and
supply-continuity control; it is not evidence that a second source is
intermateable or approved.

- [Stäubli test-and-measurement distributor list](https://www.staubli.com/de/de/electrical-connectors/produkte/t-m-products/t-m-distributors.html)
- [Bürklin `66.9684-22` listing](https://www.buerklin.com/de/p/staeubli-electrical-connectors/laborsteckverbinder/66-9684-22/86F9165/)
- [Bürklin `66.9684-25` listing](https://www.buerklin.com/en/p/staeubli-electrical-connectors/laboratory-connectors/66-9684-25/86F9168/)

## Fencing-interface constraints and evidence limits

The local [FIE Material Rules, August 2026](../../../apps/scoring/docs/specifications/fie-material-rules-2026-08-en.pdf)
are the normative source. Its foil bodywire rules on printed pages 33-34 and
epee bodywire rules on printed pages 34-35 specify the spool-end three-pin
plug's centre, 15 mm, and 20 mm connections, a transparent plug, insulation
against humidity, 1 ohm maximum per bodywire conductor, and a security device
where necessary. Sabre uses the specified foil bodywire. These rules define
the interface constraints, but do not name XUB-G, the 4 mm spring geometry,
socket color, a panel layout, socket contact resistance, insertion force, or
socket cycle life.

The local [Favero FA-15 user manual](../../../apps/scoring/docs/specifications/manuals/favero-fa15-user-manual-en.pdf)
is prior art only. Its printed page 17 describes a seven rear-socket
short-circuit test. It is useful as a fixture idea, but provides no XUB-G
part number, plug drawing, contact-plating evidence, retention target, or
compatibility evidence. Do not infer any of those facts from the FA-15.

The repository's Skewered reference is limited to an explicit product boundary:
our replay UI must not copy it. It contains no local Skewered connector drawing,
part number, plug-fit observation, or corrosion evidence. It is therefore not
a source for this selection and no Favero or Skewered compatibility is claimed.

## Panel and harness proposal

Until M4-13 closes the SIG-01 physical binding, call the physical locations
`P15`, `P0`, and `P20`, based on the FIE plug geometry, rather than silently
declaring which is A, B, or C. Build each three-socket cluster from a hardened
locating template validated against the samples, with a recessed
non-conductive bezel that protects the insulating sleeves and makes the
cluster orientation unambiguous. Give the front panel durable `LEFT`/`RIGHT`
and A/B/C markings only after the M4-13 map review is signed off.

Each socket's M4 stud should join a short, serviceable internal lead through a
ring terminal, a serrated locking washer, a torque-marked nut, and insulated
strain relief. Route the three leads from each panel module to one distinct,
keyed six-position harness connector. Use physically different keying or
gender for left and right, a dedicated panel-module connector for each, and
positive wire identification at both ends. No adapter or reversible
intermediate harness may make left/right or A/B/C exchange possible. The
final pinout, bonding/ESD route, conductor gauge, terminal stack-up torque,
and connector current rating belong to M4-13.

### Prototype PCB-faceplate cassette

For an enclosure-fit and whole-plug prototype, a two-piece PCB cassette is a
reasonable alternative to machining a complete custom chassis. This is a
prototype construction method, not a change to the XUB-G production
candidate or an approved production footprint.

Use a precision 1.6 mm insulating faceplate, orderable as a bare FR4 PCB with
no copper near the sockets, over a generous non-precision opening in a stock
enclosure. A separate connector PCB behind the faceplate receives the socket
tails and connects through a keyed service harness to the scoring electronics.
Four M3 fasteners and spacers join the faceplate, enclosure, and connector
PCB so plug insertion, withdrawal, and cable loads are reacted by the
cassette and enclosure rather than the main scoring PCB.

Electro-PJP `3253/PCB-#` is the exact prototype socket candidate for this
construction. Manufacturer documentation identifies it as an insulated
vertical-PCB 4 mm female socket with a 1.9 mm diameter by 20.5 mm tail, PA6
insulation, and a nickel-coated brass contact. Its drawing calls for an
11.6 mm `+0.1/-0 mm` insulating-panel bore, a 13.5 mm maximum front-body
diameter, and an insulating panel no thicker than 3.0 mm. These dimensions
make the nominal 15 mm nearest-centre spacing possible, but leave only 1.5 mm
between adjacent 13.5 mm front bodies. The drawing and received samples must
set the connector-PCB plane and spacer length; this study does not release an
axial stack-up from catalogue dimensions alone.

- [Electro-PJP 3253/PCB manufacturer product page](https://www.electro-pjp.com/en/Product/o4mm-safety-banana-socket-o1-9mm-x-205-mm-pin-connexion-vertical-pcb-setting-up/)
- [Electro-PJP 3253/PCB manufacturer drawing](https://cdn-reichelt.de/documents/datenblatt/D100/EPJP_3253-PCB_DB-EN.pdf)

Define the socket pattern once as a single front-view cassette footprint,
using `P0` as the origin. Do not place three independent socket footprints by
eye or mirror the asymmetric pattern for the opposite fencer.

| Feature | Front-view X | Front-view Y | Status |
| --- | ---: | ---: | --- |
| `P15` socket axis | -15.00 mm | 0.00 mm | FIE nominal geometry |
| `P0` socket axis | 0.00 mm | 0.00 mm | Footprint origin |
| `P20` socket axis | +20.00 mm | 0.00 mm | FIE nominal geometry |
| Outer-axis span | 35.00 mm | 0.00 mm | Derived from the FIE offsets |
| Left cassette fasteners | -29.00 mm | +/-11.50 mm | Prototype starting location |
| Right cassette fasteners | +29.00 mm | +/-11.50 mm | Prototype starting location |

A `68 mm x 32 mm` faceplate with four 3.2 mm M3 clearance holes at the
starting locations above leaves useful edge margin and can cover a rough
enclosure access window. The outline, access window, fastener locations,
socket land pattern, spacer length, bezel recession, and plug-retention
feature remain provisional until the received socket and intended plugs are
measured. The connector PCB must include local mechanical attachment; the
three solder tails alone may not locate the PCB or carry service load.

The assembly fixture is the intended three-pin fencing plug, backed by a
hard gauge or measured master where available:

1. Bolt the faceplate and connector PCB loosely into the cassette fixture.
2. Insert all three sockets through the faceplate and into the connector PCB.
3. Fully mate an inspected fencing plug so its three rigid pins establish the
   working `P15`/`P0`/`P20` relationship; do not use three loose laboratory
   banana plugs as the alignment master.
4. Tighten the cassette fasteners and tack, inspect, then solder the socket
   tails while the plug remains fully seated and unloaded.
5. Allow the joints to cool before withdrawing the plug, then repeat the
   whole-plug fit, flex-continuity, and retention checks.

The plug is an assembly aid, not dimensional evidence. Record the plug make,
model, lot where available, measured pin diameters and offsets, socket sample
identity, finished centre positions, and whether soldering caused movement.
Because the 3253/PCB has a safety-socket collar not specified by FIE, the
whole molded fencing plug must seat without collar, shroud, or bezel
interference before this prototype can pass the fit gate. Passing this
prototype does not approve 3253/PCB for production; corrosion, retention,
endurance, serviceability, and intended-plug-population gates still apply.

The retention feature must attach to the bezel/chassis, never to the PCB or
the M4 electrical terminal. It must prevent a loaded cord from separating or
partially withdrawing during a bout while preserving access for normal
disconnect. Test a positive cord clip, bridge, or approved equivalent with the
actual plug. Do not treat an SD-XUB dust cap as a retention feature.

## Physical qualification protocol

All values below are project acceptance targets. They are intentionally not
presented as Stäubli ratings or FIE limits. Test at least three complete
left/right panel assemblies, made from at least two received date or lot codes
when available, plus two sacrificial socket-and-harness coupons for destructive
inspection. Record socket suffix, lot/date code, plug manufacturer and model,
panel material, mounting method, M4 torque, harness parts, test operator,
instrument serial/calibration, ambient temperature/humidity, and photographs.

### Sample and gate matrix

| Gate | Samples and conditions | Required record | Pass outcome | Deny outcome |
| --- | --- | --- | --- | --- |
| Drawing and incoming | All 24 received sockets; official STEP/drawing; markings, colour, M4 stud, and received lots | Drawing revision/checksum, source, lot/date, photos, dimensions | Chosen mounting variant independently matches sample and drawing | Any marking, geometry, or traceability discrepancy; no enclosure tooling |
| Whole-plug fit | Three paired panels (P15/P0/P20); each intended foil, epee, and sabre body-cord make/model, three plugs per population where obtainable | Pin and sleeve dimensions, insertion depth, orientation, 20 manual mates/socket, photos | Every three-pin plug seats together without force, exposed contact, rotation, or a possible reversed/single-pin connection | One intended plug does not safely mate as a three-pin assembly; do not claim fit |
| Baseline and flex | Every fitted path, ten mates per position, plus 60-second maximum-angle flex | Calibrated four-wire 1 A readings and continuity trace | Each reading at or below 50 milliohms and no path drifts more than 20 milliohms from its pre-stress median | Open, intermittent, or resistance failure |
| Retention | Each of the three paired panels with the candidate chassis retainer; 100 axial/lateral load cycles | Breakaway force, applied force, 1 kHz continuity trace, deformation photos | No separation, partial withdrawal, or electrical failure at lower of 40 N and 80% of measured retainer breakaway | Any separation, partial withdrawal, or unreviewed reduction of target |
| Sweat and salt screen | One mated and one unmated/capped coupon of each colour | Method, solution, exposure, recovery, before/after resistance and photos | Existing resistance, mating, retention, material, and marking criteria all pass after 24 h 35 C artificial sweat plus 24 h recovery and 48 h 35 C neutral salt fog | Green/red corrosion product, nickel blistering, crack, swelling, torque loss, or electrical failure |
| Endurance | One socket at each P15/P0/P20 position in both colours with actual intended plug | 1,000-cycle EVT screen; 10,000-cycle DVT run; readings each 1,000 cycles and retention/flex each 2,500 | All interval electrical and retention criteria pass without base-metal exposure or fretting debris | Any unexplained resistance step, wear-through, loosening, or retention failure |

The gate result is binary for readiness: an untested row is **deny**, not a
pass by analysis. A passing M4-10 study still does not release the CAD,
connector-module drawing, harness, or production BOM; those remain M4-11
through M4-14 work.

### 1. Incoming inspection and mechanical fit

1. Check the received suffix, color, marked part, insulation condition,
   contact bore, and M4 stud against the manufacturer drawing. Download the
   official STEP file and independently overlay/check its selected mounting
   variant before cutting enclosure tooling.
2. Make the P15/P0/P20 template from the actual FIE-conforming body-cord plug
   drawing, then verify it with a sample of each intended plug brand and weapon
   type. Measure pin diameters, sleeve outside diameters, pin spacing,
   insertion depth, and the space required for the plug's locking hardware.
3. Mate and unmate each plug at least 20 times by hand. With plug fully
   inserted, verify no metal plug contact is touchable from the intended user
   approach, no insulating sleeve or panel label is damaged, and no socket
   rotates, cracks, or loosens.

Pass only if every intended plug fully mates without forcing, all three pins
seat together in the correct cluster, the retainer can be engaged and released
without touching a live contact, and the physical pattern prevents a 180-degree
or single-pin misconnection. A failure to prove the whole three-pin pattern is
a selection failure even if one 4 mm pin fits one socket.

### 2. Baseline continuity and contact resistance

Use a calibrated four-wire milliohm meter with a defined 1 A DC test current,
or record an equivalent method with lead-zero verification. Measure from each
socket's mating interface through its M4 stack and harness termination to the
module connector. Record ten mate/unmate readings per position before stress,
after each exposure, and after cycling. Measure the actual body-cord plug with
its pin, not a laboratory banana plug alone.

The project target is 50 milliohms maximum per socket-to-harness path at every
reading, no reading above 20 milliohms from its own pre-stress median, and no
intermittent/open reading during a 60-second controlled cable-flex test. This
is an internal allocation beneath the FIE 1 ohm bodywire-conductor limit, not a
claim that it measures the complete fencer, cord, reel, and piste path.

### 3. Retention, cable flex, and partial-withdrawal safety

With the proposed chassis retainer engaged, apply axial and lateral loads using
the actual body cord and a force gauge. Establish the normal user removal force
first, then perform 100 load cycles at the lower of 40 N or 80% of the measured
retainer breakaway force. During and after the cycles, monitor all three lines
with a continuity logger at at least 1 kHz while flexing the cord through the
maximum declared panel exit angle.

Pass only if the plug neither separates nor partially withdraws, no line opens
or intermittently exceeds the contact-resistance target, no permanent panel or
retainer deformation occurs, and normal deliberate removal remains possible.
If a selected plug/retainer cannot sustain 40 N, document the achieved load and
obtain a reviewed product-specific target before accepting it; do not reduce
the target informally.

### 4. Sweat/salt corrosion screen

Expose mated and unmated socket coupons, with the specified cap/retainer state,
to a documented artificial-sweat solution and a separate neutral salt-fog
screen. Use a published laboratory method selected by the reliability owner;
the purpose of this M4 test is comparative screening, not a claimed IEC or ASTM
qualification. For a repeatable initial screen, use 24 hours of 35 C artificial
sweat contact followed by 24 hours dry recovery, then 48 hours of neutral salt
fog at 35 C. Rinse and dry as specified by the selected method before electrical
measurements.

Pass only if there is no red corrosion, insulating-body crack, swelling, or
loss of marking; all plugs still mate and retain; and every path meets the
baseline contact-resistance limits. Any green corrosion product, nickel
blistering, or torque loss is a failure pending root-cause review, even when
continuity still passes. Test exposed live and capped/unmated configurations
separately because the SD-XUB IP67 statement is limited to an unplugged,
unconnected socket with its cap.

### 5. Endurance and post-test inspection

Run 10,000 full mate/unmate cycles per socket using the actual intended
body-cord plug and a controlled axial fixture. Inspect and record contact
resistance every 1,000 cycles, retention every 2,500 cycles, and a cable-flex
continuity run after every 2,500 cycles. The 10,000-cycle value is a project
DVT target, not a Stäubli-published XUB-G endurance rating; conduct an earlier
1,000-cycle EVT screen before committing production tooling.

Pass only if every interval meets the 50 milliohm and drift limits, the retainer
still meets its load requirement, the socket remains mechanically fixed, and
the plug still inserts and removes normally. Then section the sacrificial
coupons and inspect the socket interface, M4 stack, ring terminal, and strain
relief for plating wear-through, fretting debris, cracking, loosening, and
corrosion. Any exposed base metal in the current path, assembly loosening, or
unexplained resistance step is a failure.

## Readiness comparison and handoff

| Item | Current generic model/readiness manifest | M4-10 result |
| --- | --- | --- |
| MPN | `XUB-G 66.9684-*`, candidate | Exact bench candidates are `66.9684-22` left/red and `66.9684-25` right/green; production MPN remains unapproved. |
| Selection | Candidate; not production-approved | Exact sample order is defined, but all production decisions remain blocked by physical evidence. |
| Production footprint | Not applicable; chassis panel part with M4 harness termination | No change. The enclosure drawing and template still require official CAD/drawing review. |
| Prototype cassette | None | Electro-PJP `3253/PCB-#` and a two-piece PCB faceplate/connector cassette are prototype candidates only. Nominal socket and fastener coordinates are recorded, but no land pattern, axial stack-up, enclosure cutout, or fabrication CAD is released. |
| CAD | Pending | Official CAD catalogue entry found and recorded in the readiness manifest, but no file has been downloaded, versioned, or independently checked. Keep pending. |
| Mechanical | Source identified | Catalogue dimensions/mounting are now recorded, but no actual plug or panel fit has been verified. Keep source-identified. |
| Blockers | Color suffixes/keyed harnesses; body-cord fit; salt/sweat and cycle validation | Side-colour suffixes are now fixed for samples. Harness, plug fit, retention, CAD, supply consistency, corrosion, and cycle validation remain open. |

M4-10 can be reviewed as an exact sample-selection and test-plan deliverable.
It does not unblock M4-12, M4-13, or M4-14 for fabrication. The next actions
are to close the M4-13 SIG-01 line, panel-order, and keying release under the
committed M0-03 logical contract, obtain manufacturer CAD plus representative
foil, epee, and sabre body-cord plug samples, build the fixture panel and
retainer, and archive measured evidence before changing the candidate to a
production selection or ordering production material.
