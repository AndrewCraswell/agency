# Communications module architecture

## Status

`communications-module.circuit.tsx` is the canonical isolated communications-module connectivity model. It is an architecture and review aid only. It is not a PCB, a released schematic, or fabrication evidence. The production decision remains **DENY**.

The module owns the only external powered attachment point and the external Ethernet connector:

- Amphenol `10177070-00011LF` USB-C UFP
- `TPD4S201TRGRRQ1`, `TPS25730ADREFR`, `TVS2200DRVR`, and `TPS259474ARPWR` USB-PD/eFuse chain
- a local 20 V-to-`COMM_3V3` conversion stage using the valid fixed-output `LMR43620MSC3RPERQ1` with its required support network
- `W5500` and Würth `7499011121A` integrated-magnetics RJ45, including all MDI pairs on this PCB
- the selected W5500 oscillator, EXRES, TOCAP, 1V2O, ferrite-input bypass, ferrite, VDD bypass, and six AVDD bypass references
- Molex Micro-Fit power and control harnesses and the Samtec USB2 harness endpoint

The target application carrier owns the ESP32, display, audio, and application `V3_3`; it does not own a W5500, RJ45, USB-C entry, or PD chain. Its canonical circuit has `J_PWR_CARRIER` for post-eFuse 20 V and `J_USB2_CARRIER` for the native USB2 pair. The carrier has no raw VBUS, CC, USB-C shell, or PD/eFuse circuit. This resolves the ownership boundary but does not release fabrication.

## Power and reset safety

The external USB-C port negotiates the provisional 20 V, 3 A contract. The eFuse output is the only source for `J_PWR.V20_EFUSE_OUT` and for the module's local `COMM_3V3` regulator input.

`COMM_3V3` is supervised by `TPS389033DSER`. The 10 kOhm reset pull-up drives only W5500 reset and the high-impedance input of `SN74LVC1G34DCKR`; the buffer drives the separate `COMM_IO_ENABLE` net and its five 100 kOhm OE pull-downs. A separate 1 MOhm buffer-input pull-down keeps the enable source defined while unpowered. At 3.135 V minimum rail, 10.1 kOhm maximum pull-up, and 0.99 MOhm minimum pull-down, reset release is at least 3.103 V. This exceeds a conservative 2.426 V W5500 input-high limit at 3.465 V maximum rail by 0.677 V. The buffer's output drives less than 0.18 mA through all five worst-case OE pull-downs, far below its rated output test current. Therefore no J_CTRL signal can back-power the unpowered module through W5500 I/O. `W5500_MISO` also has a local 100 kOhm pull-down.

`COMM_RESET_ASSERT` is a reserved active-high fixture request, not a firmware-driven carrier signal. The carrier has no
allocated GPIO: it exposes only a test pad and 100 kOhm pull-down. A fixture assertion drives the gate of module-local
`BSS138AKA`; the FET source goes to module ground and its drain only pulls `W5500_RST_N` low. It cannot drive the W5500
reset high or bypass the local supervisor. `COMM_PRESENT_N` is test-point-only status and `W5500_INT_N` is
polling/test-point-only on the carrier.

## Ground and shield boundary

The USB-C shell, RJ45 shield, USB2 harness metalwork, and connector-entry TVS return bond to `CHASSIS`. Signal grounds go only to `GND`. The architecture has no `CHASSIS` to `GND` trace or link. `J_USB2` assigns only `USB_DN`, `USB_DP`, and `SHIELD`: it has no separate signal-ground conductor. The USB2 shield is not a signal return; application-ground reference continuity comes only through the paired `J_PWR` return conductors.

## Test access

The connectivity model defines test points for port VBUS, PD PPHV, eFuse output, `COMM_3V3`, the supervised I/O enable, and W5500 reset. These are logical test points, not an approved mechanical or probe-access layout.

## Required closure before fabrication

1. Independently close the `LMR43620MSC3RPERQ1` power stage: exact footprint, inductor and capacitor ratings, layout, thermal, surge, and current tests.
2. Import manufacturer footprints, mask, paste, courtyard, pin one, shell/stake, and enclosure data for USB-C, PD protection, eFuse, regulator, W5500, MagJack, Molex, and Samtec parts. Keep them DNP until each record is released.
3. Close the W5500 support layout on the released 110 mm by 55 mm, four-layer, 0.8 mm module: the already modeled regulator-output capacitors provide the `COMM_3V3` bulk supply upstream of the selected ferrite-input bypass, while all six AVDD pins and VDD have a selected local 100 nF reference. These references are DNP with zero fabrication artifacts until exact passive footprints, placement, AVDD/VDD impedance, oscillator, PI, SI, and EMC review close.
4. Validate power-off I/O leakage, supervisor sequencing, W5500 reset, SPI timing, USB high-speed eye, Ethernet SI, ESD, surge, EFT, common-mode emissions, chassis current, and thermals on the released four-layer, 0.8 mm stack-up.
5. Verify no signal or shield return creates an uncontrolled `GND` to `CHASSIS` bond, and validate the de-energized-only internal service procedure.
6. Confirm that the communications-module USB protector remains a shunt on the connector nets and that the only 22 ohm series pair is carrier-local between `J_USB2_CARRIER` and the ESP32.
