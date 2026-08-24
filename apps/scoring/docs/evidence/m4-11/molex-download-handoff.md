# M4-11 Molex drawing download handoff

**Checked:** 2026-08-24

This is a download and provenance handoff, not a geometry approval. The
official Molex PDF views were readable through the manufacturer web source,
but the repository runner could not retain raw bytes: direct requests timed
out or were reset. No checksum is claimed, and the M4-11 source keeps all
Molex geometry and release gates denied.

| Selected identity | Official source | Document markers observed | Local artifact / SHA-256 | Next action |
| --- | --- | --- | --- | --- |
| Header `43045-0400` | https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450201_sd.pdf | `43045-0400` in the four-circuit row; `SD-43045-001`; revision `E1`; recommended PCB thickness `1.57/.062` | Not acquired; no SHA-256 | Download from an authorized Molex path, retain bytes, record size and SHA-256, then verify the exact row before any footprint work. |
| Receptacle `43025-0400` | https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430252400_sd.pdf | `43025-0400`; `430250000-SD`; revision `D`; receptacle mates with `43020` and `43045` | Not acquired; no SHA-256 | Download from an authorized Molex path, retain bytes, record size and SHA-256, and confirm the selected mate and keying. |
| Female terminal `43030-0007` | https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf | `43030-0007`; `SD-43030-XXXX`; current revision `N10`; loose form; 20-24 AWG | Not acquired; no SHA-256 | Download from an authorized Molex path, retain bytes, record size and SHA-256, and confirm the wire, crimp tooling, and pull-test requirements. |

## Manufacturer query

Request the three original PDFs from Molex technical support or an authorized
Molex account, quoting the exact URLs and part numbers above. Ask Molex to
confirm that the supplied documents are the controlling revisions for the
selected identities and to provide the matching native CAD files, if any.
The response must identify the document number, revision, retrieval date,
file size, and SHA-256 of every retained file.

After the files are retained, independently overlay the exact header,
receptacle, and terminal geometry in the released board and harness/enclosure
assemblies. Confirm pin one, every pad and hole, retention features, mating
axis, wire exit, bend radius, strain relief, and the enclosure load path.
Do not infer any of those properties from the rendered web markers or from a
generic Micro-Fit footprint. USB-C PD remains the sole external apparatus
power input; `J_PWR_CARRIER` remains an internal locking harness only.
