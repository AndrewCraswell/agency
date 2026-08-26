# GitHub fencing-scoring repository catalog

**Snapshot date:** 2026-08-24

**Scope:** public GitHub repositories that implement, prototype, test, display, or communicate with an electric fencing
scoring apparatus

**Normative source:** [August 2026 FIE Material Rules](../fie-material-rules-2026-08-en.pdf)

This is a reproducible discovery set, not a claim that GitHub exposes a finite or complete list. Repositories can be
private, renamed, deleted, poorly described, or absent from search indexing. In this document, **all found** means every
relevant public repository returned by the query set below, plus repositories reached through README, fork, credit, and
protocol links, after removing unrelated sports and generic scoreboard applications.

Every repository link is pinned to the inspected commit. A pinned source is prior art evidence only. A README claim,
working club prototype, or published timing constant does not demonstrate FIE conformance.

## Most complete repositories

These six repositories are the strongest starting points found for studying a complete scoring-box product, a
weapon-specific implementation, or the acquisition and verification systems around one. The ranking reflects breadth,
inspectable engineering content, rule-shaped behavior, documentation, hardware integration, and verification evidence.
It is not an FIE-conformance ranking. Sentinel and ImprovedTesterAfterGenova are included as high-quality supporting
references; neither is a complete scoring-box implementation.

For a feature-by-feature comparison of this shortlist against the preserved Favero and Skewered manuals, see the
[`open-source commercial feature-gap analysis`](open-source-commercial-feature-gap-analysis.md).

| Rank | Repository and pin | Why it is in the shortlist | Material limitation | License observed |
| --- | --- | --- | --- | --- |
| 1 | [pietwauters/esp32scoringdeviceMqtt@ed6485efeb](https://github.com/pietwauters/esp32scoringdeviceMqtt/tree/ed6485efeb) | Most complete overall system: foil, epee, sabre, calibrated ADC thresholds, score, clock, cards, priority, remotes, and OPP2/Cyrano/FPA integration; paired with a separate open-hardware PCB repository | No automated Annex B weapon-behavior and electrical-boundary suite; firmware does not establish output, power, or homologation compliance | GPL-3.0 |
| 2 | [wnew/fencing_scoring_box@2b1698f599](https://github.com/wnew/fencing_scoring_box/tree/2b1698f599) | Most established minimal all-weapon baseline, with readable Arduino firmware, hardware diagrams, timing research, and a large derivative lineage | Sabre is explicitly missing whipover; repository variants disagree on 120 ms versus 170 ms lockout; verification is manual | GPL-3.0 |
| 3 | [TheGrimReaper13/Copis@c671f790fb](https://github.com/TheGrimReaper13/Copis/tree/c671f790fb) | Strongest compact sabre-specific reference: alternating excitation, qualification, 170 ms lockout, and explicit whipover interruption history | Sabre only; whipover is untested and the README records rare false positives and a self-hit indicator defect | MIT |
| 4 | [joejensen/fencingbox@b14f231e4a](https://github.com/joejensen/fencingbox/tree/b14f231e4a) | Strong legacy physical-product architecture with PCB, PIC firmware, remote control, score workflow, and a PC timing editor | Sabre handler is a stub, so this is not a complete three-weapon implementation; no automated rule suite | GPL-3.0 |
| 5 | [phillip-toone/sentinel@55f8559b31](https://github.com/phillip-toone/sentinel/tree/55f8559b31) | Best architecture and evidence-method reference: phased continuity scanning, explicit physical experiments, host tests, deterministic-core planning, and clear documentation | Architectural design phase; the README explicitly states that production firmware has not been implemented | MIT |
| 6 | [pietwauters/ImprovedTesterAfterGenova@e02b908df8](https://github.com/pietwauters/ImprovedTesterAfterGenova/tree/e02b908df8) | Best companion equipment-tester reference for calibrated resistance, micro-breaks, weapons, body cords, lames, guards, and reels | Tests fencing equipment rather than scoring-apparatus decisions or physical scoring-box outputs | GPL-3.0 |

## Discovery method

The catalog was built with authenticated GitHub repository search, the GitHub `fencing` topic, web search, and citation
chasing. The principal repository queries were:

```text
"fencing scoring" in:name,description
"fencing scoring machine" in:readme
"fencing scoring box" in:readme
fencing scorebox in:name,description
epee scoring arduino in:name,description,readme
foil scoring arduino in:name,description,readme
sabre scoring arduino in:name,description,readme
```

The first query returned 57 repositories on the snapshot date. Broader weapon queries produced many false positives,
which were inspected before exclusion. A cross-check against
[`fencing-software-ecosystem-corpus.md`](../../fencing-software-ecosystem-corpus.md) added OpenPiste ecosystem, tester, and
output-adapter repositories that the scoring-machine terms did not return. The local candidate set contained 90 cloned
repositories; 89 were retained across scoring, hardware, tester, protocol, remote, repeater, and simulator roles. The
excluded cloned candidate, `MOconnorUS/ece484_final_individual_project`, is a pinball scorer returned by a broad foil
query.

License values below describe the inspected tree, not legal advice. `None observed` means no root or nested
`LICENSE`, `LICENCE`, or `COPYING` file was found. Public visibility alone does not grant a right to copy code.

## Direct scoring implementations

These repositories contain source or a binary intended to turn weapon-line observations into hit or diagnostic
signals. `Rule tests` means automated or fixture-level tests of weapon behavior; UI, library, and component smoke tests
do not qualify.

| Repository and pin | Weapons and implementation | Evidence and material gap | License observed |
| --- | --- | --- | --- |
| [pietwauters/esp32scoringdeviceMqtt@ed6485efeb](https://github.com/pietwauters/esp32scoringdeviceMqtt/tree/ed6485efeb) | Current OpenPiste ESP32 implementation; foil, epee, sabre; score, clock, cards, OPP2/Cyrano/FPA | Broadest active implementation found. Uses calibrated resistance thresholds, weapon modules, 300/45/170 ms lockouts, and sabre whipover handling. Host tests cover protocols, not the Annex B weapon matrix. | GPL-3.0 |
| [wnew/fencing_scoring_box@2b1698f599](https://github.com/wnew/fencing_scoring_box/tree/2b1698f599) | Arduino foil, epee, sabre | Influential baseline. The combined sketch uses 14 ms, 2 ms, 1 ms and 300/45/170 ms; standalone sabre-related sketches still contain 120 ms. README says sabre lacks whipover. Manual scope claim only. | GPL-3.0 |
| [joejensen/fencingbox@b14f231e4a](https://github.com/joejensen/fencingbox/tree/b14f231e4a) | JBox PCB, PIC firmware, remote, PC timing editor | Foil defaults 13 ms/300 ms and epee 5 ms/45 ms. The sabre handler returns immediately, so the advertised three-weapon surface is not a three-weapon scoring implementation. No rule suite found. | GPL-3.0 |
| [RobinsonZ/fencing-scoring@ecd2fb137d](https://github.com/RobinsonZ/fencing-scoring/tree/ecd2fb137d) | Arduino/Circuit Playground foil, epee, sabre state machines | Clear state-machine prior art with 14/2 ms and 300/45/170 ms constants. Sabre deliberately omits a 100 us qualification and whipover; source acknowledges its diagnostic colors are not compliant. Archived. | None observed |
| [mschnur/inexfensive@31dce8279c](https://github.com/mschnur/inexfensive/tree/31dce8279c) | Arduino three-weapon apparatus and hardware | Useful six-line model and explicit sabre whipover history. Authors report epee works but foil/sabre are unreliable because voltages are ambiguous and sampling is too slow. Sabre lockout remains obsolete at 120 ms. | GPL-3.0 |
| [jc0019/diy-fencing-scoring-box@2e8bb5b08b](https://github.com/jc0019/diy-fencing-scoring-box/tree/2e8bb5b08b) | Foil-only Arduino box and independent Arduino timing jig | Continuous 14 ms qualification, 300 ms window, enclosure, and manual sweep fixture. Good tester prior art, but no resistance sweep, automated verdict, epee scorer, or sabre scorer. | None observed |
| [jamesw98/foss-box@155c450d59](https://github.com/jamesw98/foss-box/tree/155c450d59) | Current epee-only RP2350/ESP32-S3 MicroPython/CircuitPython box with display and BLE remote | Ground/guard rejection and a 40 ms second-hit wait are present, but `check()` treats a sampled GPIO as a hit without the required 2 ms qualification. No weapon rule tests found. | GPL-3.0 |
| [TheGrimReaper13/Copis@c671f790fb](https://github.com/TheGrimReaper13/Copis/tree/c671f790fb) | Sabre-only Arduino box | Alternating excitation, 600 us qualification, 170 ms lockout, and explicit 4/15 ms, ten-interruption whipover logic. README says whipover is untested and records rare false positives plus a self-hit indicator bug. | MIT |
| [marcusdeng22/scoringbox@928f7e1a31](https://github.com/marcusdeng22/scoringbox/tree/928f7e1a31) | Raspberry Pi Pico foil/epee circuit and scorer | Six-channel ADC scan is measured at about 62 us. Sabre is disabled because self-contact and blade-contact states are electrically ambiguous. No Annex B resistance or behavior suite. | BSD-3-Clause |
| [marthinwurer/scoring-machine@6b97850d6d](https://github.com/marthinwurer/scoring-machine/tree/6b97850d6d) | Arduino three-weapon apparatus | README reports club use, foil/epee complete, sabre 75 percent and needing whipover/better timing. No rule tests found. | None observed |
| [swordsgnat/Fencing_Box_Brain@2bc1b7fe45](https://github.com/swordsgnat/Fencing_Box_Brain/tree/2bc1b7fe45) | Large Arduino three-weapon scorer, clock, remote, score workflow | Uses 300/45/170 ms and epee 2 ms constants with explicit state. Source retains unresolved foil transition and timing questions; no resistance/whipover conformance suite found. | GPL-3.0 |
| [tkronrod21/ScoringMachine@f7ec2aca36](https://github.com/tkronrod21/ScoringMachine/tree/f7ec2aca36) | Arduino acquisition plus Java desktop scoring workflow | Firmware is in the wnew family and retains obsolete 120 ms sabre timing. Java tests exercise higher-level clock/touch classes, not electrical Annex B boundaries. | None observed |
| [konnor-s/FencingScoringDevice@731094722f](https://github.com/konnor-s/FencingScoringDevice/tree/731094722f) | Arduino three-weapon scorer | Implements 14/2/1 ms and 300/45/120 ms scalar timing. The sabre value is obsolete and no whipover or rule tests were found. | None observed |
| [cyamada/Fencing@2eebb15073](https://github.com/cyamada/Fencing/tree/2eebb15073) | Arduino foil/epee apparatus | Early implementation that claims USA Fencing timing. Partial source and no rule-level evidence or released schematic. | None observed |
| [digitalWestie/foilBox@e54d310170](https://github.com/digitalWestie/foilBox/tree/e54d310170) | Simple Arduino foil box | Useful minimal foil topology. Repository notes that its multiweapon code does not work correctly. No resistance or rule tests. | None observed |
| [mrfett/scoring_machine@e73b4a3092](https://github.com/mrfett/scoring_machine/tree/e73b4a3092) | Arduino scoring-machine source | Buildable historical implementation, with sparse behavior documentation and no FIE trace or rule suite. | None observed |
| [keaheyp/421_521_final_project@e2c030cbfd](https://github.com/keaheyp/421_521_final_project/tree/e2c030cbfd) | Arduino epee prototypes for a planned three-weapon box | Several revisions expose useful timing mistakes: one uses `4500 us` while describing 45 ms. No completed foil/sabre authority or rule suite. | None observed |
| [kianryan/fencing_box@c31641f0df](https://github.com/kianryan/fencing_box/tree/c31641f0df) | Early Arduino foil/epee sketches | Basic contact and light behavior; no current rule provenance, resistance model, or boundary evidence. | None observed |
| [madelinecr/fencing-referee@d36a126229](https://github.com/madelinecr/fencing-referee/tree/d36a126229) | Arduino/C++ scorer plus Eagle controller files | Small historical student implementation with no current rule trace or test evidence. | None observed |
| [tf216/Fencing_box@6a656bc8db](https://github.com/tf216/Fencing_box/tree/6a656bc8db) | PIC assembly scorer with hit, timing, score, and LCD modules | Low-level firmware prior art; no readable rule mapping, current FIE provenance, or automated boundary evidence. | None observed |
| [Philipmarsh/FencingBoxPython@05af44d769](https://github.com/Philipmarsh/FencingBoxPython/tree/05af44d769) | Raspberry Pi/Python scoring-box prototype | Direct GPIO prototype; no complete electrical model or FIE boundary suite. | None observed |
| [BorisBojanov/ScoreBox_Fencing@a7014fab13](https://github.com/BorisBojanov/ScoreBox_Fencing/tree/a7014fab13) | ESP32 epee scorer | Conflicting lockout definitions include 40 ms and 3000 ms, with 10 ms debounce. It is not usable as a rule reference without correction. | GPL-3.0 |
| [bhuvan21/OpenBox@47c8087af7](https://github.com/bhuvan21/OpenBox/tree/47c8087af7) | Arduino hardware and partial foil practice mode | README explicitly says scoring software is unfinished. Tests are display, rotary, pixel, and piezo component checks. | None observed |
| [thomasrwolfgang/EnGarde-Fencing-Scoring-System@3c593765e5](https://github.com/thomasrwolfgang/EnGarde-Fencing-Scoring-System/tree/3c593765e5) | Arduino/BLE wireless scorer | Source and diagrams exist, but no current rule trace or electrical boundary suite. | None observed |
| [behnam5106/Fencing-Scoring-Box@6f8e52ce59](https://github.com/behnam5106/Fencing-Scoring-Box/tree/6f8e52ce59) | AVR epee/sabre PCB, enclosure, and compiled HEX | No source is present, so behavior claims and the filename referring to a new sabre time are not auditable. | None observed |
| [XiangyiTan/Arduino-Fencing-Scoring-Machine@2015048f07](https://github.com/XiangyiTan/Arduino-Fencing-Scoring-Machine/tree/2015048f07) | Epee-themed Arduino scoreboard driven by pushbuttons | Simulates tip buttons but does not implement weapon-line, 2 ms, double-hit, resistance, or grounded-material behavior. | None observed |

## wnew lineage and adaptations

These repositories copy, adapt, credit, or closely reproduce the wnew circuit and scoring structure. They are useful as
deployment and enclosure ideas, but they are not independent confirmation that the common algorithm conforms.

| Repository and pin | Relationship and distinguishing work | License observed |
| --- | --- | --- |
| [acroscarrillo/FencingBox@dddbacae35](https://github.com/acroscarrillo/FencingBox/tree/dddbacae35) | Low-cost hardware package around the wnew all-weapon structure and constants. | Proprietary/all rights reserved |
| [emcannaert/Fencing-Scoring-Machine@210e72d7b3](https://github.com/emcannaert/Fencing-Scoring-Machine/tree/210e72d7b3) | Credits wnew touch registration; adds score, time, and display behavior. | GPL-3.0 |
| [robinterry-github/fencing_scoring_box_mk1@396eba27bd](https://github.com/robinterry-github/fencing_scoring_box_mk1/tree/396eba27bd) | Credits wnew and digitalWestie; adds remote, timer, score, and enclosure work. | GPL-3.0 |
| [sparpo/Fencing-Box---RGB-display@f975e9c4f3](https://github.com/sparpo/Fencing-Box---RGB-display/tree/f975e9c4f3) | RGB-display adaptation of the wnew apparatus. | None observed |
| [VijayFencer/Fencing-Apparatus@098ad5ac76](https://github.com/VijayFencer/Fencing-Apparatus/tree/098ad5ac76) | README and scorer are close to wnew; inherits the incomplete sabre behavior. | GPL-3.0 |
| [senjabl/fencing_scoring_box@0c5ec126ae](https://github.com/senjabl/fencing_scoring_box/tree/0c5ec126ae) | Older wnew-derived tree plus vendored Arduino libraries; README says foil 90, epee 100, sabre 50. | GPL-3.0 |
| [punkyman/wireless_fencing_box@3271752a41](https://github.com/punkyman/wireless_fencing_box/tree/3271752a41) | Wireless experiments built around wnew scoring code. | GPL-3.0 |
| [chrogram/wireless_UA_fencing_scoring_box@dd9050469f](https://github.com/chrogram/wireless_UA_fencing_scoring_box/tree/dd9050469f) | Foil wireless experiments and copied wnew-style scorer; retains obsolete 120 ms sabre data even though only foil is active. | None observed |
| [wnew/arduino_projects@dd77b3e327](https://github.com/wnew/arduino_projects/tree/dd77b3e327) | Earlier wireless-fencing sketches and project notes; experimental predecessor, not the canonical wnew scorer. | None observed |

## Wireless and limited-purpose scoring prototypes

| Repository and pin | Scope and present limitation | License observed |
| --- | --- | --- |
| [Yohannfra/Touche@bc853ff1bb](https://github.com/Yohannfra/Touche/tree/bc853ff1bb) | nRF24 open hardware, principally epee. README says capacitive grounding is unusably buggy and foil/sabre are future work. | GPL-3.0 |
| [MatthewKazan/Bluetooth-Fencing-Scoring-System@76a7e9bea0](https://github.com/MatthewKazan/Bluetooth-Fencing-Scoring-System/tree/76a7e9bea0) | Wireless epee training prototype. README disclaims grounding, guard/piste rejection, and accurate timing. | None observed |
| [rpi-iot-projects/2026-Team-13-Wireless-Fencing-Scorer@b8cb313f84](https://github.com/rpi-iot-projects/2026-Team-13-Wireless-Fencing-Scorer/tree/b8cb313f84) | Pico wireless epee project derived from MatthewKazan; explicitly targets training rather than wired reliability. | MIT |
| [EdwardBrodskiy/Wireless-Fencing-Box@5450eb0f83](https://github.com/EdwardBrodskiy/Wireless-Fencing-Box/tree/5450eb0f83) | NRF24/RF433 carry modules; README records loop latency changing from about 1 ms to 12 ms under serial output. | None observed |
| [RafiqNuqman12/Wireless-Fencing-Scoring-System@d43d86a138](https://github.com/RafiqNuqman12/Wireless-Fencing-Scoring-System/tree/d43d86a138) | ESP-NOW epee/foil student prototype, mixed wired code, wireless code, and flowcharts. | None observed |
| [lolorahaingo/wireless_fencing@f29bb83eda](https://github.com/lolorahaingo/wireless_fencing/tree/f29bb83eda) | Pico W foil frequency-detection research. Current tree is Phase 1 R&D; 15 ms dwell and 300-350 ms lockout are plans, not a completed scorer, and 350 ms exceeds the FIE foil tolerance. | None observed |
| [Krsma/Fencer-personal-scoring-machine@ea130f3600](https://github.com/Krsma/Fencer-personal-scoring-machine/tree/ea130f3600) | Small personal wireless/portable scoring experiment. | MIT |
| [Krsma/Fencing-scoring-system@016e8de682](https://github.com/Krsma/Fencing-scoring-system/tree/016e8de682) | Central and fencer Arduino sketches; no FIE rule trace or boundary suite. | MIT |
| [Vilda007/ArduinoFencingScoringDetection@c782a6bba1](https://github.com/Vilda007/ArduinoFencingScoringDetection/tree/c782a6bba1) | Single-sketch hit-detection/display experiment without weapon timing qualification. | GPL-3.0 |
| [Vilda007/ArduinoWiFiFencingScoringDetection@2334175679](https://github.com/Vilda007/ArduinoWiFiFencingScoringDetection/tree/2334175679) | ESP8266 mesh base/portable experiment; no complete Annex B behavior. | None observed |
| [Vilda007/ArduinoWiFiFencingScoringDetection2@db87093fb0](https://github.com/Vilda007/ArduinoWiFiFencingScoringDetection2/tree/db87093fb0) | Second client/server Wi-Fi experiment; no rule suite. | GPL-3.0 |
| [swatkinson/Wireless-Fencing-Piste@9ec01aa787](https://github.com/swatkinson/Wireless-Fencing-Piste/tree/9ec01aa787) | Wearable mask-light/epee-tip experiment, not a full apparatus. | None observed |
| [leCloudy/ESP32NowFencingPiste@564b7c5a64](https://github.com/leCloudy/ESP32NowFencingPiste/tree/564b7c5a64) | README-only ESP-NOW epee proposal; no implementation. | None observed |
| [OpenFencing/Wireless@689305930f](https://github.com/OpenFencing/Wireless/tree/689305930f) | Wireless detection research notes; README says the radio idea works but no scoring firmware is present. | GPL-3.0 |
| [Open-Fencing-Solutions/ofb@ff1b767e7b](https://github.com/Open-Fencing-Solutions/ofb/tree/ff1b767e7b) | Open Fencing Box directory skeleton; firmware, hardware, and software directories contain README placeholders only. | GPL-3.0 |
| [PaulMichell/Allez@5240723fef](https://github.com/PaulMichell/Allez/tree/5240723fef) | Two-file scoring-system placeholder with no source. | GPL-2.0 |
| [Shadowducky/HFHSSeniorDesignFencingBox@5303319aaa](https://github.com/Shadowducky/HFHSSeniorDesignFencingBox/tree/5303319aaa) | Two extensionless artifacts for a wireless senior-design project; no inspectable rule source. | None observed |
| [Shlepzig/ArduinoFencingBox@cdb8e75f69](https://github.com/Shlepzig/ArduinoFencingBox/tree/cdb8e75f69) | Sparse Arduino/Python-interface experiment with extensionless source artifacts. | None observed |

## Architecture, hardware, testers, protocols, remotes, and displays

These are useful references but are not scoring authorities. A protocol packet, repeater lamp, remote action, or tester
stimulus must never create or reclassify a hit.

| Repository and pin | Role | License observed |
| --- | --- | --- |
| [phillip-toone/sentinel@55f8559b31](https://github.com/phillip-toone/sentinel/tree/55f8559b31) | New 21-pair continuity-scanner architecture, host tests, and physical settling experiments. README explicitly says production firmware is not implemented. | MIT |
| [pietwauters/esp32_scoring_device_hardware@4af00be1be](https://github.com/pietwauters/esp32_scoring_device_hardware/tree/4af00be1be) | OpenPiste hardware companion. | GPL-3.0 |
| [pietwauters/esp32-scoring-device@e5514dc99d](https://github.com/pietwauters/esp32-scoring-device/tree/e5514dc99d) | Legacy OpenPiste firmware; README directs users to `esp32scoringdeviceMqtt`. Keep separate because its timing constants differ. | GPL-3.0 |
| [AjaxTheLesser/FencingTimingTester@f2aa0d1f51](https://github.com/AjaxTheLesser/FencingTimingTester/tree/f2aa0d1f51) | Arduino apparatus timing tester; historical stimulus prior art. | GPL-3.0 |
| [skewered-fencing/protocol@670bd0f647](https://github.com/skewered-fencing/protocol/tree/670bd0f647) | Scoring-box communication protocol specification. | MIT |
| [skewered-fencing/development@80c59948bd](https://github.com/skewered-fencing/development/tree/80c59948bd) | One-file project-development placeholder. | None observed |
| [seigel/cyrano@46242074ce](https://github.com/seigel/cyrano/tree/46242074ce) | Cyrano protocol tools and libraries. | MIT |
| [BoriszVarkonyi/cyrano-rust@64d5f727f4](https://github.com/BoriszVarkonyi/cyrano-rust/tree/64d5f727f4) | Rust Cyrano protocol implementation. | None observed |
| [pietwauters/remotecontrolapp@2c0d2469fb](https://github.com/pietwauters/remotecontrolapp/tree/2c0d2469fb) | OpenPiste phone remote. | None observed |
| [pietwauters/CYDRemoteControl@9f2d7c832b](https://github.com/pietwauters/CYDRemoteControl/tree/9f2d7c832b) | OpenPiste ESP32 CYD remote. | None observed |
| [pietwauters/openpiste-bridge@66956d4fe4](https://github.com/pietwauters/openpiste-bridge/tree/66956d4fe4) | OpenPiste scoring-device bridge. | None observed |
| [pietwauters/CyranoPisteMonitor@c51b927fb1](https://github.com/pietwauters/CyranoPisteMonitor/tree/c51b927fb1) | OpenPiste piste monitor and display integration. | None observed |
| [OpenPiste/protocols@9deb194edb](https://github.com/OpenPiste/protocols/tree/9deb194edb) | OpenPiste protocol definitions. | MIT |
| [OpenPiste/opp2-library@eb5e5f6e12](https://github.com/OpenPiste/opp2-library/tree/eb5e5f6e12) | OPP2 protocol library. | MIT |
| [davidsmakerworks/fencing-score-xmit@a569d0d047](https://github.com/davidsmakerworks/fencing-score-xmit/tree/a569d0d047) | Remote scoring-light transmitter. | MIT |
| [davidsmakerworks/fencing-score-recv@3b3785ec71](https://github.com/davidsmakerworks/fencing-score-recv/tree/3b3785ec71) | Remote scoring-light receiver. | MIT |
| [vehemont/Favero_Repeater@4e0a0c42f9](https://github.com/vehemont/Favero_Repeater/tree/4e0a0c42f9) | Favero repeater-output adapter. | GPL-3.0 |
| [vehemont/arduino@1479de8340](https://github.com/vehemont/arduino/tree/1479de8340) | VSM-controlled LED matrix; consumes a scorer's output. | None observed |
| [BenKohn2004/Favero_Overlay@03b2a8675e](https://github.com/BenKohn2004/Favero_Overlay/tree/03b2a8675e) | Favero output overlay. | GPL-3.0 |
| [Gioee/fav3er0-master-emulator@12ee2fc7ec](https://github.com/Gioee/fav3er0-master-emulator/tree/12ee2fc7ec) | Favero protocol/device emulator. | None observed |
| [BenKohn2004/Mask_Lights@c639c19b6c](https://github.com/BenKohn2004/Mask_Lights/tree/c639c19b6c) | Mask/external-light adapter. | GPL-3.0 |
| [BenKohn2004/Fencing_Light_OBS_Overlay@ffa01d4844](https://github.com/BenKohn2004/Fencing_Light_OBS_Overlay/tree/ffa01d4844) | Broadcast overlay consuming scoring-light state. | GPL-3.0 |
| [UAHFencingClub/SG12_ScoringExtensionLights@f2b1ec6082](https://github.com/UAHFencingClub/SG12_ScoringExtensionLights/tree/f2b1ec6082) | SG12 extension-light PCB/enclosure. | CC BY 4.0 and CC BY-SA 4.0 assets |
| [UAHFencingClub/SG12_SerialInterface@8c055b9cd7](https://github.com/UAHFencingClub/SG12_SerialInterface/tree/8c055b9cd7) | SG12 serial-interface accessory. | GPL-2.0 |
| [BenKohn2004/TCFC_Lighting@a6ad22473f](https://github.com/BenKohn2004/TCFC_Lighting/tree/a6ad22473f) | Club lighting driven by scoring outputs. | GPL-3.0 |
| [BenKohn2004/Mask_Lights_and_VSM@017bf74f01](https://github.com/BenKohn2004/Mask_Lights_and_VSM/tree/017bf74f01) | Mask lights and VSM integration. | None observed |
| [pietwauters/ImprovedTesterAfterGenova@e02b908df8](https://github.com/pietwauters/ImprovedTesterAfterGenova/tree/e02b908df8) | Active resistance/micro-break weapon, body-cord, lame, guard, and reel tester; equipment tester, not scoring authority. | GPL-3.0 |
| [pietwauters/WeaponWireTester@f44d5526ef](https://github.com/pietwauters/WeaponWireTester/tree/f44d5526ef) | Predecessor ESP32 weapon/body-wire tester. | Apache-2.0 |
| [aarjaneiro/fencing_testbox@419a62054c](https://github.com/aarjaneiro/fencing_testbox/tree/419a62054c) | Flipper Zero fencing testbox emulator. | MIT |
| [DeanK2022/BladeOMatic@b71bed684e](https://github.com/DeanK2022/BladeOMatic/tree/b71bed684e) | Automated foil/epee/sabre blade tester. | None observed |
| [antsar/armory-dashboard@a3250fc393](https://github.com/antsar/armory-dashboard/tree/a3250fc393) | Armory equipment workflow dashboard. | MIT |
| [cy6erskunk/fencing-scoring-machine@27b4ef384c](https://github.com/cy6erskunk/fencing-scoring-machine/tree/27b4ef384c) | Tested React remote-control simulator; README says it is not a scoring system. | MIT |
| [feelixs/fencing_scoring@9d2a2aa5a5](https://github.com/feelixs/fencing_scoring/tree/9d2a2aa5a5) | Game/health UI consuming VSM HID states; VSM remains scoring authority. | MIT |
| [titanicdeath/fess-scoring-software@3c4f55563f](https://github.com/titanicdeath/fess-scoring-software/tree/3c4f55563f) | PyQt bout UI and FRIMB/repeater input bridge; not weapon-line scoring logic. | None observed |
| [thomaspingel/epee@fa2e78a481](https://github.com/thomaspingel/epee/tree/fa2e78a481) | Browser epee scoring-box simulation, not physical line acquisition. | MIT |
| [NicolasDrapier/cyrano@4327d23820](https://github.com/NicolasDrapier/cyrano/tree/4327d23820) | Additional Cyrano protocol implementation. | MIT |

## Refresh procedure

On each rules release or scheduled prior-art refresh:

1. Re-run the documented queries and the GitHub `fencing` topic search.
2. Compare redirects, archived state, default-branch commit, README claims, license, and test tree.
3. Add newly cited repositories and record explicit exclusions for plausible false positives.
4. Re-run the rule comparison in [fencing-scoring-prior-art-analysis.md](fencing-scoring-prior-art-analysis.md).
5. Never silently advance a pin used as evidence. Add a new pin and describe the behavior change.

The next refresh should also search GitLab, SourceForge, Hackaday, vendor firmware downloads, and academic repositories.
Those sources were outside this GitHub-specific pass; JBox's README, for example, points to an older SourceForge project.
