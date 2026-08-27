# Electrical simulation

The prototype uses ngspice to check the carrier circuits whose electrical behavior is under our control. Run every model
with:

```powershell
pnpm --filter @repo/scoring-circuit simulate
```

The runner uses `NGSPICE_BIN` when set, otherwise it checks the normal command path and the user-local Windows ngspice
47 installation. A failed measurement exits unsuccessfully so the command can be used locally and in CI.
The repository `pnpm verify` command runs the suite, and CI installs ngspice before verification.

## Models and limits

- The scoring-conductor model checks the 33 ohm and 470 ohm paths against the ESP32-S3 0.75 VDD high threshold,
  0.25 VDD low threshold, 2 pF pin capacitance, and 28 mA sink-current rating. It includes a two-output contention case.
- The display-power model applies a 4.2 A panel step plus 0.7 A of other board load. It checks the 5.5 A regulator limit,
  a 4.75 V board rail, and a 4.5 V panel rail through modeled board, connector, and harness resistance.
- The IR model applies a receiver-current step to the fitted 100 ohm and 100 nF supply filter.
- The sounder model switches a 15 nF piezoelectric load at 4 kHz through the fitted 1 kohm gate resistor, 100 kohm
  pulldown, and BSS138.
- The FA-05 model checks the 82 ohm optocoupler input and a 15 V, 20 mA-class external loop. Its behavioral 4N32M
  boundary scales the data-sheet minimum 500 percent CTR at 10 mA and uses a conservative 100 microsecond release
  constant. The data sheet does not guarantee that CTR at the modeled lower LED current, so the assembled loop still
  requires measurement.

These are engineering checks, not fabrication or FIE-conformance proof. The USB-C PD negotiation, Pololu regulator
internals, WIZ850io internals, ESP32 internals, HUB75 panel internals, EMC, ESD, and thermal behavior remain outside the
models because the selected purchased modules do not provide complete transistor-level models. The chosen HUB75 panel
must draw no more than the modeled 4.2 A until this limit is rerun with its measured current profile.
