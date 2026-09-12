# Handheld remote hardware selection

**State:** schematic-input contract only. It does not authorize procurement,
fabrication, firmware, pairing, or industrial design.

## Selected candidates

| Function | Candidate | Source basis |
| --- | --- | --- |
| Handheld MCU module | Raytac MDBT50Q-1MV2 | Certified nRF52840 revision 2 module with integrated chip antenna, matching network, and 32 MHz clock. Host uses the internal 32.768 kHz RC oscillator and LDO mode, so the external LF crystal/load capacitors and DC-DC L2/L3/C14 stay DNP. Murata 100 nF and 4.7 uF host bypass capacitors, exact reset pullup, and 22 ohm SWD series resistors complete the host support. |
| IR emitter | Vishay VSMY14940UL | 940 nm, side-view SMD emitter that Vishay lists for 38 kHz remote control. |
| Pulse switch | Nexperia PMV16XN | Low-side N-channel MOSFET with YAGEO RC0603FR-07100RL 100 ohm gate resistor, RC0603FR-07100KL 100 kohm pulldown, and RC1206FR-0727RL 27 ohm emitter current limit. |
| Keys | C&K KMR221G LFS | 2 N nominal tact switch with 200,000 published cycles. The 4 by 8 matrix has one Vishay 1N4148W-E3-08 diode per key, oriented from the row switch toward its column. |
| Cell and protection | Panasonic Energy NCR18650B | 3.6 V cell with 3250 mAh manufacturer-minimum capacity. TI BQ29700DSER, CSD85301Q2 back-to-back FETs, a 330 ohm input resistor, and 100 nF filter form the candidate protection path. Pack construction and validation remain DENY. |
| Remote USB-C sink | GCT USB4105-GF-A | Charging-only receptacle with one YAGEO RC0603FR-075K1L 5.1 kohm pulldown on each CC pin. TI TPD1E10B06 clamps VBUS ESD and two TPD4S012 signal channels clamp CC1/CC2. BQ24314DSGR is oriented IN from connector VBUS and OUT to the charger; a 50.0 kohm ILIM resistor sets a nominal 500 mA overcurrent threshold, a 100 kohm resistor senses PACK+, and exact 1 uF capacitors support IN and OUT. No PD controller or USB data path is fitted. |
| Charge temperature inhibit | TI TMP390A2DRLR | Hardware-only hot/cold window with a conservative 42 C hot trip and 15 C cold trip. Connector VBUS powers a TPS70933DBVR safety rail. The exact threshold, pullup, bypass, open-drain NAND, CE pullup, and 3.3 V CE clamp make a temperature fault, invalid threshold resistor, startup, or safety-rail loss disable charger VBUS. |
| Charge control | Microchip MCP73831T-2ACI/OT | Single-cell 4.20 V controller. YAGEO RC0603FR-074KL, exactly 4.000 kohm, sets a nominal 250 mA target. Murata GRM188R61C475KE11D 4.7 uF capacitors are fitted at VDD and VBAT. |
| 3.3 V rail | Texas Instruments TPS62743YFPR | 300 mA buck with Murata LQH2MCN2R2M52L 2.2 uH inductor and GRM188R61A106KE69D 10 uF input and output capacitors. |
| Debug cable | Tag-Connect TC2050-IDC-NL-050-ALL | No header is populated. The board imports manufacturer footprint TC2050-IDC-NL-FP revision A: ten 0.787 mm plus or minus 0.076 mm paste-free contact pads, three 0.991 mm plus or minus 0.076 mm non-plated alignment holes, 0.508 mm minimum signal clearance, and the published keepout. TC2050-CLIP-3PACK attaches from the PCB underside for temporary retention. |

The apparatus stays independent: its TSOP38438 receiver uses the ESP32-S3's
pulse-capture interface. The exact GPIO and supply are owned by each
[native board schematic](../../../packages/scoring-circuit/README.md), not the obsolete carrier allocation.
The handheld USB-C connector is a separate 5 V charging
sink and does not negotiate USB PD. Optical hardware never authenticates or
authorizes a scoring command.

The MCP73831 equation gives `1000 V / 4.000 kohm = 250 mA`. The independent
TMP390 window permits charging only between nominal 15 C and 42 C, a
conservative subset of the cell's published 10 C to 45 C range. Both sensor
outputs must be healthy before the SN74LVC1G38 open-drain NAND can pull
BQ24314 CE low. A 10 kohm plus 10 kohm connector-VBUS divider biases CE between
2.375 V and 2.625 V over the specified USB input range, while a BZT52-C3V3
clamps connector overvoltage. This holds CE high during startup, invalid
threshold resistance, temperature fault, or loss of the USB-powered TPS70933
safety rail. The cell therefore does not have
to power its own charging-safety interlock. Threshold accuracy, sensor-to-cell
thermal coupling, depleted-cell dissipation, copper area, thermal regulation,
and charge time still require physical measurement and remain DENY.

The module remains supplied by VREMOTE_3V3 and enters nRF52840 System OFF for
standby. Button-matrix inputs are the only normal wake sources. The Raytac RF
keepout must be copied unchanged, and reset, boot, and debug states must leave
the IR MOSFET gate pulled off.

## Calculated targets, not measurements

| Target | Bound | Basis |
| --- | --- | --- |
| Frontal range | at least 20 m | Required field target. No range measurement yet exists. |
| Battery use | at least 300 h | 3250 mAh manufacturer-minimum capacity times an 80% usable reserve gives 2600 mAh; 2600 mAh divided by 300 h gives an 8.667 mA maximum average-current budget. |
| End-to-end latency | 70 ms maximum | 20 ms gesture-to-emitter edge plus 50 ms emitter-edge-to-authenticated-event budget. |
| Reset and flood | 0 accepted commands | Transmit inhibit within 10 ms of reset and recovery within 1000 ms after quiet input. |
| Service access | 250 mA charge, 3.3 V debug | Headerless 10-pad TC2050-NL target pattern and six named probe points, with a 2.54 mm probe-clearance target. |

## Release gates

Physical evidence remains DENY until the actual hardware proves all of the
following:

- LED current waveform, optical power, thermal behavior, and eye-safety
  analysis.
- 20 m range, angle, venue-light, and false-accept results with encrypted
  frames.
- Battery duration, low-battery behavior, charge temperature, and aging
  reserve.
- Gesture-to-event latency, reset, flooding, and recovery behavior.
- Button ergonomics, labels, enclosure, optical window, service access, and
  released footprints.

## Primary sources

- [Nordic nRF52840 product specification](https://docs.nordicsemi.com/r/bundle/ps_nrf52840/page/keyfeatures_html5.html)
- [Raytac MDBT50Q-1MV2 module page](https://www.raytac.com/product/ins.php?index_id=24)
- [Raytac module specifications and design guides](https://www.raytac.com/document/)
- [Vishay VSMY14940UL product page](https://www.vishay.com/en/product/80542/)
- [Nexperia PMV16XN product page](https://www.nexperia.com/product/PMV16XN)
- [Vishay 1N4148W data sheet](https://www.vishay.com/docs/86356/1n4148w.pdf)
- [YAGEO RC-series resistor data](https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100RL)
- [C&K KMR series short-form catalog](https://www.ckswitches.com/media/2233/shortform_nov2017-sc.pdf)
- [Panasonic Energy NCR18650B data sheet](https://na.industrial.panasonic.com/sites/default/pidsa/files/ncr18650b.pdf)
- [Texas Instruments BQ2970 product page](https://www.ti.com/product/BQ2970)
- [Texas Instruments CSD85301Q2 product page](https://www.ti.com/product/CSD85301Q2)
- [GCT USB4105 product page](https://gct.co/connector/usb4105)
- [Texas Instruments BQ24314 product page](https://www.ti.com/product/BQ24314)
- [Texas Instruments TPD1E10B06 product page](https://www.ti.com/product/TPD1E10B06)
- [Texas Instruments TPD4S012 product page](https://www.ti.com/product/TPD4S012)
- [Texas Instruments TMP390 data sheet](https://www.ti.com/lit/gpn/TMP390)
- [Texas Instruments TPS709 product page](https://www.ti.com/product/TPS709)
- [Texas Instruments SN74LVC1G38 product page](https://www.ti.com/product/SN74LVC1G38)
- [Nexperia BZT52-C3V3 product page](https://www.nexperia.com/product/BZT52-C3V3)
- [YAGEO RC-series resistor data](https://yageogroup.com/component-documentation/download/specsheet/RC0603FR-0750KL)
- [Microchip MCP73831 family data sheet](https://ww1.microchip.com/downloads/en/DeviceDoc/MCP73831-Family-Data-Sheet-DS20001984H.pdf)
- [Texas Instruments TPS62743 product page](https://www.ti.com/product/TPS62743)
- [Murata product search](https://www.murata.com/en-global/products?mode=search)
- [Tag-Connect TC2050-IDC-NL-050-ALL product page](https://www.tag-connect.com/product/tc2050-idc-nl-050-all)
- [Tag-Connect TC2050-IDC-NL footprint drawing](https://www.tag-connect.com/wp-content/uploads/bsk-pdf-manager/TC2050-IDC-NL_Datasheet_8.pdf)
- [Vishay TSOP382 and TSOP384 receiver data sheet](https://www.vishay.com/docs/82491/tsop382.pdf)
