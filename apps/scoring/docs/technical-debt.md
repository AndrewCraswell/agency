# Scoring technical debt

Only current, actionable findings belong here. Closed work is removed rather than archived.

| Priority | State | Description | Impact |
| --- | --- | --- | --- |
| High | ready | Replace remaining dual-MCU terminology and contracts with the single-ESP32 prototype boundary after the PCB pinout is frozen. | Prevents firmware and security work from implementing a retired STM32-to-ESP32 architecture. |
| High | active | Remove retired BP/M4 source and test modules once every active clean-sheet footprint or calculation dependency has a semantic home. | Reduces type-check failures, test noise, and accidental reuse of denied prototype evidence. |
| Medium | ready | Generate the preview BOM from the integrated circuit model instead of the retired bench BOM. | Keeps purchasing and board previews aligned with the 250 populated references. |
| Low | ready | Remove React special-prop warnings from circuit test renders. | Keeps focused placement and schematic test output signal-rich. |
