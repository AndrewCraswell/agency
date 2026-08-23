export type ComponentDecision = {
  category: string
  lifecycle: "active" | "active-preferred"
  manufacturer: string
  manufacturerUrl: string
  mpn: string
  purpose: string
  qualification: string
}

export const componentDecisions = [
  {
    category: "scoring-controller",
    lifecycle: "active",
    manufacturer: "STMicroelectronics",
    manufacturerUrl: "https://www.st.com/en/microcontrollers-microprocessors/stm32g474re.html",
    mpn: "STM32G474RET3TR",
    purpose: "Authoritative acquisition, timing, touch qualification, lamps, and buzzer",
    qualification: "Volume production; 170 MHz; five 4 MSPS ADCs; seven comparators; -40 C to 125 C"
  },
  {
    category: "application-controller",
    lifecycle: "active",
    manufacturer: "Espressif",
    manufacturerUrl: "https://www.espressif.com/en/products/modules/esp32-s3/esp32-s3-wroom-1",
    mpn: "ESP32-S3-WROOM-1U-N16R2",
    purpose: "Display, networking, storage, remote control, cloud sync, and OTA",
    qualification: "16 MB flash; 2 MB PSRAM; external antenna; -40 C to 85 C"
  },
  {
    category: "processor-isolation",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/ISO7762",
    mpn: "ISO7762FDWR",
    purpose: "Four STM32-to-ESP32 and two ESP32-to-STM32 reinforced digital channels",
    qualification: "100 Mbps; wide SOIC; reinforced isolation; -55 C to 125 C"
  },
  {
    category: "processor-isolation",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/ISO7721",
    mpn: "ISO7721FDR",
    purpose: "STM32 heartbeat plus an opposite-direction service-only spare across the reinforced boundary",
    qualification: "100 Mbps; reinforced isolation; -55 C to 125 C"
  },
  {
    category: "isolated-power",
    lifecycle: "active",
    manufacturer: "Murata",
    manufacturerUrl: "https://www.murata.com/en-us/products/productdata/8807031865374/kdc-nxe1.pdf",
    mpn: "NXE1S0505MC",
    purpose: "One-watt isolated scoring-domain supply followed by local low-noise regulation",
    qualification: "UL 62368-1 recognized; 3 kVDC isolation; production thermal and EMC validation required"
  },
  {
    category: "scoring-reference",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/REF5025A-Q1",
    mpn: "REF5025AQDRQ1",
    purpose: "Low-drift 2.5 V reference for sensing thresholds and production calibration",
    qualification: "AEC-Q100; -40 C to 125 C; exact analog values remain gated by weapon testing"
  },
  {
    category: "line-switch",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TMUX1112",
    mpn: "TMUX1112PWR",
    purpose: "Independently controlled source and sink paths for the seven external scoring conductors",
    qualification: "Use four; active-high fail-safe control; 2 ohm typical; 3 pA typical leakage; -40 C to 125 C"
  },
  {
    category: "line-protection",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPD4E05U06",
    mpn: "TPD4E05U06DQAR",
    purpose: "Connector-adjacent low-capacitance ESD and EFT shunt for the seven scoring conductors",
    qualification: "Use two; 0.5 pF typical; 12 kV IEC contact ESD; 2.5 A 8/20 us surge; -40 C to 125 C"
  },
  {
    category: "hardware-watchdog",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS3431",
    mpn: "TPS3431SDRBR",
    purpose: "Independent watchdog for each processor domain",
    qualification: "Window watchdog; -40 C to 125 C"
  },
  {
    category: "power-supervisor",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS3890",
    mpn: "TPS389033DSER",
    purpose: "Precision 3.3 V brownout and delayed reset supervision",
    qualification:
      "3.170 V falling and 3.189 V rising nominal thresholds; +/-1% threshold accuracy; open-drain reset; exact C0603C104K3RACTU 100 nF CT gives approximately 107 ms nominal but the release proof uses 61.2 nF effective, 1.17 V minimum CT threshold, 1.35 uA maximum charge current, and no baseline-delay credit for a 53.04 ms calculated minimum; -40 C to 125 C"
  },
  {
    category: "system-regulator",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS56A37/part-details/TPS56A37RPAR",
    mpn: "TPS56A37RPAR",
    purpose: "Ten-ampere synchronous buck from the negotiated USB-PD input to the five-volt system and display rail",
    qualification:
      "4.5 V to 28 V input; 10 A continuous output; integrated MOSFETs; -40 C to 150 C junction. The 7.99 A continuous and 9.01 A short-peak envelopes retain only 2.01 A and 0.99 A nominal headroom, so layout, thermal, panel-inrush, and bench-current evidence remain release gates"
  },
  {
    category: "application-rail-regulator",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/LMR43620-Q1",
    mpn: "LMR43620MSC3RPERQ1",
    purpose: "Fixed 3.3 V, 2 A synchronous buck for the ESP32 application rail and reset supervisor",
    qualification:
      "Active automotive orderable; 3.6 V to 36 V startup input, 2 A, fixed 2.2 MHz, spread spectrum, 3.27 V to 3.33 V fixed-output accuracy over line/load/temperature in FPWM; 2 mm x 2 mm VQFN-HR RPE; thermal layout and transient validation required"
  },
  {
    category: "power-protection",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS25947",
    mpn: "TPS259474ARPWR",
    purpose: "Post-contract integrated reverse-current-blocking eFuse and overcurrent protection for the USB-PD input",
    qualification:
      "Active production, 10-pin RPW VQFN-HR; TPS259474A circuit-breaker auto-retry behavior with integrated back-to-back reverse-current blocking FETs. Model UVLO, OVLO, ILM (1 percent 1.24 kOhm: 2.69 A nominal, 2.99 A maximum with TI plus or minus 10 percent), ITIMER, DVDT (20 to 22 ms), PGTH (1 percent 698 kOhm/49.9 kOhm: 17.65 to 18.32 V), PG and output capacitance for the 3 A contract"
  },
  {
    category: "power-monitor",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/INA238",
    mpn: "INA238AIDGSR",
    purpose: "Display and system rail voltage, current, power, and fault telemetry",
    qualification: "16-bit monitor with alert; -40 C to 125 C"
  },
  {
    category: "ethernet",
    lifecycle: "active",
    manufacturer: "WIZnet",
    manufacturerUrl: "https://docs.wiznet.io/Product/Chip/Ethernet/W5500/datasheet",
    mpn: "W5500",
    purpose: "Dedicated wired Ethernet on an ESP32 SPI host independent of the scoring link",
    qualification: "10/100 Ethernet controller; validate magnetics, ESD, emissions, and thermal limits"
  },
  {
    category: "ethernet-connector",
    lifecycle: "active",
    manufacturer: "Wurth Elektronik",
    manufacturerUrl: "https://www.we-online.com/en/components/products/WE-LAN-RJ45",
    mpn: "7499011121A",
    purpose: "Chassis-supported 10/100 Ethernet connector with integrated magnetics and status LEDs",
    qualification: "Through-hole shielded RJ45; -40 C to 85 C; footprint, EMC, and surge validation remain open"
  },
  {
    category: "usb-c-power-and-service-connector",
    lifecycle: "active",
    manufacturer: "Amphenol Communications Solutions",
    manufacturerUrl: "https://www.amphenol-cs.com/product/1017707000011lf.html",
    mpn: "10177070-00011LF",
    purpose: "Replaceable USB 2.0 Type-C UFP port; sole apparatus USB-PD power input and native service data",
    qualification:
      "20,000 mating cycles; 5 A; 20 V; -40 C to 105 C; exact 0.80 mm-board footprint and chassis strain relief remain required"
  },
  {
    category: "usb-pd-port-protection",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPD4S201-Q1/part-details/TPD4S201TRGRRQ1",
    mpn: "TPD4S201TRGRRQ1",
    purpose: "Connector-side CC1, CC2, D+, and D- short-to-VBUS and IEC ESD protection for 20 V SPR",
    qualification:
      "Active AEC-Q100 device; 28 V CC/D+/D- short-to-VBUS tolerance; 8 kV IEC contact ESD; -40 C to 105 C; connector CC enters C_CC1/C_CC2, RPD_G1/G2 return there, protected CC1/CC2 route to TPS25730A, and /FLT routes to FAULT_IN"
  },
  {
    category: "usb-pd-vbus-transient-protection",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TVS2200/part-details/TVS2200DRVR",
    mpn: "TVS2200DRVR",
    purpose: "22 V flat-clamp connector-side VBUS TVS for the 20 V USB-PD SPR input",
    qualification:
      "Active; 22 V standoff; connector-side nominal transient clamp only. Its 28.35 V worst-case 35 A, 125 C clamp exceeds TPS25730A 28 V absolute maximum before layout inductance, so chip-pin surge survival remains a release gate"
  },
  {
    category: "usb-pd-controller",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS25730A/part-details/TPS25730ADREFR",
    mpn: "TPS25730ADREFR",
    purpose: "Standalone USB-PD sink-only UFP controller with internal 20 V, 5 A protected power path",
    qualification:
      "Active production; USB-IF PD3.2 TID 15340; -40 C to 125 C; ADCIN1=4 minimum 20 V, ADCIN2=6 with PD5VMAX low maximum 20 V plus mismatch auto-disable, ADCIN3=3 operating 3 A, ADCIN4=1 maximum 3 A"
  },
  {
    category: "field-serial",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/ISO1410",
    mpn: "ISO1410BDWR",
    purpose: "Isolated, protected half-duplex RS-485 service and repeater transport",
    qualification: "Five-kilovolt isolation and IEC contact ESD; not claimed as Favero wire compatibility"
  },
  {
    category: "display-buffer",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/SN74AHCT245",
    mpn: "SN74AHCT245PWR",
    purpose:
      "Three-volt to five-volt HUB75 signal buffering with a required schematic-level default-blank pull network",
    qualification: "Use two devices; -40 C to 125 C"
  },
  {
    category: "reset-combiner",
    lifecycle: "active",
    manufacturer: "Nexperia",
    manufacturerUrl: "https://www.nexperia.com/product/BSS138AKA",
    mpn: "BSS138AKA",
    purpose: "Low-side open-drain sinks for the isolated STM32 reset request and reset-gated HUB75 buffers",
    qualification: "60 V N-channel logic-level MOSFET; AEC-Q101 qualified; -55 C to 150 C"
  },
  {
    category: "event-journal",
    lifecycle: "active-preferred",
    manufacturer: "Infineon",
    manufacturerUrl: "https://www.infineon.com/part/CY15B104Q-LHXIT",
    mpn: "CY15B104Q-LHXIT",
    purpose: "Power-fail-safe configuration and completed-event journal, not continuous raw capture",
    qualification: "4 Mbit SPI F-RAM; industrial; preferred through at least 2033"
  },
  {
    category: "real-time-clock",
    lifecycle: "active",
    manufacturer: "Micro Crystal",
    manufacturerUrl: "https://www.microcrystal.com/fileadmin/Media/Products/RTC/Datasheet/RV-3028-C7.pdf",
    mpn: "RV-3028-C7",
    purpose: "Low-power wall-clock timestamps independent of network availability",
    qualification: "45 nA typical timekeeping; -40 C to 85 C"
  },
  {
    category: "secure-element",
    lifecycle: "active",
    manufacturer: "STMicroelectronics",
    manufacturerUrl: "https://www.st.com/en/secure-mcus/stsafe-a110.html",
    mpn: "STSAFE-A110",
    purpose: "Per-device identity, signing keys, and authenticated service/cloud sessions",
    qualification: "Volume production secure element; provision through a controlled manufacturing flow"
  },
  {
    category: "audio-amplifier",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TAS2505-Q1",
    mpn: "TAS2505TRGERQ1",
    purpose: "Diagnostic-capable mono Class-D scoring audio",
    qualification: "AEC-Q100; -40 C to 105 C; final SPL depends on the speaker and enclosure"
  }
] as const satisfies readonly ComponentDecision[]

export const forbiddenLifecycleStates = ["obsolete", "not-recommended-for-new-design"] as const

// This is a research snapshot, not a substitute for a purchase-time lifecycle check.
export const componentEvidenceAsOf = "2026-08-22"
