# P0 reset, watchdog, and brownout contract

`BP-123` is the ESP32-only P0 reset contract. It defines one 3.3 V domain and
does not approve a footprint, layout, fabricated board, or bench result.

## One common reset domain

One `TPS389033DSER` supervises `V3_3`. One `TPS3431SDRBR` watches GPIO12.
Their open-drain outputs, plus an open-drain manual reset source, assert
`APP_RESET_N`. That common reset drives `EN_RESET` and keeps the ESP32, W5500,
primary-output disable, and HUB75 safing inactive together. Consumers may
never source either reset net.

`EN_RESET` has the selected `RC0603FR-0710KL` 10 kOhm pull-up and
`C1608X5R1A105K080AC` 1 uF delay capacitor. The supervisor uses selected
`C0603C104K3RACTU` 100 nF CT/bypass capacitors; the watchdog uses the same
bypass part, `RC0603FR-0710KL` CWD resistor, and `RC0603FR-07100KL` GPIO12
pull-up.

The topology deliberately has no STM32, processor isolation, cross-domain
reset, fanout IC, second reset pull-up, or heartbeat reset path.

## Watchdog policy

GPIO12 is open-drain and produces a falling-edge kick at most every 100 ms.
It may do so only after one aggregate epoch confirms acquisition, frame queue,
reference, primary-output, rail, and watchdog health. A stale, incomplete,
high-Z, stuck-high, or stuck-low source produces no repeated edge and lets the
TPS3431 reset the common domain. The frozen watchdog interval and reset pulse
are 170 to 230 ms.

## Evidence still required

Five captures on one identified, assembled prototype remain mandatory:
cold-start, brownout, watchdog/WDI faults, manual/common reset, and
power-off/backfeed. The typed intake requires calibrated instrumentation,
hash-bound artifacts, all named signals, and frozen metric ranges. No evidence
is currently submitted, so all release authority remains denied.

Before any release, `BP-300` must integrate the eight frozen nets, clear ERC,
and prove that primary output and HUB75 safing are reset consumers rather than
reset sources.
