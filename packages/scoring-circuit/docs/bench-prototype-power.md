# Prototype USB-C PD power contract

## Normal input

The prototype's normal power input is USB-C Power Delivery SPR at **20 V,
3 A, 60 W**. It is a sink-only apparatus with no battery, charging function,
source role, dual-role behavior, 5 A contract, or EPR contract.

The required path is:

`10177070-00011LF` USB-C receptacle → `TPD4S201TRGRRQ1` CC1/CC2 and SBU1/SBU2
series overvoltage/ESD protection, with a separate `TPD2EUSB30DRTR` shunt on
D-/D+, plus `TVS2200DRVR` VBUS TVS and `B340A-13-F` disconnect-surge diode →
`TPS25730ADREFR` sink controller and internal PPHV path →
`TPS259474ARPWR` eFuse → source selector → 20 V-to-5 V converter.

The PD controller requests 20 V minimum and maximum at 3 A. Its protected
output must remain off before a valid contract. The upstream eFuse is fixed at
2.69 A nominal, 2.395 A worst-low, and 2.99 A worst-high. The current selected
system screen demands about 1.64 A continuous and 1.85 A for 100 ms at 20 V,
inside the worst-low eFuse envelope. These are declarations and arithmetic,
not PD interoperability, surge, thermal, layout, or physical closure.

## Controlled laboratory injection

A laboratory supply may inject **20 V after the PD controller and upstream
eFuse only for staged bring-up**. It is limited to 2.3 A, below the normal
eFuse's 2.395 A worst-low screen. It is not an external product interface and
must never be connected to raw USB VBUS, PPHV, CC, or USB data.

Hard source mutual exclusion uses C&K/Littelfuse `7101SYZQE`, a 5 A at 28 V DC
SPDT source selector. The common terminal feeds `V20_TO_V5_BUCK`; one throw
receives `PD_EFUSE_OUT_20V`, and the other receives `LAB_POST_EFUSE_20V`.
Both sources must be off before moving the selector. The selector physically
prevents both steady source positions from connecting simultaneously; no
diode-OR or shared-source mode is permitted.

The board connector is the bench-only Molex Micro-Fit `43045-0400`; its exact
mate is `43025-0400` with `43030-0007` loose, tin-plated 20–24 AWG terminals.
The harness uses two equal-length 20 AWG positive conductors and two
equal-length 20 AWG returns. Pin 1 and pin 2 are both `LAB_20V`; pin 3 and pin
4 are both `LAB_RETURN`. Both contacts in each pair must be present and carry
current together. An open or unequal contact is a stop condition. The paired
connector has an exact 3 A per-contact project screen; the validator rejects a
10 A declaration or any other substitution. It feeds only
`LAB_POST_EFUSE_20V`; it does not create a second product power inlet.

## Downstream protection and measurement

Littelfuse 451-series very-fast-acting fuses are screened with 25% continuous
derating. The series carries 100% of rating for at least four hours and opens
within five seconds at 200% under its data-sheet condition; a fuse rating is
not a precise current limit.

| Branch | Continuous | 100 ms peak | Selected protection |
| --- | ---: | ---: | --- |
| Display | 4.00 A | 4.00 A | `TPS259474ARPWR`, 698 Ω 1% ILM resistor: 4.78 A nominal, approximately 4.26 A worst-low and 5.31 A worst-high; secondary `045106.3MRL` 6.3 A fuse, 4.725 A after 25% derating |
| Application and housekeeping | 1.07 A | 1.69 A | `0451002.MRL` 2 A fuse, 1.50 A after 25% derating; the 100 ms peak remains below nominal rating |
| Isolated scoring | 0.32 A | 0.40 A | `0451.500MRL` 0.5 A fuse, 0.375 A after 25% derating; the 100 ms peak remains below nominal rating |

The display `TPS259474ARPWR` support network is frozen for BP-050. ILM uses
Yageo `RC0402FR-07698RL`, 698 Ω, 1%, from ILM to `APP_GND`; ITIMER and DVDT
each use KEMET `C0402C222K3RACTU`, 2.2 nF, from the named pin to `APP_GND`.
The A-suffix device is circuit-breaker auto-retry,
with the data-sheet retry interval screened at 110 ms. EN/UVLO connects
directly to `V5_DISPLAY_IN`, while OVLO connects to `APP_GND`; this deliberately
uses the data-sheet no-divider configuration because the branch input is the
already bounded V5 rail. PGTH uses `RC0402FR-07137KL` over
`RC0402FR-0749K9L`, from `V5_DISPLAY_LIMITED` through PGTH to `APP_GND`; PG
uses `RC0402FR-0710KL`, 10 kΩ, pulled up to V3_3. Input and output each use TDK
`C2012X7S1A226M125AC`, 22 µF, to `APP_GND`; the input also has KEMET
`C0402C104K3RACTU`, 0.1 µF, directly across `V5_DISPLAY_IN` and `APP_GND`.
These declarations define the schematic
population; assembled ramp, trip, retry, capacitance-under-bias, and thermal
behavior remain measurement gates.

`J_DISPLAY_DISCONNECT` is mandatory. The display remains disconnected until
exact-panel startup, current-limit behavior, panel-end voltage, cable drop,
and connector temperature are measured.

Four removable current-measurement links are required: `J_LINK_INPUT` after
the source selector, `J_LINK_DISPLAY` after display protection,
`J_LINK_APPLICATION`, and `J_LINK_SCORING`. Each uses exact Molex Mini-Fit Jr.
`39-28-1023`, mating housing `39-01-2020`, and `39-00-0039` terminals. Each
link has an exact **6 A project screen**; the validator rejects both lower and
higher declarations. Remove links only with both possible sources off.

The two sides are distinct schematic nets so an installed loopback is the only
normal current path:

| Link | Pin 1 source-side net | Pin 2 load-side net |
| --- | --- | --- |
| `J_LINK_INPUT` | `V20_TO_V5_BUCK` | `V20_BUCK_INPUT` |
| `J_LINK_DISPLAY` | `V5_DISPLAY_LIMITED` | `V5_DISPLAY_LOAD` |
| `J_LINK_APPLICATION` | `V5` | `V5_APPLICATION` |
| `J_LINK_SCORING` | `V5` | `V5_SCORING_ISOLATOR_INPUT` |

## Evidence and stop conditions

The executable declaration validator is
[`src/bench-prototype-power.ts`](../src/bench-prototype-power.ts), with tests in
[`src/bench-prototype-power.test.ts`](../src/bench-prototype-power.test.ts).
It pins the exact PD parts, contract, eFuse bounds, source selector, canonical
load minima, fuse derating, display limiter, and measurement-link hardware.
`declarationsValid: true` does not prove physical presence. The result remains
`physicalPresenceVerified: false`, `releaseState: "deny"`, and
`displayConnectedPermit: "deny-until-inrush-measured"`.

De-energize immediately for simultaneous-source evidence; source-selector
heating or intermittent behavior; unexpected PD/eFuse/fuse/limiter trip;
current above an allocation; V5 outside 4.75–5.25 V; 20 V rail outside the
reviewed PD/eFuse envelope; connector, cable, switch, or fuse heating; panel
startup foldback; odor, discoloration, or damage; or any source/link/harness
change while energized.

## Primary manufacturer references

- [Amphenol 10177070 drawing](https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10177070.pdf)
- [TI TPS25730A datasheet](https://www.ti.com/lit/ds/symlink/tps25730a.pdf)
- [TI TPD4S201-Q1 datasheet](https://www.ti.com/lit/ds/symlink/tpd4s201-q1.pdf)
- [TI TPD2EUSB30 datasheet](https://www.ti.com/lit/ds/symlink/tpd2eusb30a.pdf)
- [TI TVS2200 datasheet](https://www.ti.com/lit/ds/symlink/tvs2200.pdf)
- [Diodes Incorporated B340A datasheet](https://www.diodes.com/datasheet/download/B340A.pdf)
- [TI TPS25947 datasheet](https://www.ti.com/lit/ds/symlink/tps25947.pdf)
- [Littelfuse 451/453 fuse datasheet](https://www.littelfuse.com/assetdocs/fuse-451-and-453-datasheet?assetguid=533cd5cc-956c-4243-867f-6ab5a62f6ba1)
- [C&K/Littelfuse 7000-series selector datasheet](https://www.littelfuse.com/assetdocs/littelfuse-ck-toggle-7000-series-datasheet?assetguid=fed01bc6-88d0-4bda-b896-13c98cf9e90e)
- [Molex 43030-0007 exact terminal record](https://www.molex.com/en-us/products/part-detail/43030-0007)
- [Molex 43030-0007 drawing and part table](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/430/43030/430300007_sd.pdf?inline=)
- [Molex 43025-0400 exact mating-housing record](https://www.molex.com/en-us/products/part-detail/43025-0400)
- [Molex 39-28-1023 exact header record](https://www.molex.com/en-us/products/part-detail/0039281023)
- [Molex 39-28-1023 header series drawing/table](https://www.molex.com/en-us/products/series-chart/5566)
