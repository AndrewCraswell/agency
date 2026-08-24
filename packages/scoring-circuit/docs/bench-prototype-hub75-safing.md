# BP-144 reset-safe HUB75 path

`BP-144` is the executable, fail-closed display-output contract. It binds the
committed BP-121 ESP32 GPIO allocation, BP-123 `EN_RESET` ownership, and BP-143
HUB75 connector map. It is not a schematic, footprint, layout, bench, or
fabrication release.

Two exact `SN74AHCT245PWR` buffers run at `V5_DISPLAY_LIMITED`, with DIR
hard-wired A-to-B. Buffer A carries R1/G1/B1/R2/G2/B2/A/B; buffer B carries
C/D/CLK/LAT/OE. Its B outputs connect directly to J_HUB75 pins 1, 2, 3, 5, 6,
7, 9 through 15. Pins 4, 8, and 16 are `APP_GND` logic reference only.
The executable map also freezes each actual TSSOP pin pair, such as A1 pin 2
to B1 pin 18 and A8 pin 9 to B8 pin 11; it does not treat an AHCT bus lane as
an interchangeable generic block.

Every data/address/clock/latch input receives an exact `RC0603FR-0710KL` 10
kOhm pull-down. OE has the same exact 10 kOhm pull-up to V3_3, and panel OE
has an exact 10 kOhm pull-up to `V5_DISPLAY_LIMITED`. Thus reset defaults to
black data and a panel blank request.

Each AHCT has its own exact `C0603C104K3RACTU` 100 nF X7R bypass from pin 20
to `APP_GND`, placed at the buffer. The 5 V logic supply and this bypass remain
layout and bench evidence gates, not a power-good claim.

The carrier names the display supply and return explicitly. `net.V5` reaches
`V5_DISPLAY_LIMITED` only through `J_DISPLAY_DISCONNECT` and `J_LINK_DISPLAY`;
the latter is the removable measurement link. HUB75 buffers, panel OE pullup,
and enable pullups use `V5_DISPLAY_LIMITED`. Their bypasses, pulls, FET sources,
and HUB75 signal grounds use `APP_GND`. The carrier makes the `APP_GND` to
common-board-ground alias explicit at the isolated boundary, rather than using
an ambiguous display `V5` or `GND` net name.

The otherwise unused A6, A7, and A8 inputs on buffer B have their own exact
10 kOhm pulldowns. Their B6, B7, and B8 outputs are intentionally NC: no
connector, test point, or functional net is permitted. The canonical schematic
references are `U_DISPLAY_BUFFER_A`, `U_DISPLAY_BUFFER_B`, and
`R_HUB75_OE_PULLUP`; the older carrier-only names are not valid BP-144 names.
The physical carrier labels those inputs at TSSOP pins 7, 8, and 9 and their
unused outputs at pins 13, 12, and 11. It also includes a dedicated 100 nF
bypass from each buffer pin 20 to `APP_GND`; both the pulldowns and bypasses
are carrier-owned source components and traces, not documentation-only intent.

Each buffer enable is held high by `RC0603FR-0710KL` 10 kOhm to 5 V. Its exact
`BSS138AKA` low-side sink enables the buffer only when `EN_RESET` is high,
through a 10 kOhm gate resistor and an exact `RC0603FR-07100KL` 100 kOhm gate
pull-down. Reset, a missing ESP32, or an unpowered application rail leaves both
buffers high impedance, without a firmware-controlled enable or reset source.

Power-off and backfeed behavior has no approval: V3_3-off/V5-on, V5-off/V3_3-on,
reset/brownout, and panel-disconnected behavior require the listed scope and
injection measurements. Input threshold, edge quality, panel blanking,
connector/footprint evidence, schematic integration, and fabrication remain
**DENY**.

The exported carrier inventory is the one source of live declarations for every
29 BP-144 support reference. It carries the exact MPN, value, package,
manufacturer, and primary source URL, and the TSX consumes its MPN and
footprint on every resistor, capacitor, FET, and buffer. The validator requires
unique physical ownership, exact complete rows, and the selected BP-020 buffer
rows. Missing, duplicate, sentinel, or pre-import drift therefore fails closed;
it does not borrow support identity from BP-123.
