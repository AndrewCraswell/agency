# Electrical simulation

The prototype uses ngspice to check the carrier circuits whose electrical behavior is under our control. Run every model
with:

```powershell
pnpm --filter @repo/scoring-circuit simulate
```

The runner uses `NGSPICE_BIN` when set, otherwise it checks the normal command path and the user-local Windows ngspice
47 installation. A missing measurement or failed acceptance limit exits unsuccessfully so the command can be used
locally and in CI.
The repository `pnpm verify` command runs the suite, and CI installs ngspice before verification.

## Models and limits

- `primary-regulator-startup.cir` is a separate **LTspice-only candidate experiment**, not one of the ngspice acceptance
  models. It uses ADI's proprietary `LTC3130-1.sub`; that model is not redistributed here. Copy the deck to an output
  directory and run `LTspice.exe -b <deck-path> -I<model-directory>` (no space after `-I`). It compares 4.1V and 20V
  sources with a resistive-equivalent 10mA/300.5mA load step and reduced capacitor values. Model terminals 9/10
  are VS1/VS2, unlike the physical MSOP pin order. This is not an LTM2884 startup-load model or suspend approval.
- The LTC3130 candidate input-network model checks three explicitly assumed scenarios: a 4.75V source with
  0.5-ohm/2uH leads and a 10mA-to-524mA load step; a fast 5V attachment with 0.05-ohm/2uH leads; and a 5V-to-20V
  transition over 500us. Effective input capacitance is 6uF, 8.58uF and 4uF respectively. Limits preserve the 4.1V
  load-budget input floor and the candidate's 25V operating ceiling. This is a passive input-network screen, not a
  converter control-loop model, exhaustive corner sweep or guarantee about customer cables/USB sources. It does not
  validate current limiting, PD negotiation, startup into the real load, output stability, or suspend power.
- The separate native KiCad STM32 draft has a pair/reset sensing model and a seven-conductor scan model. The latter
  checks physical foil, epee, sabre, piste and simultaneous-contact paths, source handover, and seven-input loading.
  Its 350us characterization sweep is not an approved scoring schedule. Nexperia 74LVC125APW buffers and 220-ohm
  drive resistors bring the settled seven-input leakage stress above the unchanged comparator threshold; unpowered
  MCU clamp behavior and actual capture timing remain unvalidated. See the
  [native design's sensing checkpoint](../usb-scoring-platform/README.md#sensing-checkpoint) for values and remaining work.
- The five models below concern the original ESP32 prototype, not validation of the new KiCad design.
- The scoring-conductor model checks the 33 ohm and 470 ohm paths against the ESP32-S3 0.75 VDD high threshold,
  0.25 VDD low threshold, 2 pF pin capacitance, and 28 mA sink-current rating. It includes a two-output contention case,
  continuity through the published FIE 500 ohm external-circuit and 100 ohm earth-path limits, and current stress at
  0, 450, and 475 ohm insulation-fault boundaries.
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

The FIE boundary branches prove only that the carrier presents readable electrical continuity and stays within the
modeled GPIO current limit. They do not prove that firmware classifies foil insulation below 450 ohms versus above 475
ohms, rejects earthed hits, or preserves opponent hits. Those results require the finished scan algorithm plus a
calibrated resistance/contact fixture. The FA-05 Circuit JSON checks independently reject any direct application net on
the external connector side of either 4N32M barrier. Isolation resistance, dielectric withstand, UPS transfer, and the
FIE SEMI apparatus programme remain physical or procedural evidence.
