# BP-040 ESP32-only net classes

The simplified P0 has one electrical ground system. `APP_GND` is the main
plane. `SCORING_SGND` names a quiet analog return region for the protected
weapon AFE, REF5025, and ADS8881 chain; it connects to `APP_GND` once at the
reviewed ADC/reference boundary and is not a galvanically isolated domain.

The ISO7762, ISO7721, and NXE1S0505 parts are DNP. There is no isolation
corridor, isolated power branch, lab input, or source selector on P0.

Keep USB at 90 ohms and W5500 Ethernet MDI at 100 ohms over uninterrupted
`APP_GND`. Route display, conversion, and primary-output currents in short
local loops and keep their returns out of `SCORING_SGND`. Connector surge and
shield current must not share signal-reference paths.

This is a schematic and layout input only. Stackup, exact placement, DRC, and
fabrication approval remain open.
