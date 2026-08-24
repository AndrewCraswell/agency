# Prototype application 3.3 V rail

`BP-142` freezes the schematic-level implementation contract from the
committed `BP-050` V5 application branch to the application `V3_3` rail. It
does not change or revive the retired multi-board schematic model.

## Exact implementation

`J_LINK_APPLICATION` is the removable BP-050 V5 branch-measurement link. With
its loopback installed, V5 feeds `U_APP_REGULATOR` TI
`LMR43620MSC3RPERQ1`. VIN and EN/UVLO connect to V5, MODE/SYNC connects to
VCC for FPWM with spread spectrum, and the open-drain PGOOD output has a 10
kOhm V5 pull-up for observation only. The fixed-output VOUT/FB pin connects
directly to `V3_3`; there is no adjustable-output feedback divider. It does
not own reset behavior.

The required support network is:

| References | Exact MPN | Value | Required connection |
| --- | --- | --- | --- |
| `U_APP_REGULATOR` | `LMR43620MSC3RPERQ1` | fixed 3.3 V, 2 A buck | VIN and EN/UVLO from V5; GND to `APP_GND`; SW to inductor; VOUT/FB directly to `V3_3` |
| `L_APP_REGULATOR` | `XGL4030-222MEC` | 2.2 uH | SW to `V3_3` |
| `C_APP_REG_IN` | `C2012X7R1E475K125AB` | 4.7 uF, 25 V | V5 to `APP_GND` at VIN |
| `C_APP_REG_IN_HF`, `C_APP_REG_BOOT` | `C0603C104K3RACTU` | 100 nF, 25 V | VIN to ground, and BOOT to SW respectively |
| `C_APP_REG_VCC` | `885012206052` | 1 uF, 16 V, +/-10%, X7R, 0603 | VCC to `APP_GND`; exact TI EVM CVCC selection |
| `C_APP_REG_OUT_A/B/C` | `C2012X7S1A226M125AC` | 22 uF, 10 V each | Each capacitor connects directly from `V3_3` to `APP_GND`; 40 uF effective bank minimum |
| `R_APP_REG_DISCHARGE` | `RC0603FR-071KL` | 1 kOhm | `V3_3` to `APP_GND` |
| `R_APP_REG_PGOOD` | `RC0603FR-0710KL` | 10 kOhm | V5 to PGOOD observation net |

## Conservative screens

The retained LMR43620 calculation uses 4.75 V minimum V5, 3.27 V minimum
output, 85 percent efficiency, 2.60 W continuous load, 3.20 W peak load, 40
uF effective output capacitance, and a 50 C blocked-vent screen. The BP-050
application branch continues to have positive current headroom after the
calculated regulator input current is allocated.

The regulator has 1.15 V input-startup margin above its 3.6 V startup limit.
Its maximum 4.6 ms soft start is retained, but reset timing is deliberately
not credited: `BP-123` owns the supervisor and reset network.

The 100 ms BP-050 peak is not treated as a capacitor hold-up event. At the
40 uF effective minimum and the reserved 50 mV transient allowance, the
output bank alone supports the continuous-to-peak increment for only about 11
microseconds. Load-step response at the actual point of load must therefore
be measured. The retained thermal arithmetic screen is below its 125 C target
but is not a board thermal model.

## Denied release state

The executable contract keeps footprint, layout, capacitor, startup,
load-step, thermal, schematic-integration, and fabrication evidence denied.
Before any release, import and independently review exact land patterns,
measure V5 and V3_3 at the stated nodes, verify effective output capacitance,
scope startup and the 100 ms load step, complete a 50 C thermal test, and
close BP-123, BP-033, and the later schematic and PCB gates.
