# BP-034 minimal connector set

P0 orders only the connector families needed to power, network, display, and
connect weapons:

- USB-C PD receptacle and a 20 V, 3 A capable USB-C cable;
- the owner-approved OK Fencing weapon sockets, wired to labeled board
  landings with independent strain relief;
- W5500 integrated-magnetics RJ45 and a Cat6 test cable;
- HUB75 signal and protected display-power connectors.

The lab-input connector, source selector, STM32 SWD header, and populated
ESP32 service header are removed. Recovery uses native USB and labeled test
pads. The weapon cable itself is owner-validated and is not a blocker; the
received socket identity, mounting dimensions, and strain-relieved wiring
remain physical evidence gates.
