# USB power controller

U21 (STM32C011F6P6) supervises STUSB4500 and the isolated power enables. This is separate from the STM32G474 scoring
firmware. One board and one USB-C receptacle serve both modes; there is no physical mode switch.

- Reset, disconnect, invalid supply and communication faults disable acquisition and inhibit application power.
- Non-PD Type-C requires at least 1.5A advertised current. PD laptop mode requires a validated 5V contract of at least
  1.5A. Application power stays off and LTM2884 automatic USB suspend shutdown stays enabled.
- Display mode requires fresh source capabilities explicitly declaring no USB communication capability, a fixed 20V/3A
  offer, and an accepted matching contract. Voltage, absent enumeration and elapsed time are never charger detection.
- Volatile sink profiles select PDO1 (5V/1.5A) or PDO1 plus PDO2 (20V/3A). PDO2 matches the board's POWER_OK2 hardware
  gate. Every profile is read back before renegotiation. No NVM writes occur at boot. Verify U5 POWER_OK_CFG=10b and
  REQ_SRC_CURRENT=0 factory defaults during bring-up.
- Missing source capabilities trigger Get_Source_Cap once per unknown contract while outputs remain off. Failed I2C
  transfers force reinitialization.

The target uses HSI48 divided to 6MHz, PB6/PB7 AF6 I2C, bounded polling and an independent watchdog. PA4 controls
acquisition, PA5 inhibits application power, and PA11 controls suspend shutdown. Reset pulls enforce the safe state
before firmware starts. No heap, RTOS or external firmware library is required.

PA6 is a digital ALERT_N input. Once laptop/display power is qualified, register traffic occurs on an asserted alert or
a 10ms health check, rather than continuously pulling I2C lines low. Between these checks the qualified, alert-free
controller enters shallow Sleep with WFI and wakes on a nominal 1ms SysTick interrupt. The ISR only returns; COUNTFLAG
remains owned by the poller. Transactions, unknown supplies and error recovery never request sleep. The watchdog is
refreshed by the main loop, not the ISR, so timer interrupts cannot conceal a stalled main loop.

PA6 is polled, not an interrupt wake source: an alert arriving just after its check can wait up to the next nominal 1ms
tick plus wake/processing time. A tick handled just before WFI can similarly postpone polling by one period. The
existing hardware gates and LTM2884 automatic USB-suspend behavior are unchanged. Shallow Sleep keeps SysTick running;
this is not Stop mode. Confirm wake timing, fault/detach behavior and total input current on the prototype before
claiming a measured suspend-power margin. The conservative 4mA VLO budget is not reduced by this code change. See
[STM32C0 RM0490, Sleep mode](https://www.st.com/resource/en/reference_manual/rm0490-stm32c0-series-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
and [PM0223, WFI wake-up](https://www.st.com/resource/en/programming_manual/dm00104451.pdf).

## Build and verify

Run from the repository root with Clang, LLD, LLVM tools, CMake and Ninja on PATH:

```powershell
cmake -G Ninja -S apps/scoring/firmware/power-control -B apps/scoring/firmware/out/power-control -DCMAKE_C_COMPILER=clang -DSCORING_ENABLE_LLVM_COVERAGE=ON
cmake --build apps/scoring/firmware/out/power-control
ctest --test-dir apps/scoring/firmware/out/power-control --output-on-failure
& apps/scoring/firmware/power-control/build-target.ps1
pnpm --filter scoring test:c-coverage
```

ELF, HEX and BIN output goes into ignored `firmware/out/power-control-target`. The native tests exercise policy and the
actual register-level driver using fake MMIO. Existing coverage checks include both C files at the non-core 80% minimum;
scoring-core requirements remain 100%.

## Programming and physical checks

J14 underside pads: 1=VLO reference, 2=USB_GND, 3=SWDIO, 4=SWCLK, 5=NRST. Do not inject debugger power into VLO or
bridge the isolation barrier with grounded equipment. Flash the HEX using an appropriately isolated SWD setup.

Current native J14 geometry: five 1.2mm square underside pads on 2mm pitch. In KiCad board coordinates, pads 1 through 5
are at x=55.5mm and y=113, 111, 109, 107, 105mm respectively. The fixture designer must use the native underside view
and board datums, not mirror these coordinates a second time. No fixture or physical probe fit has been tested.

The native board's manufacturing exporter now cross-builds the current image into `programming/U21/`, with this
instruction sheet. `power-control.hex` is for **U21 STM32C011F6P6 only**, not U1 STM32G474 or the ESP32. The HEX carries
its load addresses; do not reinterpret it as an unaddressed binary or change option bytes/readout protection. Keep SWD
available for owner firmware development.

For the requested no-owner-soldering prototype, ask the assembler to program U21 through a pogo fixture on J14 and
verify flash readback before shipment. Fixture/service acceptance is outstanding; including a HEX does not purchase or
confirm that service. Use current-limited, isolated power at J1; VLO is the programmer's voltage reference, not a power
injection point. Leave all fencer, piste, repeater and HUB75 connections disconnected during programming. Confirm a
stable VLO and SWD connection before attempting flash; do not bridge USB_GND to secondary GND to make a probe work.
Record the programmed HEX hash, readback result and reset behavior for each board. Check U5 POWER_OK_CFG=10b and
REQ_SRC_CURRENT=0 as above without blindly writing NVM. Qualified power/USB operation remains a separate bring-up test.

This is the first-programming handoff, not complete application firmware or a tested factory fixture. If the assembler
cannot provide it, obtain a no-solder probe-fixture solution before representing the delivery as ready for programming.

The image is cross-built and host-tested, not flashed or bench-qualified. Measure VLO consumption against its 10mA
allowance, I2C rise times/message-capture latency, watchdog timing, startup/input current, USB suspend/resume, hot
unplug, and 5V/20V transitions on the assembled prototype. Verify laptop sources never release the application branch.
HUB75 is disconnected in laptop builds. These tests do not establish USB certification, isolation safety or fabrication
approval.

Register references:
[ST programming guide](https://www.st.com/resource/en/user_manual/um2650-the-stusb4500-software-programing-guide-stmicroelectronics.pdf),
[STUSB4500 data sheet](https://www.st.com/resource/en/datasheet/stusb4500.pdf),
[STM32C011 data sheet](https://www.st.com/resource/en/datasheet/stm32c011f6.pdf).
