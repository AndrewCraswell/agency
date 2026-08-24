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

The STM32 HSE and LSE entries are DNP, with no MPN, oscillator, crystal, load,
or bias network. The ESP32 oscillator remains module-integrated. The ledger
extracts all 16 references in BP-125's processor-support contract. It reconciles
`R_ESP_EN_PULLUP` and `C_ESP_EN_DELAY` to BP-123's exact selections. The
`R_STM_BOOT0` and `R_ESP_BOOT_PULLUP` rows now consume BP-125's exact Yageo
`RC0603FR-0710KL` source record and remain geometry-unclaimed; the other 12
references whose MPN remains intentionally TBD stay DNP until an exact
selection is reviewed. The retained source digest is
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
