# Reel-socket selection and plug-fit study

M4-10 research snapshot, 2026-08-22. This is a selection and test plan, not
physical qualification. No XUB-G socket, fencing body-cord plug, harness, or
panel assembly has been received or tested for this project.

## Decision status

`Stäubli XUB-G 66.9684-*` remains the candidate family for the six body-cord
panel sockets: left A/B/C and right A/B/C. It is not a selected or
production-approved part. The current machine-readable readiness manifest
correctly continues to identify it as a generic candidate with pending CAD and
the blockers for color selection, harness keying, plug fit, salt/sweat
exposure, and endurance.

The final ordered suffixes **cannot close in M4-10**. The open work is
material, not procurement paperwork:

1. M0-03 has not defined the electrical meaning or physical ordering of A, B,
   and C. In particular, the FIE rules name pin geometry and weapon functions,
   but they do not assign the project labels A/B/C or panel colors.
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

### Conditional procurement proposal, not a released BOM

If the product owner adopts red for the left fencer and green for the right
fencer, the color-only procurement proposal is three `66.9684-22` red sockets
for left A/B/C and three `66.9684-25` green sockets for right A/B/C. The panel
silkscreen and the eventual locating template, rather than socket color, must
identify A, B, and C. FIE prescribes red/green hit indication, not a
left/right assignment or socket color, so this is a project convention only.

Do not order this as production material and do not update the readiness
manifest from this proposal. It becomes the exact selection only after M0-03
freezes the A/B/C map and the plug-fit, retention, and environmental tests
below pass on the intended body-cord plugs. If the product convention instead
uses one color per circuit, the current Stäubli palette is sufficient, but the
mapping must be a reviewed M0-03/M4-13 decision rather than an inferred
fencing standard.

## Manufacturer evidence

The following information is from Stäubli primary documentation, checked on
2026-08-22:

| Property | Evidence and selection consequence |
| --- | --- |
| Family and interface | XUB-G, order-number stem `66.9684-*`; insulated, rigid 4 mm universal socket accepting spring-loaded 4 mm plugs with rigid insulating sleeve. The mating-plug construction is a test gate, not an assumption. |
| Construction | Machined brass; electrical contact base material CuZn and nickel surface treatment. Stäubli does not state the insulating-body polymer or a nickel thickness in the cited family data, so neither is a controlled material or corrosion claim. |
| Electrical rating | The family datasheet states 1000 V CAT II and 20 A. The current main catalogue qualifies that as 600 V CAT II/20 A when surface-mounted and 1000 V CAT II/20 A when flush-mounted or pressed in. These ratings do not establish fencing signal accuracy, low-level contact resistance, or sweat durability. |
| Rear termination | M4 threaded bolt. Use a ring terminal and locking hardware on a replaceable harness. Do not solder a panel socket or let a PCB pad carry body-cord insertion load. |
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

## Fencing-interface constraints and evidence limits

The local [FIE Material Rules, August 2026](../../../apps/scoring/docs/fie-material-rules-2026-08-en.pdf)
are the normative source. Its foil bodywire rules on printed pages 33-34 and
epee bodywire rules on printed pages 34-35 specify the spool-end three-pin
plug's centre, 15 mm, and 20 mm connections, a transparent plug, insulation
against humidity, 1 ohm maximum per bodywire conductor, and a security device
where necessary. Sabre uses the specified foil bodywire. These rules define
the interface constraints, but do not name XUB-G, the 4 mm spring geometry,
socket color, a panel layout, socket contact resistance, insertion force, or
socket cycle life.

The local [Favero FA-15 user manual](../../../apps/scoring/docs/favero-fa15-user-manual-en.pdf)
is prior art only. Its printed page 17 describes a seven rear-socket
short-circuit test. It is useful as a fixture idea, but provides no XUB-G
part number, plug drawing, contact-plating evidence, retention target, or
compatibility evidence. Do not infer any of those facts from the FA-15.

## Panel and harness proposal

Until M0-03 closes, call the physical locations `P15`, `P0`, and `P20`, based
on the FIE plug geometry, rather than silently declaring which is A, B, or C.
Build each three-socket cluster from a hardened locating template validated
against the samples, with a recessed non-conductive bezel that protects the
insulating sleeves and makes the cluster orientation unambiguous. Give the
front panel durable `LEFT`/`RIGHT` and A/B/C markings only after the M0-03 map
is signed off.

Each socket's M4 stud should join a short, serviceable internal lead through a
ring terminal, a serrated locking washer, a torque-marked nut, and insulated
strain relief. Route the three leads from each panel module to one distinct,
keyed six-position harness connector. Use physically different keying or
gender for left and right, a dedicated panel-module connector for each, and
positive wire identification at both ends. No adapter or reversible
intermediate harness may make left/right or A/B/C exchange possible. The
final pinout, bonding/ESD route, conductor gauge, terminal stack-up torque,
and connector current rating belong to M4-13.

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
| MPN | `XUB-G 66.9684-*`, candidate | Family evidence retained; exact ordered suffixes remain blocked. |
| Selection | Candidate; not production-approved | Conditional red-left/green-right six-socket proposal only. |
| Footprint | Not applicable; chassis panel part with M4 harness termination | No change. The enclosure drawing and template still require official CAD/drawing review. |
| CAD | Pending | Official CAD catalogue entry found, but no file has been downloaded, versioned, or independently checked. Keep pending. |
| Mechanical | Source identified | Catalogue dimensions/mounting are now recorded, but no actual plug or panel fit has been verified. Keep source-identified. |
| Blockers | Color suffixes/keyed harnesses; body-cord fit; salt/sweat and cycle validation | All remain open, with the responsible test plan and closure evidence now stated. |

M4-10 can be reviewed as research and a test-plan deliverable. It does not
unblock M4-12, M4-13, or M4-14 for fabrication. The next actions are to close
M0-03's line and panel-order contract, obtain manufacturer CAD plus at least
two representative body-cord plug samples, build the fixture panel and
retainer, and archive the measured evidence before changing
`src/part-readiness.ts` or ordering production material.
