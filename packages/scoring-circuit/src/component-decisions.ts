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
    mpn: "TPS389018DSER",
    purpose: "Precision brownout and delayed reset supervision",
    qualification: "One-percent threshold accuracy; -40 C to 125 C"
  },
  {
    category: "system-regulator",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS55288",
    mpn: "TPS55288RPMR",
    purpose: "Four-switch buck-boost for the five-volt system and display rail",
    qualification: "2.7 V to 36 V input; -40 C to 150 C junction; thermally validate the selected inductor"
  },
  {
    category: "power-protection",
    lifecycle: "active",
    manufacturer: "Texas Instruments",
    manufacturerUrl: "https://www.ti.com/product/TPS2663",
    mpn: "TPS26631PWPT",
    purpose: "Industrial surge, inrush, overvoltage, reverse-polarity, and overcurrent protection for the 24 V input",
    qualification: "Active; 4.5 V to 60 V; 6 A; -40 C to 125 C; IEC 62368-1 certified"
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
    category: "service-connector",
    lifecycle: "active",
    manufacturer: "Amphenol Communications Solutions",
    manufacturerUrl: "https://www.amphenol-cs.com/product/1017707000011lf.html",
    mpn: "10177070-00011LF",
    purpose: "Replaceable USB 2.0 Type-C service and limited service-power connection",
    qualification: "20,000 mating cycles; 5 A; 20 V; -40 C to 105 C; chassis strain relief remains required"
  },
  {
    category: "primary-power-connector",
    lifecycle: "active",
    manufacturer: "Neutrik",
    manufacturerUrl: "https://www.neutrik.com/en/product/nc4md-lx",
    mpn: "NC4MD-LX",
    purpose: "Locking chassis inlet for the external certified 24 V supply",
    qualification: "10 A per contact below 50 V; above 1,000 mating cycles; keyed harness validation remains open"
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
