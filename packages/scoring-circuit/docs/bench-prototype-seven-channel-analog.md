# BP-103 seven-channel analog replication

Status: architecture selected, schematic integration and fabrication denied.

BP-103 explicitly replicates the reviewed protected ADS8881 cell across these seven conductors, in this physical chain
order:

1. `LEFT_WEAPON_A`
2. `LEFT_WEAPON_B`
3. `LEFT_WEAPON_C`
4. `RIGHT_WEAPON_A`
5. `RIGHT_WEAPON_B`
6. `RIGHT_WEAPON_C`
7. `PISTE`

Each channel has its own named TPD shunt, 22-ohm input resistor, TMUX1112, ADA4177-1 unity buffer, exact
`C0603C102J5GACTU` 1-nF SAR capacitor with the 20-ohm resistor, ADS8881, and guarded 56-kohm path. Each channel also
replicates the complete BP-101 reference network: REF5025 input bypass, regulator-local polymer and high-frequency
output capacitors, and the separate 0.22-ohm/10-uF ADC-local reservoir. The executable contract lists every reference,
net path, and STM32 source/sink enable pad; a repeated schematic block cannot hide a left/right or weapon/piste swap.

## ADC serialization

The seven `ADS8881IDGS` devices use TI's daisy-chain mode without a busy indicator. ADC 1 `DIN` is grounded, each
`DOUT` feeds the next ADC's `DIN`, and ADC 7 `DOUT` reaches STM32 `PA6/SPI1_MISO`. Every inter-ADC hop has a named
net. All devices share
`PA4/TIM3_CH2` `CONVST` and `PA5/SPI1_SCK`. The host therefore receives `PISTE` first and `LEFT_WEAPON_A` last.

At the selected 20-MHz clock, 126 falling edges shift seven 18-bit words in 6.3 microseconds. Adding the ADS8881
710-ns maximum conversion time gives a 7.01-microsecond arithmetic screen. SCLK is deliberately below 36 MHz so the
datasheet's slow-read edge allowance applies. This arithmetic is not signal-integrity, firmware, or scoring evidence.

Primary source: [TI ADS8881 datasheet SBAS547D Rev D](https://www.ti.com/lit/ds/symlink/ads8881.pdf), sections
10.4.2 and 10.4.2.1.

## Open gates

The following remain mandatory before the chain can enter the canonical schematic or authorize a board order:

- integrate and independently trace-review all seven named cells;
- close worst-case isolated-rail power for seven buffers, ADCs, references, switches, and support networks;
- review every local reference loop and prove simultaneous-channel crosstalk;
- verify the 126-bit chain, word order, timing margin, and parser on hardware;
- verify every source/sink interlock and guarded path;
- approve every footprint and generated artwork item.

Until all gates close, `schematicIntegrationAuthorized`, `fabricationAuthorized`, and `scoringReady` remain false and
the release state remains `deny`.
