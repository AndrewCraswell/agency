# BP-121 sole-ESP32 P0 allocation

The ESP32-S3-WROOM-1U-N16R2 is the only P0 processor. GPIO4, GPIO5, and
GPIO6 drive the dedicated ADS8881 daisy-chain SPI/GDMA interface (`SAR_SCLK`,
`SAR_DOUT`, and hardware-timed `SAR_CONVST`). GPIO7 latches primary lamp and
buzzer data shifted on the existing application SPI clock/data pair. External
reset/output-enable hardware holds those loads inactive until a complete safe
frame is present.

W5500, all 13 HUB75 signals, native USB GPIO19/20, TSOP38438 IR on GPIO35 RMT,
UART0/BOOT/EN recovery pads, and the external watchdog kick remain allocated.
GPIO10, 11, 15, 17, 36, 37, and 47 remain uncommitted P0 spares. F-RAM,
optional I2C, peer heartbeats, isolated scoring SPI, audio, and both populated
service headers consume no P0 pins.

No comparator GPIOs are allocated. BP-127 must prove that continuous
seven-channel ADS8881 sampling meets the acquisition and timestamp budget
under simultaneous Ethernet, HUB75, IR, USB, radio, and permitted flash/cache
load. If it fails, this allocation must reopen before schematic release.
