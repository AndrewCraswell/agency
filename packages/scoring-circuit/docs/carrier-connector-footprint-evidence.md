# Carrier connector footprint evidence

**Scope:** the selected application-carrier interconnect: Molex `43045-0400`
with its `43025-0400` and `43030-0007` harness parts, plus Samtec
`HSEC8-113-01-L-DV-A-L2` and the exact `ECDP-08-07.87-L1-L2-1-3` USB2 cable.

**Disposition:** fabrication **DENY** for every record. The isolated evidence
model in [`src/carrier-connector-footprint-evidence.ts`](../src/carrier-connector-footprint-evidence.ts)
is a source-backed review model. It does not replace the interboard contract,
readiness register, circuit, or released PCB library, and it does not clear a
DNP state.

## Source-backed facts

### Molex Micro-Fit 3.0

The current Molex `SD-43045-001` product drawing (revision H1) identifies the
four-circuit `43045-0400` as a dual-row, 3.00 mm pitch, right-angle,
through-hole header with snap-in plastic PCB retention pegs. Its component-side
PCB layout shows four contact holes in a two-by-two 3.00 mm pattern, a nominal
1.02 mm finished hole, and a recommended 1.57 mm board thickness. The drawing
also gives the 10.16 mm maximum placement distance from the board edge needed
to avoid receptacle and PCB interference. The Molex product specification lists
the 43045 family and its 18 to 30 AWG crimp system; the exact project harness
uses the 43025-0400 receptacle and loose 43030-0007 female terminals.

The `43025-0400` drawing identifies the housing as a four-circuit receptacle
that mates with 43045 and accepts 43030 female terminals. The `43030-0007`
drawing identifies the exact terminal row as loose form A for 20 to 24 AWG
wire. These facts establish the selected mate chain; they do not qualify the
crimp, wire insulation, insertion depth, or harness strain relief.

Primary sources:

- [Molex SD-43045-001 drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430451400_sd.pdf)
- [Molex 43025-0400 drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430250400_sd.pdf)
- [Molex 43030 terminal drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf)
- [Molex PS-43045 specification](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/productspecificationpdf/430/43045/PS-43045-001.pdf)
- [Molex 43045 test summary](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/testsummarypdf/430/43045/430450005-TS-000.pdf)

The source drawing does not provide the project’s final solder-mask expansion,
assembly courtyard, fabricator annular-ring rule, enclosure support, or
controlled harness process. Those remain open in the model.

### Samtec HSEC8 and ECDP

The Samtec HSEC8 product page identifies the selected socket as a vertical
0.80 mm pitch edge-card connector and describes its `.062` inch card option as
1.60 mm. The controlled HSEC8 mechanical Series Print revision BZ owns the
exact `-01` requirement: 1.57 mm with a plus or minus 0.15 mm mating-card
tolerance. The project may use the rounded 1.60 mm value when describing the
planning stackup, while the controlled footprint keeps the Series Print value
and tolerance. Revision BZ also defines the `-A` alignment option and `-L2`
ECDP latching option. The HSEC8 footprint print revision AH defines the two-row
0.80 mm land pattern, the `-A` alignment NPTHs, the `-L2` latch PTHs, the
recommended 0.15 mm stencil, and the paste-in-hole process for the latch
features. The configured `-113` option is 13 positions per row, or 26
contacts total.

The ECDP Series Print revision X defines the exact cable fields: `-08` pairs,
`07.87` inch cable length, `-L1` and `-L2` double-vertical latches, wiring
option `-1` pin 1 to pin 1, and cable option `-3` 100 ohm EyeSpeed. The print
requires 100% shorts/opens testing and 300 V hi-pot testing for assemblies and
states that the key consumes four pitches. The ECDP product page identifies
30 AWG twinax and 100 ohm differential routing. The project’s USB_DN,
USB_DP, and CHASSIS assignments must still be overlaid against the configured
Samtec documentation; a generic edge-card pinout is not acceptable.

Primary sources:

- [Samtec HSEC8 product page](https://www.samtec.com/products/hsec8-113-01-l-dv-a-l2)
- [HSEC8 mechanical Series Print](https://suddendocs.samtec.com/prints/hsec8-1xxx-xx-xx-dv-x-xx-x-xx-mkt.pdf)
- [HSEC8 footprint Series Print](https://suddendocs.samtec.com/prints/hsec8-1xxx-xx-xx-dv-x-xx-footprint.pdf)
- [Samtec ECDP product page](https://www.samtec.com/products/ecdp)
- [ECDP Series Print](https://suddendocs.samtec.com/prints/ecdp-xx-xx.xx-xx-xx-x-x-mkt.pdf)
- [Samtec ECDP/HSEC8 qualification report](https://suddendocs.samtec.com/testreports/217284_report_rev_1_qua.pdf)

Samtec provides manufacturer land/stencil and qualification evidence, but the
project has not imported and overlaid the exact configured CAD, approved the
mask/courtyard and stackup, tested the cable’s physical retention, or verified
the configured contact map in a production-representative USB channel. Those
are release gates, not assumptions.

## Release gates and handoff

Do not replace the DNP models or emit fabrication artwork until the following
evidence is attached to the release CAD and assembly traveler:

1. Import the exact manufacturer drawings, controlled footprint/3D objects,
   and source revisions for the purchased MPNs. Check every copper land,
   finished hole, non-plated hole, mask opening, stencil opening, pin-one
   marker, body edge, alignment feature, latch, and rework keepout.
2. Overlay both mated assemblies and the released board edges. Verify Molex
   board-edge placement and chassis strain relief, then verify Samtec card
   lead-in, the exact 1.57 mm plus or minus 0.15 mm card requirement, latch
   engagement, and cable tie-down against the rounded 1.60 mm planning stackup.
3. Lock the Molex terminal, wire gauge, crimp applicator, crimp-height and
   pull-force limits. Prove circuit 1 through circuit 4 continuity with the
   keyed 43025-0400 and 43030-0007 harness.
4. Lock the ECDP `-08-07.87-L1-L2-1-3` cable traveler, including 100% shorts/
   opens, 300 V hi-pot, shield termination, lot traceability, and keyed
   orientation. Validate the USB eye and 100 ohm channel on the final board.
5. Run fabrication-preview/DRC, reflow and through-hole process review,
   mechanical insertion and removal, harness strain, service, and blocked-
   vent temperature tests on production-representative assemblies.

The automated tests only prove that the evidence model is unique, source-backed,
geometrically sane, and fail-closed. They are not a substitute for the CAD
overlay, physical mate, assembly, signal-integrity, or fabrication checks.
