# USB power controller

STM32C011F6P6 supervises STUSB4500 and the isolated power enables. This is separate from STM32G474 scoring firmware. The
same source builds a **combined-board U21** image or **virtual-box U24** image; select the board when building, not with
a physical switch. Do not flash one board's image onto the other.

## Virtual scoring box

Use `build-target.ps1 -Board virtual`. The virtual configuration only writes and reads back one 5V/1.5A sink PDO; it
never enables the 20V display profile. Both processors share the isolated supply.

- Non-PD Type-C requires one valid CC orientation advertising at least 1.5A. That advertised current is available during
  USB suspend, including wall-charger operation without enumeration.
- PD requires fresh source capabilities and a matching fixed 5V contract of at least 1.5A. A source explicitly declaring
  no USB communication capability is treated as a charger. For a USB-capable source, its first PDO's **USB Suspend
  Supported** flag determines whether the CP2102N sleep signal must disable scoring power. That flag is undefined on a
  non-USB source; a sink's **No USB Suspend** request alone never grants an exemption.
- PA4=`SOURCE_ALLOWED`, PA5=`USB_SUSPEND_EXEMPT`, both push-pull and default low. One atomic GPIO write updates the
  pair. PA1 reads the eFuse's active-low fault; a fault suppresses both grants. The hardware gate implements
  `(USB_AWAKE OR USB_SUSPEND_EXEMPT) AND SOURCE_ALLOWED`, so USB-sleep shutoff does not wait for the firmware poll.
- PA0 holds PD RESET low; PA6 receives ALERT_N, PA7 receives USB_AWAKE. PB6/PB7 remain I2C, PA13/PA14 remain SWD.
- The MCU uses **Stop0**, with SysTick disabled, GPIO-edge wake for fault/PD alert/USB state and an internal-LSI RTC
  alarm nominally every **32ms**. This is a power-health timer, never scoring time. Pending events are rechecked with
  interrupts masked before WFI; wake restores the 6MHz divider before interrupts resume. The main loop alone feeds the
  watchdog. Failure to initialize the RTC or watchdog leaves grants off and allows the watchdog to reset the MCU.

The CP2102N can enumerate while the scoring supply is off. It uses the CP210x VCP driver; this power firmware is not the
STM32G474 serial transport or desktop application. Factory programming must configure/read back **U23 STUSB4500's single
5V/1.5A NVM PDO** separately. The runtime only changes volatile registers and cannot make an unsafe NVM image safe
before its first negotiation.

Program **U24 only** through J7: 1=USB_HOST_3V3 reference, 2=USB_GND, 3=SWDIO, 4=SWCLK, 5=NRST. Confirm the native pad
numbering and use an isolated probe without injecting power or bridging USB_GND to scoring GND. Initial STM32G474 and
ESP32 recovery remains through their separate service headers. No application firmware or bench qualification is implied
by a successfully built power-controller image.

The policy and register-adapter tests cover USB-capable and non-USB sources, both suspend flags, Type-C orientations and
current thresholds, rejected 20V contracts, faults/detach/reset, I2C failures, failed wake clocks and sleep-entry races.
These are host tests, not measurements. Measure startup, shutdown, radio load steps, every qualified-source transition,
USB suspend/resume current, alert latency, eFuse timing and I2C edges on the assembled board. A stuck-low PD alert can
prevent Stop entry during a communication fault; this recovery case also belongs in the input-current bench test.

References:
[USB-IF Type-C functional tests, suspend test 4.10.3](https://www.usb.org/sites/default/files/USB%20Type%20C%20Functional%20Test%20Specification%202024%2003%2003.pdf),
[USB-IF PD specification bundle, companion PD2.0 v1.3 section 6.4.1.2.3.2](https://www.usb.org/sites/default/files/USB_PD_R3.2_V1.2_2.zip),
[STM32C0 RM0490](https://www.st.com/resource/en/reference_manual/rm0490-stm32c0-series-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)
and
[ST's STM32C011 register definitions](https://github.com/STMicroelectronics/cmsis-device-c0/blob/master/Include/stm32c011xx.h).

## Combined board

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
& apps/scoring/firmware/power-control/build-target.ps1 -Board combined
& apps/scoring/firmware/power-control/build-target.ps1 -Board virtual
pnpm --filter scoring test:c-coverage
```

ELF, HEX and BIN output goes into ignored `firmware/out/power-control-<board>-target`. The native tests exercise policy
and the actual register-level driver using fake MMIO. Existing coverage checks include both C files at the non-core 80%
minimum; scoring-core requirements remain 100%.

## Combined-board programming and physical checks

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
