# Communications-module footprint release evidence

**Scope:** WIZnet `W5500`, Würth Elektronik `7499011121A`, and Amphenol
Communications Solutions `10177070-00011LF`.

**Disposition:** fabrication **DENY** for all three. The evidence register in
[`src/communications-footprint-evidence.ts`](../src/communications-footprint-evidence.ts)
is an immutable-source audit and review-only geometry record. It is not a PCB
footprint library, does not change `doNotPlace`, and cannot emit copper, mask,
paste, holes, or courtyard artwork into either board model.

## Findings

| Part | Primary evidence found | What is still missing | Verdict |
| --- | --- | --- | --- |
| WIZnet `W5500` | WIZnet W5500 datasheet v1.1.0, package-information page, and official Eagle library. The source identifies a 48-pin LQFP, 7 mm body, 0.5 mm pitch, and pin mapping. | The package-change note requires lot/package reconciliation. The official source does not provide a locked fabrication object with fabricator-specific mask, paste, and courtyard data. | **Deny** |
| Würth `7499011121A` | Würth datasheet drawing dated 2023-07-11, manufacturer KiCad archive rev26b, and exact `7499011121A` STEP rev1 from that archive. The review record preserves all 16 source holes and their copper shapes: rectangular pin 1, seven circular 0.9 mm signal holes, four circular 1.03 mm LED holes, two circular 1.6 mm shield features, and two circular 3.25 mm non-plated holes. | Import and independently overlay the library, STEP, and datasheet. Verify pad-number-to-MDI/LED mapping, mask/annular rules, wave-solder process, shell/chassis return, enclosure panel, and independent plug-load support. | **Deny** |
| Amphenol `10177070-00011LF` | Manufacturer product page lists the exact right-angle USB-C receptacle, 16 contacts, and 0.80 mm PCB thickness. | The project could not acquire the manufacturer drawing or 3D archive: direct drawing retrieval returned HTTP 403 on 2026-08-23. No contact, shell/stake, paste, mask, courtyard, orientation, or board-edge geometry is recorded. | **Deny** |

## Source records

The URLs and source revisions are stored in the TypeScript evidence record. The
temporary acquired-file hashes are included for audit reproducibility and do
not mean the files are vendored or approved for release:

- WIZnet Eagle archive: `3782F5FE121892D756F73C6C215CD7197592E6AA4D1CF313A61E86C32F9D68C8`.
- Würth KiCad footprint entry: `C4668F610A62D6E8D9E25FF7DBCF2AFFB33C1954ACE277C504CFD41951CA30EC`.
- Würth exact STEP extracted from `KiCad_WE-RJ45LAN rev26b` at
  `3dmodels/Transformer_THT_Wurth.3dshapes/T_Wurth_WE-RJ45LAN_7499011121A.step`:
  `982AE39409ABE5B756E2FCD06EEE665EECBC3EF416A3464E7B90EA2631CD3FA0`.

The earlier connector source audit retains the Würth datasheet and standalone
STEP hash records and the Amphenol access-denial record in
[`connector-cad-verification.md`](./connector-cad-verification.md).

## Required CAD/procurement handoff

Before any communications-module fabrication release, the owner must:

1. obtain the exact supplier lot/package identity for W5500 and reconcile the
   WIZnet post-2021 package-change note;
2. import W5500 copper, Würth copper/holes/courtyard/STEP, and Amphenol
   contacts/shell/stakes into the selected release CAD;
3. record source revision and checksum beside the imported object;
4. independently overlay pin one, pin mapping, orientation, board edge,
   courtyard, mask, paste or through-hole process, and chassis support; and
5. run DRC, assembly, enclosure, wave/reflow, signal-integrity, ESD, and
   plug/cable-load review before changing any DNP gate.

The source data is useful enough to start a CAD-import task for Würth, but it
does not authorize lifting the DNP state. Amphenol remains blocked on source
acquisition, and W5500 remains blocked on a release-grade land-pattern and
package-variant review.
