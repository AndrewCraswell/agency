# BP-127 ESP32-S3 scoring feasibility

The simplified allocation passes two conservative paper screens without
claiming hardware closure. GPIO4/5/6 provide a dedicated SPI3/GDMA ADS8881
path, GPIO7 latches primary outputs shifted on SPI2, and seven GPIOs remain
uncommitted. A seven-device, 20-bit daisy-chain frame is 140 bits: 7 µs at
20 MHz. Including a 1 µs guard gives an 8 µs scan and at least 12 completed
scans during a 100 µs sabre signal.

That arithmetic is enough to proceed with the one-cell experiment, not enough
to release a schematic or remove comparator options permanently. The target
ESP32, exact AFE/reference/ADC path, and candidate safe-output circuit must run
boundary resistance/capacitance/pulse vectors while Ethernet, HUB75, IR, USB,
radio, and the enforced flash/cache policy are stressed.

SPI/GDMA overflow, short or stale frames, wrong channel order, missed timer
ticks, excessive consumer lag, invalid rails/reference, watchdog failure, or
output-health failure all latch scoring unavailable. No oldest-frame drop,
partial frame, guessed sample, or reset-surviving candidate is allowed.

The experiment and seven-channel stress evidence are still open. BP-127 and
dependent fabrication tasks remain blocked until those physical results and
the simplified rail budget pass root review.
