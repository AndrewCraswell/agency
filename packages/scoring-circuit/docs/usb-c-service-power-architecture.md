# USB-C PD power and service-port architecture

**Decision date:** 2026-08-23
**Scope:** retained USB-C component and configuration evidence applied to the
active one-board bench prototype. This is not a released schematic, PCB, or
fabrication approval. Earlier communications-module/carrier partitioning is
not the active prototype topology.

## Role and power policy

USB-C is the **sole external apparatus-power input** and a USB 2.0 UFP service-data port. The apparatus has no internal battery, no charging function, no source role, no PD dual-role behavior, and no second locking 24 V inlet. Removing the former inlet avoids source arbitration and a backfeed path.

The provisional shipped adapter and requested contract are **USB-PD SPR 20 V, 3 A, 60 W**. This works with ordinary 3 A USB-C cables. The selected connector and PD controller have 20 V, 5 A physical capability, but 5 A/100 W is unapproved reserve capacity, not a product requirement and not a reason to require an e-marked 5 A cable. USB-PD 3.1 EPR at 28 V is not selected. Reconsider it only if the released rail and thermal budget exceeds the defensible 20 V SPR envelope.

Native ESP32-S3 USB remains GPIO19 = D- and GPIO20 = D+. On the active
one-board bench prototype, D+/D- stay on-board: they receive connector-side
`TPD2EUSB30DRTR` shunt protection, then pass through the only 22 ohm series
pair before reaching the ESP32-S3. There is no active `J_USB2` inter-board
handoff. No PD controller owns or remaps the USB 2.0 data pair.

The former service-only VBUS-valid supervisor and ESP GPIO do not exist in this
power-input architecture. Consequently, the self-powered USB 4.75 V valid-rise,
4.35 V invalid-fall, and unplug-to-GPIO-low requirements do not apply to a
nonexistent VBUS sense input. VBUS is never connected to an ESP GPIO. The PD
qualification instead measures PPHV/eFuse shutdown on detach and confirms that
USB service attaches only with the apparatus safely powered after a successful
contract.

## Retained component evidence and active one-board topology

The component identities, PD straps, and protection calculations below remain
technical evidence. References inherited from the earlier model do not prove
that a separate communications board or carrier exists. BP-050's active power
path is USB-C → PD controller/PPHV → upstream eFuse → the de-energized physical
source selector → on-board 20 V-to-V5 converter. The selector's alternate
input is the bench-only `LAB_POST_EFUSE_20V` injection; simultaneous sources
are prohibited.

| Reference | Selected item | Required configuration and connection |
| --- | --- | --- |
| `J_USB_C` | Amphenol `10177070-00011LF` | Sole USB-C receptacle. Its 20 V, 5 A contact rating is a component ceiling. Shell returns to the chassis ESD region; final chassis bonding remains an enclosure/EMC gate. |
| `U_USB_PORT_PROTECT` | TI `TPD4S201TRGRRQ1` | Protects CC1, CC2, SBU1, and SBU2 against IEC ESD and short-to-20 V VBUS. Connector CC1/2 enter its `C_CC1/C_CC2`; its `RPD_G1/G2` return to those own nodes for dead-battery attach; its protected `CC1/CC2` route to TPS25730A `CC1/CC2`. The 330 pF capacitors are on those protected controller nodes. Unused SBU1/2 use the device's matching protected channels and do not carry USB2 data. `/FLT` goes to `FAULT_IN_N` with a 10 kOhm LDO pullup. `VPWR` comes from the PD LDO; VBIAS is 100 nF, 50 V X7R. |
| `U_USB2_ESD` | TI `TPD2EUSB30DRTR` | Separate low-capacitance shunt protection from connector-side D+ and D- to ground. USB2 data continues through this shunt-protected pair to the ESP32-S3 service path; it does not pass through `TPD4S201TRGRRQ1`. |
| `D_USB_PD_VBUS_TVS`, `D_USB_PD_VBUS_DISCONNECT` | TI `TVS2200DRVR`, Diodes Inc. `B340A-13-F` | Connector-side TVS and the TPS25730A-recommended VBUS-to-ground disconnect-surge Schottky, with B340A anode at ground and cathode at VBUS. TVS2200's 28.35 V worst-case 35 A, 125 C clamp exceeds the controller's 28 V absolute maximum before layout inductance. It is not credited as chip-pin surge protection; that waveform and layout limit remain a mandatory release gate. |
| `U_USB_PD` | TI `TPS25730ADREFR` | Standalone PD3.2 sink-only UFP controller with internal 20 V, 5 A PPHV path, dead-battery Rd, and 3.3 V LDO. No external PD-policy firmware or external sink FET is used. The model includes LDO_3V3, LDO_1V5, VIN_3V3, raw-VBUS, PPHV, and 330 pF capacitors on its protected CC1/CC2 pins; it has no `C_CC` pins. |
| `U_EFUSE` | TI `TPS259474ARPWR` | Exact active-production 10-pin RPW VQFN-HR circuit-breaker auto-retry variant. Its integrated back-to-back FETs provide reverse-current blocking and replace TPS26631. The model connects all real pins: EN/UVLO, OVLO, PG, PGTH, IN, OUT, DVDT, GND, ILM, and ITIMER. The configured values are 16 V UVLO, 22 V OVLO, 2.69 A nominal current limit. With the explicit 1 percent 1.24 kOhm ILM resistor and the TI plus or minus 10 percent current-limit tolerance, its worst high limit is 3,334 / (1,240 x 0.99) x 1.10 = 2.99 A, below the 3 A contract. It has 2 ms transient blanking, a 20 to 22 ms nominal output ramp, and PG at 17.99 V nominal. The 1 percent 698 kOhm/49.9 kOhm PGTH divider draws 26.7 uA at 20 V, more than 20 times the 1 uA leakage criterion; its resistor-only threshold range is 17.65 to 18.32 V. The A suffix has approximately 110 ms automatic retry; current, timer, ramp, and PG tolerances remain release measurements. |
| `S_POWER_SOURCE_SELECTOR`, `U_V5_BUCK` | C&K/Littelfuse `7101SYZQE`, TI `TPS56A37RPAR` | On the one board, the selector common feeds `V20_TO_V5_BUCK`; one throw receives `PD_EFUSE_OUT_20V`, and the other receives the bench-only `LAB_POST_EFUSE_20V`. Change selection only while both sources are off. No USB VBUS connection bypasses PD/PPHV and the upstream eFuse. See `bench-prototype-power.md` for the active contract and `v5-power-stage.md` for the generic versus selected-load arithmetic. |
| `TP_USB_VBUS_PORT`, `TP_USB_PD_PPHV`, `TP_USB_PD_CAP_MIS` | On-board fixture pads | Measure raw VBUS, post-contract PPHV, and active-low capability mismatch. These are not user-accessible power outputs. |

### Safe boot and failed-contract behavior

USB-C necessarily presents 5 V before a PD contract. `TPS25730ADREFR` is strapped to 20 V minimum and 20 V maximum; its documented `EnableSinkAfterContract` behavior combined with automatic disable on capability mismatch keeps PPHV off when the source cannot meet the 20 V, 3 A requirement. The controller's VBUS-powered dead-battery LDO runs the CC controller and `TPD4S201` before V3_3 exists; once V3_3 is present it powers `VIN_3V3` without backfeeding VBUS. Therefore the eFuse and TPS56A37 never receive the initial 5 V contract, a non-PD source, or an inadequate PD source.

The 3 A configuration is intentionally explicit. Although the PPHV switch supports 5 A, a 5 A contract cannot be enabled by a component substitution or firmware setting without a released rail/load spreadsheet, input-current and connector-temperature analysis, cable labeling decision, and PD interoperability test report.

### Hardware strapping and support network

The resistor divider settings are concrete model values, all from LDO_3V3 to
the ADC input to ground: ADCIN1 uses 24.9 kOhm / 10.0 kOhm for decoded value 4
(minimum 20 V); ADCIN2 uses 10.0 kOhm / 68.1 kOhm for decoded value 6 (maximum
20 V); ADCIN3 uses 162 kOhm / 38.0 kOhm for decoded value 3 (3 A operating);
and ADCIN4 uses 191 kOhm / 9.50 kOhm for decoded value 1 (3 A maximum).
`PD5VMAX` has a 10 kOhm pull-down, selecting capability-mismatch auto-disable.
Each resistor pair and decoded result remains an ERC and tolerance review item,
not an invitation to substitute an arbitrary resistor network.

`C_USB_PD_LDO` is active Vishay `T55A106M010C0200`, a 10 uF, 10 V,
plus or minus 20 percent tantalum-polymer 1206 capacitor. Its 8 uF tolerance
minimum exceeds the controller's 5 uF LDO_3V3 minimum; it has no MLCC DC-bias
derating. LDO_1V5 is active Murata `GRM21BR71A106KA73K`, 10 uF, 10 V, X7R,
plus or minus 10 percent; its tolerance minimum is 9 uF, exceeding 4.5 uF.
PPHV is active KEMET `T523H107M035APE070`, a 100 uF, 35 V tantalum-polymer
capacitor with plus or minus 20 percent tolerance; its 80 uF minimum is inside
the 47 uF to 100 uF required range and it has no MLCC DC-bias loss. The retained
model also includes 10 uF VIN_3V3, 4.7 uF 50 V raw-VBUS, and 330 pF
protected CC capacitors. Final effective capacitance,
DC-bias derating, placement, and return inductance require the current TI
datasheet and layout review.

## Power-budget and qualification gates

No current repository evidence gives display, audio, network, radio, scoring, and converter worst-case current at the same time. Before release, the power owner must provide a signed spreadsheet covering minimum 20 V input, converter efficiency, eFuse/PD-path loss, 50 C ambient, blocked vents, component tolerance, and transient load. It must show continuous input demand at or below 60 W with margin. If it does not, first review a 20 V, 5 A contract and e-marked cable requirement; review 28 V EPR only after that SPR option is shown insufficient.

Required EVT/DVT evidence:

- Verify attach, orientation, initial 5 V isolation, 20 V/3 A negotiation, insufficient-adapter rejection, detach, hard reset, PD error recovery, reverse current, and brownout using a PD protocol analyzer and at least three qualified 60 W adapters and ordinary 3 A cables.
- Scope raw VBUS, PPHV, eFuse output, V5, CC, D+/D-, and ESD return during plug/unplug, 20 V PD transitions, ESD, EFT, and injected faults. Confirm that PPHV/eFuse remain off before a valid 20 V/3 A contract.
- Qualify the exact Amphenol land pattern, 0.80 mm board requirement, shell stakes, 3D model, enclosure strain relief, connector temperature rise, cable pull, 20,000-cycle module evidence, conducted/radiated EMC, and IEC 61000-4-2/4-4 behavior.
- Complete independent schematic/ERC, controlled-impedance USB2 routing, PD copper/via/thermal layout review, TPS25730A strap and capacitor review against the current TI datasheet, and full system thermal validation.
- Inject the specified surge current at the controller pin and prove that TVS, Schottky, placement, and return inductance keep every TPS25730A pin inside its absolute maximum ratings. The TVS part alone is not a pass.

## Manufacturer evidence

- [TPS25730A product page](https://www.ti.com/product/TPS25730A) and [datasheet](https://www.ti.com/lit/ds/symlink/tps25730a.pdf): active orderable `TPS25730ADREFR`, PD3.2 sink-only UFP, internal 20 V/5 A path, dead-battery support, and strappable auto-disable behavior.
- [TPD4S201-Q1 product page](https://www.ti.com/product/TPD4S201-Q1) and [datasheet](https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf): four series-protected CC1, CC2, SBU1, and SBU2 channels with 28 V short-to-VBUS tolerance and IEC ESD protection.
- [TPD2EUSB30 product page](https://www.ti.com/product/TPD2EUSB30) and [datasheet](https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf): separate low-capacitance D+/D- shunt ESD protection.
- [TVS2200 product page](https://www.ti.com/product/TVS2200) and [datasheet](https://www.ti.com/lit/ds/symlink/tvs2200.pdf): 22 V standoff and 20 V USB-PD VBUS application.
- [ESP32-S3 hardware design guidelines](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32s3/esp-hardware-design-guidelines-en-master-esp32s3.pdf): GPIO19 D-, GPIO20 D+, and 22/33 Ohm USB series-resistor guidance.

This closes the intended PD role and preliminary protection topology only. It does not close power budget, thermal, connector CAD, layout, EMC, PD interoperability, certification, or fabrication gates.
