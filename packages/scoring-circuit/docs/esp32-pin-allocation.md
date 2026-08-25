# BP-121 sole-ESP32 P0 allocation

The ESP32-S3-WROOM-1U-N16R2 is the only P0 processor. GPIO4, GPIO5, and
GPIO6 drive the dedicated ADS8881 daisy-chain SPI/GDMA interface (`SAR_SCLK`,
`SAR_DOUT`, and hardware-timed `SAR_CONVST`). GPIO7, GPIO15, GPIO17, GPIO10,
and GPIO11 directly command the five logic inputs of one protected primary
output driver. Its hardware enable is held inactive by reset/watchdog circuitry,
and every input must default inactive. The serialized latch was removed because
the ESP32 has enough GPIOs and the extra stateful IC did not earn its place.

W5500, all 13 HUB75 signals, native USB GPIO19/20, TSOP38438 IR on GPIO35 RMT,
UART0/BOOT/EN recovery pads, and the external watchdog kick remain allocated.
GPIO36, 37, and 47 remain uncommitted P0 spares. F-RAM,
optional I2C, peer heartbeats, isolated scoring SPI, audio, and both populated
service headers consume no P0 pins.

No comparator GPIOs are allocated. BP-127 must prove that continuous
seven-channel ADS8881 sampling meets the acquisition and timestamp budget
under simultaneous Ethernet, HUB75, IR, USB, radio, and permitted flash/cache
load. If it fails, this allocation must reopen before schematic release.
