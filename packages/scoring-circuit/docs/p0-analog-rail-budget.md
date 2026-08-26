# P0 analog rail budget

The phased topology uses one ADC and reference rather than seven. `V5_ANALOG` supplies one REF5025, five ADA4177 sense
buffers, and the shared TPS60400 negative-rail generator. `APP_3V3` supplies one ADS8881, three TMUX1208 multiplexers,
and two SN74HCS595 phase registers. `VNEG_ANALOG` supplies the five protected sense buffers.

This removes six ADCs, six references, two sense buffers, six ADC reference reservoirs, twelve ADC bypass capacitors,
and the former seven-cell serial chain. The source-load worst case is also one selected phase at a time, not seven
simultaneous sources.

The rail arithmetic remains a paper screen until the final schematic, exact capacitor effective values, source/sink
phase schedule, and assembled measurements are available. P0-06 owns the reconciled BOM; P0-12 owns cold/hot startup,
ripple, load-step, negative-rail, reference-recovery, and fault captures.

The executable budget is [`p0-analog-rail-budget.ts`](../src/p0-analog-rail-budget.ts).
