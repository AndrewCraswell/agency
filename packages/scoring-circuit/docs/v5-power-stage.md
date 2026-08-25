# V5 power-stage selection and closure gate

**Decision date:** 2026-08-23
**Status:** selected components; **DENY** for fabrication and for the generic
9.01 A, 100 ms envelope. The narrower selected bench load passes only the
eFuse arithmetic screen described below.

This page covers the non-isolated 20 V USB-PD to V5 stage only. It does not select a HUB75 panel, establish an enclosure thermal path, or alter the provisional USB-PD SPR 20 V, 3 A, 60 W contract.

## Decision

`TPS55288RPMR` is rejected for this V5 rail. Its programmable output-current limit reaches only 6.35 A, whereas the executable rail allocation requires 7.99 A continuous and 9.01 A during its stated 100 ms peak. A part that can enter current limiting below the declared continuous output cannot be a V5 rail selection.

The selected replacement is TI `TPS56A37RPAR`, a fixed-frequency 500 kHz synchronous buck with integrated 19.4 mOhm high-side and 8.5 mOhm low-side MOSFETs. It is specified for 4.5 V to 28 V input and 10 A continuous output. No external power MOSFETs are used. The topology follows the component values of TI's 5 V, 10 A EVM application. P0 omits permanent rail telemetry and uses removable current links with external instruments during bring-up. This is a selected design direction, not a transferable production layout.

| Function | Exact selection | Connection and boundary |
| --- | --- | --- |
| V5 regulator | TI `TPS56A37RPAR` | eFuse output to VIN. EN divider keeps the rail off during the eFuse ramp. Integrated FETs mean there are no external buck FETs to select. |
| Inductor | Würth Elektronik `744325330` | 3.3 uH shielded Superflux, 5.9 mOhm DCR. TI's worked example cites 2.4 uH typical at 12 A, 15 A typical saturation current, and 9.7 A heating current. The executable screen uses 2.4 uH, but combined initial tolerance, DC-bias, temperature, aging, and lot variation remain an unclosed measurement/qualification gate. Neither typical figure is treated as a guaranteed production limit. |
| Input MLCC bank | 2 x Murata `GRM32ER7YA106KA12L` | 10 uF, 35 V, X7R, 1210, directly between VIN and PGND, plus Würth `885012206095` 100 nF, 50 V, X7R at the IC. Effective capacitance at 20 V and temperature remains a measurement gate. |
| Bootstrap | Würth `885012206095` | 100 nF, 50 V, X7R from BOOT to SW. |
| Output MLCC bank | 2 x Murata `GRM32ER71E226KE15L` | 22 uF, 25 V, X7R, 1210, directly on V5. The EVM identifies 35 uF effective total at 5 V; release must prove at least that effective value over tolerance and temperature. |
| Setpoint and transient network | 73.2 kOhm / 10.0 kOhm / 49.9 Ohm and Murata `GRM1885C1H151JA01D` 150 pF C0G | 5 V divider and EVM feed-forward network. D-CAP3 has internal compensation; this is not an unverified external Type-II/III compensation loop. |
| Startup / mode | 88.7 kOhm / 6.04 kOhm EN divider, 52.3 kOhm MODE, TDK `C1608X7R1H473K080AA` 47 nF SS | Nominal EN start/stop are 18.42 V / 16.43 V using the data-sheet current-source equations. SS is approximately 4.7 ms nominal, not an approval for an attached panel's inrush. |

## Arithmetic screen

`src/v5-power-stage.ts` is the executable screen; its tests use the unchanged rail budget and fail closed on malformed inputs.

| Check | Result | Interpretation |
| --- | ---: | --- |
| V5 continuous / short output | 7.99 A / 9.01 A | Both are below the regulator's 10 A continuous rating, leaving 2.01 A / 0.99 A nominal headroom. |
| 20 V nominal and 22 V eFuse-OVP screen | 6 V below 28 V recommended, 10 V below 32 V absolute maximum | This only checks nominal operating/OVP values. No PD, eFuse, cable, ESD, EFT, or layout transient margin is proven until a probe at TPS56A37 VIN shows every event stays within 28 V recommended and 32 V absolute maximum. |
| Minimum on-time at 28 V recommended maximum | 357 ns, versus 50 ns minimum | The 5 V target retains 307 ns arithmetic margin at the recommended maximum input. This does not make a 32 V absolute-maximum excursion acceptable. |
| Inductor loaded-value screen | 3.42 A peak-to-peak at 28 V, 500 kHz, 2.4 uH | The 2.4 uH value is the published typical inductance at 12 A, not a defensible worst corner. The 9.01 A short peak produces 10.72 A peak and 9.06 A RMS. These arithmetic values remain below the controller's 12.75 A minimum high-side peak-current limit and the inductor's published 15 A typical saturation and 9.7 A heating figures. Release still requires a guaranteed combined inductance bound and thermal/current validation. |
| Input-MLCC ripple at 17.65 V minimum input | 4.06 A RMS bank current, 2.03 A RMS per selected 1210 | **DENY gate.** The selected MLCC's ripple/temperature/DC-bias qualification is not evidenced. This calculation is a required per-part screen, not a capacitor-rating claim. |
| Current-limit protection | low-side valley minimum 10 A, high-side peak minimum 12.75 A | These are fault limits, not a promised 10 A regulation/load-step guarantee. Validate overload, short, restart, and panel startup on the assembled board. |
| D-CAP3 compensation | 3.3 uH with 35 uF effective V5 capacitance and 150 pF feed-forward network | This is the exact 5 V EVM combination. It becomes invalid if capacitance, cable, panel capacitance, or layout parasitics change without a loop/transient review. |

## Generic allocation versus selected bench load

The 7.99 A continuous and 9.01 A, 100 ms figures above are the unchanged
generic rail allocation. That maximum remains **DENY** because its 9.01 A
peak exceeds the upstream eFuse worst-low envelope and because MLCC, inrush,
thermal, and layout evidence is still open.

BP-050 instead freezes the selected Adafruit 2277 bench-panel configuration at
5.392 A continuous and 6.093 A for 100 ms on V5, or 26.96 W and
30.465 W. Including the selected-system conversion and path-loss screen
requires 1.636 A continuous and 1.842 A peak at 20 V. Both are below
the upstream eFuse's 2.395 A worst-low current limit, and both loads
are below its 40.73 W ceiling. The selected bench envelope therefore passes
this eFuse arithmetic screen.

That selected-load pass neither erases the generic 7.99 A/9.01 A DENY nor
approves the panel, converter layout, effective capacitance, inrush, or
thermal behavior. BP-050 keeps the panel disconnected until those assembled
measurements pass and adds a separate display-branch limiter.

## Source coordination blocks the short peak

The selected buck clears its own 10 A arithmetic screen, but the upstream eFuse does not clear the present peak claim. The current `TPS259474A` 1.24 kOhm, 1 percent ILM selection has a nominal 2.69 A limit and a worst-low value of:

`3,334 / (1,240 x 1.01) x 0.90 = 2.40 A`.

At the rail budget's 85 percent buck-efficiency floor, the continuous 39.95 W V5 load requires 2.35 A at 20 V. The 45.05 W, 100 ms V5 peak requires 2.65 A, exceeding the 2.40 A worst-low limit by about 0.25 A. This is long relative to the eFuse's 2 ms blanking interval, so it cannot be described as protected peak operation.

The exact eFuse limit is **40.73 W**, or **8.15 A**, available to V5 loads. After the current peak fixed loads of 10.26 W, no more than **30.47 W** remains for display during a guaranteed peak. The existing 34.79 W display peak allocation is therefore denied.

Do not silently change the USB-PD contract to resolve this. Bounded resolution options, none selected here, are:

1. Reduce the panel/display short peak so total V5 load does not exceed 40.73 W under this pessimistic screen.
2. Revise the source-contract and cable requirement only after a new load, cable, connector, PD, safety, and thermal review.
3. Re-architect upstream protection with a device and tolerance analysis that both guarantees the required minimum current and keeps every plausible high limit inside the negotiated 3 A contract.

## Thermal, inrush, layout, and SOA gates

The rail-budget 85 percent value is an allocation, not measured TPS56A37 efficiency. It allows 7.05 W continuous and 7.95 W during the short screen across the complete buck stage. It does not say how much is in the IC, inductor, capacitors, copper, or connector. The TPS56A37 4-layer EVM effective junction-to-ambient figure is 30 C/W. At 50 C ambient, attributing even the full continuous allowance to the IC would imply a 211 C rise, which is not a valid thermal model. Fabrication release needs an actual loss split, copper/thermal-via layout, and measurements rather than a thermal calculation based only on the power envelope.

Required evidence before lifting DENY:

- PCB PI layout review against the TPS56A37 EVM/layout guidance: VIN capacitor loop and PGND, SW copper keepout, BOOT loop, AGND/PGND single point, direct output feedback sense, and output return to the HUB75 connector. The circuit-model coordinates are nonphysical placeholders, not a placement or clearance proof; the former `L_V5_BUCK` / `L_APP_REGULATOR` coordinate collision is prevented by a circuit assertion only.
- Scope VIN at the regulator, SW, V5 at the capacitors and panel end, EN, PG, eFuse output, and external-link V5 current for attach, detach, PD hard reset, eFuse retry, 0 A to maximum load steps, Ethernet traffic, and full-white panel content.
- Measure actual MLCC effective capacitance, V5 ripple, stability/loop response, 5 V accuracy at the panel end, current-limit/hiccup behavior, and start-up with every candidate HUB75 panel attached. The panel must remain blank until V5 and logic are known good.
- Perform thermal-camera and thermocouple tests at 50 C ambient with blocked vents. Record IC junction proxy/case, inductor, input/output MLCCs, eFuse, USB-C connector, copper, and panel-end cable temperatures at continuous load and the repeated transient profile.
- Verify 20 V adapter/cable variation and the eFuse OVP response never expose TPS56A37 VIN to more than its recommended or absolute ratings. Validate EFT/ESD/surge return paths at the actual component pins.

## Primary references

- [TPS56A37 product page and data sheet](https://www.ti.com/product/TPS56A37/part-details/TPS56A37RPAR): 4.5 V to 28 V operation, 10 A continuous rating, integrated MOSFETs, current limits, timing, D-CAP3 behavior, and thermal metrics.
- [TPS56A37EVM user guide](https://www.ti.com/lit/ug/slvuct3/slvuct3.pdf): 5 V, 10 A reference circuit, exact BOM, effective output capacitance, measured 10 A ripple, and layout basis.
- [Würth 744325330 product family](https://www.we-online.com/en/components/products/WE-HCI) must be checked against the current datasheet and distributor lifecycle record before purchasing; the EVM BOM is the present source for its MPN and values.

This selection replaces an inadequate converter candidate but does not close output transient, eFuse coordination, panel startup, layout, thermal, EMI, or fabrication gates.
