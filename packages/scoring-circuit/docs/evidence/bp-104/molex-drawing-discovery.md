# BP-104 Molex drawing and CAD source evidence

Retrieval date: 2026-08-24.

The selected Molex sources were fetched from the official `molex.com` content
endpoints with Python 3.12 `urllib.request` using an OpenSSL client. Every
retained response was HTTP 200, `application/pdf`, began with `%PDF-`, parsed as
a one- or two-page PDF by `pypdf`, and matched the selected material number in
the extracted text. The SHA-256 values below are over the exact retained bytes.

| MPN | Artifact | Official source | Retained asset | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `43045-1200` | Series drawing `SD-43045-001`; 12-circuit finish-A material-table row | [Molex drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450600_sd.pdf) | `docs/evidence/bp-104/assets/43045-1200-drawing.pdf` | 237,283 | `571c8a381be263cf8f92b064fe18dbc6ce6161e8cb2e931d186e8280b9f8338a` |
| `43045-1200` | Exact-MPN CAD preview; material `430451200`, 12 circuits | [Molex CAD preview](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/430/43045/430451200.pdf) | `docs/evidence/bp-104/assets/43045-1200-cad-preview.pdf` | 179,345 | `7ec4bed5fa8de35dbcf15486eea86062f9baaf8cdd2bfc0f4d2126a5d68f65fa` |
| `43025-1200` | Series drawing `430250000-SD`; 12-position material-table row | [Molex drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430250400_sd.pdf) | `docs/evidence/bp-104/assets/43025-1200-drawing.pdf` | 201,161 | `3fa78847433b382fa07609fb9f44b5e8b017804b9b491250dc493eef9e029e28` |
| `43025-1200` | Exact-MPN CAD preview; material `430251200`, 12 circuits | [Molex CAD preview](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/430/43025/430251200.pdf?inline=) | `docs/evidence/bp-104/assets/43025-1200-cad-preview.pdf` | 184,884 | `57a49568309fb94161814f16e2544c6c096fd2c47c09536367bbbaf943b7680c` |
| `43030-0007` | Series drawing `SD-43030-XXXX`; 20-24 AWG form-A terminal material-table row | [Molex drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf) | `docs/evidence/bp-104/assets/43030-0007-drawing.pdf` | 632,077 | `864e37707afed617ce5155661b9bbddd29bf10cae3d64185a34c71782574307b` |
| `43030-0007` | Exact-MPN CAD | No bytes retained. The unlisted candidate pattern `.../3dcadmodelspdf/430/43030/430300007.pdf` returned HTTP 404; this does not establish whether Molex publishes CAD at another URL. | none | n/a | none |
| `44242-0005` | Series drawing `SD-44242-001`; 12-circuit test-plug material-table row | [Molex drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/442/44242/442420001_sd.pdf) | `docs/evidence/bp-104/assets/44242-0005-drawing.pdf` | 147,864 | `c39b30b917e9beda545daa3ab00ff5f3ba5f27839d142edf035303dd8eb62eef` |
| `44242-0005` | Exact-MPN CAD preview; material `442420005`, 12 circuits | [Molex CAD preview](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/3dcadmodelspdf/442/44242/442420005.pdf) | `docs/evidence/bp-104/assets/44242-0005-cad-preview.pdf` | 258,296 | `a7a9a9b236ba687c8ee3835a16120942f97742e61413c036513b8da7c7d3d84f` |

## Transport evidence

The first retrieval attempt used this exact command shape for the four drawing
URLs and the two CAD URLs already recorded in the interrupted work:

```text
curl.exe -sS -4 -L --http1.1 --tlsv1.2 --connect-timeout 5 --max-time 8 --retry 0 --output <temp-file> <official-url>
```

Each of those six local Schannel requests returned exit code `28` with
`Operation timed out after 8010-8019 milliseconds with 0 bytes received`. The
connection was established, but the Molex endpoint repeatedly requested TLS
renegotiation and did not deliver response bytes to curl. This was a
client-transport limitation, not endpoint unavailability.

The independent Python/OpenSSL retrieval returned HTTP 200 and retained bytes
for all four drawings, the two previously recorded CAD previews, and the newly
found `442420005.pdf` CAD preview. The exact-MPN `43030-0007` CAD pattern probe
returned HTTP 404 and is not treated as an official source URL. No false local
transport blocker remains for the downloadable artifacts.

The executable discovery record is `hash-bound`. The `43030-0007` CAD fields
remain null with `not-acquired-pattern-probe-returned-404`. This records only
the observed response from that candidate URL pattern and does not establish
whether Molex publishes an exact CAD artifact elsewhere. Source-byte evidence
does not establish an imported footprint, exact drawing review, physical
sample fit, continuity, crimp, terminal retention, miswire rejection, strain
relief, physical approval, or fabrication authorization. Those BP-104 gates
remain open and the fabrication disposition remains `DENY`.

Related official product and series sources:

- [Molex 43045-1200](https://www.molex.com/en-us/products/part-detail/43045-1200)
- [Molex 43025-1200](https://www.molex.com/en-us/products/part-detail/0430251200)
- [Molex 43030-0007](https://www.molex.com/en-us/products/part-detail/430300007)
- [Molex 44242 series chart](https://www.molex.com/en-us/products/series-chart/44242)
