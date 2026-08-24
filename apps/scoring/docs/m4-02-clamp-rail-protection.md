# M4-02 candidate clamp and rail protection

**Status:** paper-screen candidate only. It does not authorize procurement,
an energized test, schematic integration, fabrication, compliance, survival,
or scoring authority.

The executable calculation is
[`../src/m4-02-clamp-rail-protection.ts`](../src/m4-02-clamp-rail-protection.ts).
It binds the committed BP-100, BP-101, BP-102, and M0-04 source files by
commit and SHA-256, rather than importing the circuit package into application
runtime.

## Candidate and boundary

M4-02 retains the BP-102 candidate exactly: the fixture `LINE` shunts first to
the `TPD4E05U06DQAR` return at `SCORING_SGND`; the normal acquisition branch
then passes through the 22-ohm `CRCW060322R0FKEAHP`, `TMUX1112PWR`,
`ADA4177-1BRZ`, and the existing 20-ohm/1-nF ADS8881 input network. The TPD
ground pins return directly to `SCORING_SGND`; the reserved third fixture pin
stays electrically unconnected.

The candidate deliberately adds no path from `LINE` to an STM32 pin. The ADC
is the acquisition endpoint, and any later STM32-facing digital interface must
be measured separately. The STM32G474 data sheet permits no positive injected
current on FT_xxx, TT_xx, or NRST pins, limits negative injection to 5 mA per
pin, and limits the total absolute injected current to 25 mA. Therefore the
candidate’s calculated direct connector-to-MCU injection is 0 A only because
that path is absent from this paper boundary. It is not a claim about an
assembled board, back-powering through ADS8881, or a later schematic.

Normal apparatus power remains USB-C PD. `LAB_POST_EFUSE_20V` remains the
existing laboratory-only alternate input selected only while de-energized.
M4-02 creates no VBUS, CC, or PD-rail connection and does not change the
source-selection rule.

## Calculated screens

| Concern | Source-backed input | Bounded calculation | Explicit non-credit |
| --- | --- | --- | --- |
| Leakage | TPD4E05U06 maximum 10 nA leakage, used conservatively at the 2.5 V normal source | At 450 ohm, the 381.12-ohm Thevenin resistance makes a 3.811 uV error, equivalent to 0.005292 ohm | Leakage direction, temperature, contamination, fixture, and post-pulse leakage require measurement. |
| Capacitance | TPD4E05U06 typical 0.5 pF | At 10 nF line capacitance it is 0.005% and adds 0.953 ns to five time constants at 450 ohm | The data-sheet value is typical, not a released maximum. No timing acceptance credit is given. |
| Charge injection | TMUX1112 typical 1.5 pC, already frozen by BP-100 | It produces 3 mV and 4.166 ohm equivalent error at 500 pF, then 0.15 mV and 0.208 ohm at 10 nF | Polarity, temperature, channel memory, layout, and switching waveform are unbounded. |
| Guarded energy | 24 V through the 55.44-kohm minimum guarded resistor for 100 ms | 0.4329 mA, 10.39 mW, and 1.039 mJ at the source | This is source-envelope arithmetic, not clamp, rail, ADC, or survival credit. |
| Surge return | TPD clamp path is connector `LINE` to direct `SCORING_SGND`; TI publishes 10 V at 1 A and 2.5 A for the 8/20-us rating | The return path is named without extrapolating a 2.5-A clamp voltage | Layout inductance, current sharing, thermal rise, system ESD/EFT/surge behavior, and unpowered behavior remain unproven. |

## Required adversarial evidence

Before this candidate can advance, a separately reviewed, interlocked fixture
must capture powered and unpowered cold, ambient, and hot cases at `LINE`,
post-TPD, buffer input/output, ADS8881 AINP, both isolated rails, ADS8881
DVDD, and every STM32-facing digital line. The BP-102 permit, current-trip,
mutual-exclusion, stop-condition, and ten-second inter-pulse gates remain
mandatory. Record clamp-return and rail current, reset state, post-pulse
leakage, startup, reference recovery, ADC validity, and all MCU-facing pins.

No IEC 61000-4-2, IEC 61000-4-4, or IEC 61000-4-5 test is authorized here.
Those tests need an independent safety review, controlled setup, and measured
evidence. The validator and adversarial tests reject altered candidate data,
invented maximum-capacitance credit, non-finite inputs, and any fabrication or
energized-test authority escalation.

## Primary manufacturer sources

- [Texas Instruments TPD4E05U06 data sheet](https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf)
- [Texas Instruments TMUX1112 data sheet](https://www.ti.com/lit/ds/symlink/tmux1112.pdf)
- [Vishay CRCW e3 resistor data sheet](https://www.vishay.com/docs/20035/dcrcwe3.pdf)
- [Analog Devices ADA4177-1 data sheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ada4177-1_4177-2_4177-4.pdf)
- [Texas Instruments ADS8881 data sheet](https://www.ti.com/lit/ds/symlink/ads8881.pdf)
- [STMicroelectronics STM32G474RC data sheet](https://www.st.com/resource/en/datasheet/stm32g474rc.pdf)
