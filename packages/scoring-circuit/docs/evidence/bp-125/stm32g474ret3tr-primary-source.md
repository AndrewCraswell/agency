# BP-125 STM32 primary-source record

This record binds the retained manufacturer bytes used by the BP-125 STM32
processor-support contract. It does not approve a schematic, footprint, layout,
clock selection, assembly, or fabrication.

## Retained source

- Manufacturer: STMicroelectronics
- Document: DS12288 Rev 6, `STM32G474xB STM32G474xC STM32G474xE`
- Document date: November 2021
- Official source URL: <https://www.st.com/resource/en/datasheet/stm32g474re.pdf>
- Retained bytes: `st-stm32g474re-ds12288-rev6-datasheet.pdf`
- Retained byte count: 3,062,163
- SHA-256: `B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD`
- Retrieval date: 2026-08-24

The retained file is a 236-page PDF. Its printed cover identifies November
2021 and DS12288 Rev 6. The digest above is the only accepted byte identity;
older revisions and extracted web text are not evidence for this contract.

## Checklist mapping

| BP-125 item | DS12288 Rev 6 evidence | Contract boundary |
| --- | --- | --- |
| Processor and package | Cover p. 1; Table 1 pp. 2-3; Section 4.3 and Figure 7 p. 50; Section 6.4 pp. 210-212; Table 124 p. 232 | `STM32G474RE` is in the xE family. Table 124 decodes `R` as 64 pins, `E` as 512 Kbytes, `T` as LQFP, `3` as -40 to 125 C, and `TR` as tape and reel. This supports `STM32G474RET3TR` and LQFP64 identity only. |
| Supply range and rails | Section 3.11.1 p. 23; Section 5.1.6 and Figure 16 p. 81 | VDD is 1.71 V to 3.6 V; VDDA is 1.62 V to 3.6 V; VBAT is 1.55 V to 3.6 V. Figure 16 shows n x 100 nF plus 4.7 uF on VDD, 10 nF plus 1 uF on VDDA, and 100 nF plus 1 uF on VREF+. The caution requires ceramic filtering capacitors at or below the appropriate pins. |
| Clock pins and clock limits | Section 3.13 p. 29; Section 4.3 and Figure 7 p. 50; Section 5.3.7 pp. 115-117 | HSE uses PF0-OSC_IN/PF1-OSC_OUT and supports 4 to 48 MHz crystal or ceramic resonator operation. LSE uses PC14-OSC32_IN/PC15-OSC32_OUT and supports a 32.768 kHz external oscillator. The BP-125 DNP decision remains a product contract decision, not a datasheet claim. |
| Boot and reset | Section 3.7 p. 21; Section 3.11.5 p. 25; Section 4.3 and Figure 7 p. 50 | BOOT0 may come from PB8-BOOT0 or the nBOOT0 option bit. Under and after reset, I/Os are in analog state and the Schmitt trigger is disabled. The BP-125 PB8 pulldown value and reset ownership remain contract decisions. |
| Unused-pin firmware rule | Section 3.14 p. 30; Section 5.3.5, I/O system current-consumption guidance, p. 108; Section 4.3 and Figure 7 p. 50 | The pinout identifies the candidate pads. ST warns that floating inputs can settle at an intermediate level or switch from noise, and requires unused floating inputs to be configured as analog or forced to a definite digital value. The exact BP-125 unused-pad list is not present in DS12288 and remains an explicit contract checklist, not a manufacturer sign-off. |

This record closes the STM32 manufacturer-byte retrieval gate. It does not close
the HSE/LSE decision, schematic review, PCB review, electrical measurement, or
fabrication release gates.
