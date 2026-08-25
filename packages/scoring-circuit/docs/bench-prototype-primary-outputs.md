# P0 primary outputs

P0 uses five separate 5 V high-side outputs for visible and audible bench
indications. This is a physical prototype selection, not a production
extension-lamp design or a claim of FIE approval. The executable selection is
[`src/bench-prototype-primary-outputs.ts`](../src/bench-prototype-primary-outputs.ts).

## Selected loads and limits

| Output | Exact P0 load | Electrical limit |
| --- | --- | --- |
| Red | Kingbright `WP7113ID`, 180 ohm quarter-watt series ballast | 10 mA nominal, 30 mA maximum lamp-channel fault current |
| Green | Kingbright `WP7113SGD`, 180 ohm quarter-watt series ballast | 20 mA nominal, 30 mA maximum lamp-channel fault current |
| Left and right white | Two Kingbright `WP7113QWC/D`, each with 180 ohm quarter-watt series ballast | 20 mA nominal each, 30 mA maximum per lamp-channel fault current |
| Buzzer | Same Sky `CMI-9605-0580T` internally driven magnetic indicator | 5 V nominal, 3-7 V operating range, 30 mA nominal |

The P0 source is `V5 = 4.75-5.25 V`. The selected normal load maximum is
110 mA. The protected provision is 150 mA to cover the four lamp channels at
their ballast-limited maximum plus the buzzer. One Toshiba `TBD62783AFWG`
eight-channel source driver supplies the five used outputs; three channels are
unconnected. A `1206L020YR` 0.2 A PPTC protects the shared branch. No added
harness load above 100 nF is permitted. The measured aggregate turn-on
acceptance limit is 150 mA across the source-voltage range.

Primary sources:

- Kingbright red: <https://www.kingbrightusa.com/images/catalog/SPEC/WP7113ID.pdf>
- Kingbright green: <https://www.kingbrightusa.com/images/catalog/spec/wp7113sgd.pdf>
- Kingbright white: <https://www.kingbrightusa.com/images/catalog/SPEC/WP7113QWC-D.pdf>
- Same Sky buzzer: <https://www.sameskydevices.com/product/audio/buzzers/audio-indicators/cmi-9605-0580t>
- Toshiba source driver: <https://toshiba.semicon-storage.com/info/TBD62783AFWG_datasheet_en_20160511.pdf?did=30523&prodName=TBD62783AFWG>
- Littelfuse 1206L PPTC family: <https://www.littelfuse.com/media?resourcetype=datasheets&itemid=8d9c671a-cb91-4a33-a164-24650ba22171&filename=littelfuse-polyfuse-pptc-1206l-datasheet>
- TI connector ESD array: <https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf>

## Driver and safe default

One `TBD62783AFWG` source-driver array feeds the five connector circuits from a
shared 0.2 A PPTC-protected `V5` branch. A `TPD6E05U06RVZR` protects the five
active connector circuits at the board edge. This replaces five load switches
and five permit gates with one driver IC.

The ESP32-S3 is the sole primary-output authority. Its explicitly allocated
nets are GPIO7 red, GPIO15 green, GPIO17 left white, GPIO10 right white, and
GPIO11 buzzer. These are the five signals assigned to the protected primary
lamp and buzzer driver in the processor-support contract.

Every source-driver input has a 100 kilohm pull-down to `APP_GND`. Power-up
before firmware, reset, watchdog loss, and an unpowered ESP32 therefore leave
all five connector circuits de-energized without separate permit gates. The
reset supervisor and GPIO12 watchdog both reset the ESP32 on their faults.

## Harness

`J_PRIMARY_OUTPUTS` remains the keyed Molex Mini-Fit Jr. 2 by 3 header
`39-29-1067`, mated to `39-01-2060` with `39-00-0039` terminals. The P0 cable
is Alpha Wire `1176C SL005`, six 22 AWG conductors, maximum 3 m.

| Circuit | Cable color | Function |
| --- | --- | --- |
| 1 | Red | Red lamp anode feed |
| 2 | Green | Green lamp anode feed |
| 3 | White | Left white lamp anode feed |
| 4 | Orange | Right white lamp anode feed |
| 5 | Blue | Buzzer positive feed |
| 6 | Black | Shared `APP_GND` return |

Primary sources: <https://www.molex.com/en-us/products/part-detail/39291067>
and <https://www.alphawire.com/en/products/cable/alpha-essentials/communication-and-control-cable/1176c>.

## Fault behavior and bring-up

| Condition | P0 behavior |
| --- | --- |
| Open lamp or buzzer | No load-monitoring claim. The output remains non-energizing and a lamp-test observation finds the fault. |
| Commanded output short | The shared 0.2 A PPTC bounds a sustained branch fault. Remove power after any short; no per-channel automatic protection is credited. |
| Reversed connector or remote polarity | The keyed mate prevents reversed connector insertion. A reversed remote load is a de-energized pre-power inspection failure. External voltage must never be applied to an output because reverse-current blocking is not claimed. |
| Thermal event | Remove power, remove the fault, allow the driver and PPTC to cool, then repeat continuity and lamp tests. |

Bring-up must measure remote `V5`, aggregate inrush, all five indications,
reset and watchdog safing, each open and short case, keyed-harness continuity,
and the thermal-recovery sequence. It must also retain physical FIE
qualification as a separate release gate: this P0 hardware does not establish
the m.59 lamp height, visibility, or lumen requirements, the m.51
disconnected-audible 80-100 dB requirement, extension-lamp behavior, EMC,
temperature, vibration, finals-clock isolation, or homologation.
