# BP-125 processor footprint source checklist

This record identifies the retained official bytes used by the executable
BP-125 reconciliation. It records evidence applicability and open gates; it is
not a manufacturer CAD archive or a fabrication sign-off.

| Item | Retained source | Location | Evidence used | Open gate |
| --- | --- | --- | --- | --- |
| `STM32G474RET3TR` ordering and package | ST DS12288 Rev 6, SHA-256 `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD` | Table 124 p. 232; Figures 62 to 64 pp. 210 to 212 | exact ordering-code family binding, LQFP64 outline, recommended copper, and pin-one orientation | independent overlay, assembly orientation, mask, paste, and courtyard review |
| STM32 electrical checklist | ST DS12288 Rev 6 | sections 3.7, 3.11, 3.13, 3.14, and 5.3.5 | boot/reset, rails, oscillator options, and unused-input guidance | schematic sign-off and timing validation |
| `ESP32-S3-WROOM-1U-N16R2` variant | Espressif ESP32-S3-WROOM-1 and WROOM-1U Datasheet v1.8, SHA-256 `27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435` | Table 1-2 p. 3 | exact 16 MB Quad-SPI flash, 2 MB Quad-SPI PSRAM, and WROOM-1U package selection | independent module-overlay review |
| ESP32 pads, supply, reset, and EPAD | Espressif Datasheet v1.8 | Figure 3-1 pp. 10 to 12; section 9 p. 41 | 41-pin topology, non-floating EN requirement, 10 kOhm and 1 uF typical EN-delay guidance, and ground EPAD | schematic sign-off, power-sequence measurement, and continuity evidence |
| ESP32 WROOM-1U package and land pattern | Espressif Datasheet v1.8 | Figures 10-2 and 11-2 pp. 42 and 46 | 18 mm by 19.2 mm by 3.2 mm module, 40 perimeter lands, EPAD-via guidance, and WROOM-1U recommended land pattern | paste, courtyard, EPAD, and independent placement review |
| External antenna connector | Espressif Datasheet v1.8 | sections 10.2 and 11.2 pp. 43 to 46 | WROOM-1U connector family and need for placement consideration | cable, antenna, enclosure, RF clearance, and certification review |

The candidate geometry is retained in the already isolated BP-032 artifacts.
This BP-125 record only verifies that their exact MPNs and source hashes agree
with the processor-support contract. All release-authority fields remain
denied.
