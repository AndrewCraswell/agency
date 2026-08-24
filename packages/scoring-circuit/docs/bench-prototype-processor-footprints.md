# BP-032 processor, isolation, reset, clock, and debug footprints

`BP-032` is an executable, per-reference footprint-closure ledger for the
processor lane. It binds the committed STM32G474RET3TR, ESP32-S3-WROOM-1U-N16R2,
ISO7762FDWR, ISO7721FDR, NXE1S0505MC, every selected BP-123 reset/watchdog
support part, and the BP-124 service headers. It does not create a footprint,
artwork, or fabrication release.

Each selected row records its exact MPN, package, source work unit, and the
existing footprint-release gates. Manufacturer drawings and CAD, generated
copper/mask/paste/courtyard artwork, and assembly orientation are all explicitly
unacquired or unreviewed. No pad, solder-mask, paste, courtyard, antenna, or
assembly geometry is invented.

For `NXE1S0505MC`, the source-backed package identity is a surface-mount
14-position geometry with five solder lands at positions 1, 3, 7, 8, and 14;
four are functional connections. Murata maps those lands as 1 = -Vin, 3 =
+Vin, 7 = -Vout, 8 = +Vout, and 14 = NA (not available for electrical
connection). The manufacturer's
recommended 5-pad footprint remains source guidance only; BP-032 has no
project footprint, CAD, generated artwork, or orientation approval for it.

Every populated processor, isolator, reset/watchdog part, and selected
processor-support part carries a manufacturer-primary identity and URL in the
executable ledger. A URL-only mapping is explicitly source-unverified; it does
not close manufacturer-source evidence. The bounded retained-byte batch is
only `TPS3431SDRBR` and `TPS389033DSER`: their exact Texas Instruments primary
PDFs are retained at `docs/evidence/bp-032/ti-tps3431.pdf` and
`docs/evidence/bp-032/ti-tps3890.pdf`, with request identities,
MPN/package/path/source URL, and SHA-256 digests frozen in the ledger. Tests
enumerate that folder and read and hash every retained asset; omission, an
extra asset, duplicate request identity, package/path mismatch, or digest
drift fails. `GCM188R71H104KA57D` maps to its Murata primary URL but remains
source-unverified in BP-032 because its retained bytes are owned by BP-125 and
are not duplicated here. All other URL-only rows are likewise source-unverified
until their own manufacturer bytes are retained.

Retaining the two TI source files does not release geometry: drawing/CAD
archive, generated artwork, and orientation review remain DENY.

The STM32 HSE and LSE entries are DNP, with no MPN, oscillator, crystal, load,
or bias network. The ESP32 oscillator remains module-integrated. The ledger
extracts all 16 references in BP-125's processor-support contract: six exact
BP-125 selections, two BP-123 reconciliations, and eight DNP-until-exact-selection
rows. It reconciles
`C_ESP_EN_DELAY` to BP-123's exact selection. The `R_STM_BOOT0` and
`R_ESP_BOOT_PULLUP` rows consume BP-125's exact Yageo `RC0603FR-0710KL` source
record, while `R_ESP_EN_PULLUP` retains its exact BP-123 selection and now has
the same BP-125 source evidence. All three remain geometry-unclaimed; the
other 8 references whose MPN remains intentionally TBD stay DNP until an
exact selection is reviewed. The retained source digest is
`EB05C2BF91E14E082BD438F809A4CE712DBF837B993DFC8CF6BDA0C6ED77A497` for
`docs/evidence/bp-125/yageo-rc0603fr-0710kl-datasheet.pdf`. An added, removed,
reordered, or changed BP-125 support reference fails provenance validation.

BP-032 also snapshots BP-030's artifact, method, BOM-kind, footprint-closure,
fabrication-release, and release-state fields. Any change to those method or
release gates is rejected instead of being inherited silently.

Both service headers remain DNP until their exact drawing/CAD, keying or
fixture-enforced orientation, mating, continuity, and recovery evidence are
archived. The WROOM-1U still requires an independent module land pattern,
EPAD-via/paste, external antenna/cable clearance and retention, and keepout
review.

The ledger remains **DENY** until independent drawing, CAD, artwork, and
orientation records exist for every populated reference. Schematic integration,
footprint closure, and fabrication authorization are false.
