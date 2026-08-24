# BP-145 optional application peripherals

BP-145 keeps the first board focused on weapon, connector, scoring-code,
Ethernet, and display validation. It populates only `U_FRAM`; the RTC, secure
element, audio amplifier, speaker connector, and external antenna remain DNP.
This is a schematic population decision, not footprint, layout, order-BOM, or
fabrication approval.

`U_FRAM` is the source-backed Infineon `CY15B104Q-LHXIT`. It uses BP-121's
`APP_SPI_SCK` (GPIO18), `APP_SPI_MOSI` (GPIO8), `APP_SPI_MISO` (GPIO9), and
dedicated `FRAM_CS_N` (GPIO47) on `V3_3`. The selected `LH` orderable variant
is the 8-pin TDFN/DFN (`PG-USON-8`), 5 mm by 6 mm by 0.75 mm, defined by
Infineon package drawing `001-85579`; it is not the `S`-variant SOIC-8. Its full
pin map is CS_N 1, SO 2, WP_N 3, VSS 4, SI 5, SCK 6, HOLD_N 7, and VDD 8.
`WP_N` and `HOLD_N` each use
an exact Yageo `RC0603FR-0710KL` 10 kOhm pull-up. Exact KEMET
`C0603C104K3RACTU` 100 nF bypasses VDD pin 8 locally to VSS/`APP_GND` pin 4.
Populating it validates the intended event
journal and shared-SPI arbitration with the W5500 without consuming another
ESP32 pin. Its footprint, support-part identities, bus behavior, reset default,
and recovery-with-device-absent behavior remain evidence gates.

`RV-3028-C7` and `TAS2505TRGERQ1` remain retained, source-backed candidates but
are DNP. `STSAFE-A110` is only a family-level DNP candidate; its exact
orderable personalization and package variant remains TBD. Network/test-host time is sufficient for
the first test; secure-element personalization belongs to a controlled factory
flow; and audio cannot close without a speaker, load, thermal, SPL, and factory
enclosure decision. `J_SPEAKER` has no selected part and is DNP.

The selected ESP32 is the external-antenna `WROOM-1U`. It already contains the
RF route and antenna connector, so the host board must not add a U.FL RF trace.
With `ANT_EXTERNAL` DNP, firmware must keep Wi-Fi and Bluetooth disabled.
Enabling either radio requires an exact compatible antenna/cable connected
first, followed by connector-retention, routing, clearance, placement, RF, and
regulatory review.

All optional footprints and layout evidence remain unapproved. BP-033 must
derive the exact F-RAM land pattern and exposed-pad treatment from Infineon
drawing `001-85579`; no SOIC land pattern is interchangeable. Fabrication
authority remains denied until BP-033 and BP-300 integrate and independently
verify the populated F-RAM path without silently populating any DNP device.
