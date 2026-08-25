# BP-103 seven-channel analog architecture acceptance

Status: architecture accepted only. Schematic integration, fabrication, and scoring readiness remain denied.

BP-103 takes the root-approved uncommitted BP-100, BP-101, and BP-102 selections as fixed inputs. Its executable
contract snapshots those inputs and the current BP-120 allocation, then fails validation if any selected MPN, topology,
or pin allocation drifts. This is not acceptance of a schematic, a board, a measurement, or a score-producing system.
All untrusted contract inputs are inspected through own property descriptors. Accessors, non-enumerable or symbol
properties, sparse or subclassed arrays, aliases, and cycles are rejected without invoking an accessor.

## Seven explicit cells

The physical chain order is `LEFT_WEAPON_A`, `LEFT_WEAPON_B`, `LEFT_WEAPON_C`, `RIGHT_WEAPON_A`,
`RIGHT_WEAPON_B`, `RIGHT_WEAPON_C`, and `PISTE`. Each cell has a unique designator suffix from `_1` through `_7`.
No repeated schematic block may hide a conductor swap.

Each cell replicates these exact BP-100 through BP-102 identities: `TPD4E05U06DQAR`, `CRCW060322R0FKEAHP`,
`TMUX1112PWR`, `ERA3AEB2491V`, `ADA4177-1BRZ`, `CRCW060320R0FKEAHP`, `C0603C102J5GACTU`,
`ADS8881IDGS`, `REF5025AQDRQ1`, `GRM188R71A105KA12D`, `T521B106M025ATE100`,
`C0603C104K3RACTU`, `RCWE0603R220FKEA`, `GRM21BR71A106KE51L`, and `CRCW120656K0FKEAHP`.
`CRCW0603100KFKEAHP` is the reviewed one-channel `R_SOURCE_PD` safe-state support part. It is included as an exact
per-cell MPN and is also drift-checked against that source BOM.

For every named conductor, the contract records all of the following exact paths:

- Normal acquisition: conductor through the TPD shunt, 22-ohm resistor, TMUX quiet path, ADA4177-1 unity buffer,
  20-ohm and 1-nF SAR filter, and ADS8881 `AINP`, with `AINN` on `SCORING_SGND`.
- Normal excitation: that cell's REF5025 output through its own 2.49-kohm `R_SOURCE`, then that cell's TMUX source
  path to the named conductor. The assigned source-enable net drives TMUX `SOURCE_EN`; its own 100-kohm
  `R_SOURCE_PD` pulls that control to `SCORING_SGND`.
- Guarded force: an externally interlocked normally-open relay through that cell's 56-kohm `R_FAULT_GUARD` to the
  named conductor. It is never enabled with the normal source.
- Sink enable: each BP-120 sink net and LQFP64 pad is named. BP-100 through BP-102 do not select an electrical
  sink-switch topology, so this remains explicitly integration-unresolved and denied until it is drawn and proven.

## Replicated and shared resources

The reviewed decision is to replicate every electrically independent analog cell resource seven times. This includes
the protection chain, source resistor and enable pull-down, buffer, SAR filter and ADC, guarded-force resistor, and
the complete REF5025 network. In particular, there is one REF5025 and one ADS8881-local 0.22-ohm and 10-uF reservoir
per cell. A shared reference regulator or shared ADC-local reservoir is not selected.

Only `V5_ANALOG`, `V5_NEG`, `APP_3V3`, `SCORING_SGND`, shared `CONVST`, shared `SCLK`, and the serialized
data route are shared. Their physical return paths, rail power, crosstalk, and timing receive no credit until the
machine-readable gates below have physical evidence.

## ADC chain and STM32 bindings

`U_SAR_1.DIN` is grounded. `U_SAR_1.DOUT` through `U_SAR_6.DOUT` feed the next device's `DIN` over six individually
named nets. `U_SAR_7.DOUT` reaches STM32 `PA6`, LQFP64 pin 20, `SPI1_MISO`.

All converters share STM32 `PA4`, pin 18, `TIM3_CH2` for `CONVST` and STM32 `PA5`, pin 19, `SPI1_SCK` for `SCLK`.
The contract binds every one of the fourteen source and sink enables directly to the current BP-120 LQFP64 allocation:
`PC0/8`, `PC1/9`, `PC2/10`, `PC3/11`, `PB0/24`, `PB1/25`, `PB2/26`, `PB10/30`, `PB11/33`, `PB12/34`, `PB13/35`,
`PB14/36`, `PB15/37`, and `PC6/38`.

The host receives seven 18-bit MSB-first words in reverse physical-chain order: `PISTE`, `RIGHT_WEAPON_C`,
`RIGHT_WEAPON_B`, `RIGHT_WEAPON_A`, `LEFT_WEAPON_C`, `LEFT_WEAPON_B`, then `LEFT_WEAPON_A`. The executable tests
assert every daisy endpoint and every word's source, index, and exact bit range. At 20 MHz, 126 clock edges take
6.3 microseconds; adding the ADS8881 710-ns maximum conversion time gives a 7.01-microsecond arithmetic screen.
This does not establish signal integrity, firmware timing, parser correctness on hardware, or scoring behavior.

Primary source: [TI ADS8881 datasheet SBAS547D Rev D](https://www.ti.com/lit/ds/symlink/ads8881.pdf), sections
10.4.2 and 10.4.2.1.

## Fail-closed integration gates

The executable contract exposes seven gate records. Each is currently `state: unavailable`,
`measurement: not-measured`, and `decision: DENY`:

- seven-channel common-ground analog power
- simultaneous-channel crosstalk
- daisy-chain signal integrity and timing
- parser and host word order
- all-conductor source and sink interlocks
- canonical schematic integration
- footprint and artwork review

Architecture acceptance closes only the BP-103 selection review. It does not close integration, fabrication, power
application, measurement, scoring, or release readiness.
