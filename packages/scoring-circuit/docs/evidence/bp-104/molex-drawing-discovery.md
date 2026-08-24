# BP-104 Molex drawing discovery

Discovery date: 2026-08-24.

The following official Molex customer-drawing endpoints were independently
checked for the selected material-number rows:

| Selected MPN | Drawing | Official source | Verified scope | Retained bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `43045-1200` | `SD-43045-001` | [Molex PDF](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43045/430450600_sd.pdf) | 12-circuit, finish-A row contains `43045-1200` | no | none |
| `43025-1200` | `430250000-SD` | [Molex PDF](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43025/430250400_sd.pdf) | 12-position material-number row contains `43025-1200` | no | none |
| `43030-0007` | `SD-43030-XXXX` | [Molex PDF](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300003_sd.pdf) | 20-24 AWG, form-A, loose-terminal row contains `43030-0007` | no | none |
| `44242-0005` | `SD-44242-001` | [Molex PDF](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/442/44242/442420001_sd.pdf) | 12-circuit test-plug row contains `44242-0005` | no | none |

The remote PDF responses were readable for material-table verification. Two
local byte-download attempts (PowerShell and curl) were closed by the remote
Molex transport before any file was retained. Consequently this record does
not invent a digest: `retainedAsset` and `contentSha256` remain `null` in the
executable discovery contract, and all four sources remain
`identified-not-hash-acquired`.

These series drawings are source discovery only. They do not establish an
exact-MPN drawing, CAD footprint, sample fit, continuity, crimp, retention,
strain relief, physical review, or fabrication authorization.
