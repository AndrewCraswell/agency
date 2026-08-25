# P0 primary-output boundary

P0 has five primary indications: red, green, left white, right white, and a
buzzer. They use one hardware-safe protected driver boundary. This is not a
claim that a lamp or buzzer driver has been selected or released.

## Interface decision

GPIO7, GPIO15, GPIO17, GPIO10, and GPIO11 directly drive the five logic inputs
of one protected output driver. This removes `U_PRIMARY_OUTPUT_LATCH`, its
serial state, and its SPI coupling. The ESP32 has enough uncommitted pins, so
the latch did not earn its place in P0. The GPIOs never drive loads directly.

The driver permit is fail-safe. It may enable an output only when `APP_RESET_N` is
deasserted and independently supervised watchdog health is valid. Before
firmware runs, during reset, brownout, watchdog fault, a missing driver rail,
or a broken permit path, all five outputs are inactive. Every driver input must
also default inactive during reset. Software is never the only safety mechanism.

## Connector candidate

The retained evidence identifies Molex Mini-Fit Jr. `39-29-1067`, a 2 by 3,
4.20 mm right-angle through-hole header, as the candidate for
`J_PRIMARY_OUTPUTS`. Its mate is `39-01-2060` with six
`39-00-0039` terminals. Circuits 1 through 5 are red, green, left white,
right white, and buzzer; circuit 6 is the dedicated driver return.

The existing manufacturer evidence records 9 A per-contact and 105 C
component ratings. Those are not an approved system load, common-return,
temperature-rise, cable, fault, or EMC limit, so the connector remains TBD.

## Deliberately unresolved

No latch is required. No driver or connector is selected because the
external lamp and buzzer supply voltage, steady-state and inrush current,
fault model, common-return current, cable length, and ambient envelope are
unknown. The eventual driver must keep the hardware permit and define
per-channel open, short, and thermal behavior before it can be populated.

The executable contract is
`src/bench-prototype-primary-outputs.ts`. Fabrication remains denied.
