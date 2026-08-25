# BP-125 ESP32 processor footprint reconciliation

This read-only reconciliation binds the reviewed P0 processor-support contract
to the sole `ESP32-S3-WROOM-1U-N16R2` candidate in `BP-032`. It keeps the
Espressif datasheet, DXF, and STEP evidence attached to the exact module and
does not create board-import or fabrication authority.

The checklist covers the exact module and pin-one datum, EN/reset and boot
support, decoupling and recovery, and the external-antenna cable/enclosure
review. It intentionally contains no STM32, isolation, SWD, or dual-MCU
requirements.

Schematic sign-off, overlay, EPAD via/paste/mask/courtyard review, RF placement
review, layout approval, and fabrication remain denied.
