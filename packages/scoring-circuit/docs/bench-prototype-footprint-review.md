# BP-030 footprint evidence method

## Status

This method creates the review record used by `BP-031` through `BP-035`. It is
an evidence form, not a footprint library, PCB-placement permission, an order
BOM, or a fabrication release. The executable contract always retains
`footprintClosure: false`, `fabricationRelease: false`, and
`releaseState: deny`, even after a record reaches `evidence-reviewed`.

The template is generated from the canonical `BP-020` baseline BOM. It covers
every BOM reference in the same order and copies the selected exact MPN and
package. A `TBD` row stays `selection-blocked` with no invented MPN or package.
A DNP row stays `excluded-dnp`.

## Evidence bound to each reference

Each populated reference gets one record containing:

| Field | Required evidence |
| --- | --- |
| BOM identity | Reference, BP-020 disposition, exact MPN, and exact package must match the immutable baseline. |
| Manufacturer drawing | HTTPS source, source revision, and SHA-256 of the acquired exact drawing. |
| Manufacturer CAD | HTTPS source, source revision, and SHA-256 of the acquired exact CAD archive or file. |
| Generated artwork | Repository artifact path, exact generator/version, and SHA-256 of the generated footprint artwork. |
| Orientation | Assembly rotation from 0 through less than 360 degrees, named pin-one or polarity datum, and overlay notes. |
| Review | Reviewer identity, review timestamp, disposition, and nonblank findings when rework is required. |

SHA-256 values use 64 uppercase hexadecimal characters. The digest covers the
exact bytes reviewed, not a web page, filename, screenshot, or downloaded
archive after it has been altered. If an archive contains the drawing or CAD
object, record the archive hash and identify its exact member in the revision
text.

The existing fabrication footprint ledger is reused only to carry forward
known gate references. Its transcribed or manufacturer-listed evidence remains
a discovery aid. It cannot substitute for the drawing, CAD, or artwork hashes
required here.

## Review workflow

1. Start with `createBenchPrototypeFootprintReviewTemplate()` after the
   `BP-020` BOM commit being reviewed.
2. Confirm that the reference, exact MPN, package, and physical part marking
   agree. A selection mismatch returns to `BP-020`; do not edit identity fields
   in the footprint record.
3. Acquire the exact manufacturer drawing and CAD source. Record their source
   revisions and hashes before importing or transcribing geometry.
4. Generate one project footprint. Hash the artwork, document pin-one or
   polarity orientation and assembly rotation, and overlay it against the
   manufacturer sources.
5. Have an independent reviewer choose `rework-required` or
   `evidence-reviewed`. Rework requires at least one finding. An evidence review
   requires both manufacturer sources, generated artwork, orientation,
   reviewer, and time.
6. Run `validateBenchPrototypeFootprintReview()`. Structural ambiguity,
   omitted or extra records, sparse arrays, accessors, aliases, nonfinite
   orientation, malformed hashes, and baseline identity drift fail closed.
7. Store the evidence record with its source and artwork artifacts for the
   applicable closure task (`BP-031` through `BP-035`).

`evidence-reviewed` means only that this BP-030 evidence form is complete. The
applicable lane task still owns geometry overlay, pin mapping, assembly rules,
layout constraints, independent review, and any later footprint-closure
decision. This method can never authorize copper generation or fabrication.

## Dispositions

| Disposition | Use |
| --- | --- |
| `selection-blocked` | BP-020 row is still TBD. |
| `excluded-dnp` | BP-020 row is intentionally not populated. |
| `unreviewed` | Exact selected identity exists, but evidence collection has not begun. |
| `collecting-evidence` | Some source, artwork, or orientation evidence exists but independent review is incomplete. |
| `rework-required` | Reviewer found one or more named problems. |
| `evidence-reviewed` | All required BP-030 fields were reviewed; downstream footprint closure is still denied. |

## Example completed evidence fields

The following is illustrative only and is not evidence for any real part:

```ts
{
  manufacturerDrawing: {
    state: "acquired",
    url: "https://manufacturer.example/exact-drawing.pdf",
    revision: "drawing revision A",
    sha256: "<64 uppercase hexadecimal characters>"
  },
  manufacturerCad: {
    state: "acquired",
    url: "https://manufacturer.example/exact-cad.zip",
    revision: "CAD revision A, member exact-part.step",
    sha256: "<64 uppercase hexadecimal characters>"
  },
  artwork: {
    state: "generated",
    artifactPath: "cad/footprints/exact-part.kicad_mod",
    generator: "KiCad 9.0.4",
    sha256: "<64 uppercase hexadecimal characters>"
  },
  orientation: {
    state: "documented",
    assemblyRotationDeg: 0,
    datum: "Pin 1 at upper-left assembly marker",
    notes: "Top-view overlay checked against the manufacturer drawing."
  },
  reviewer: "Independent reviewer identity",
  reviewedAt: "2026-08-23T18:00:00.000Z",
  disposition: "evidence-reviewed",
  findings: []
}
```
