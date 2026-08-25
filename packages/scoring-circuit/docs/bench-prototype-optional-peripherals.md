# BP-145 minimal optional-peripheral population

The ESP32-S3-only P0 prototype populates none of the optional application
peripherals. This removes their devices, support parts, land patterns, routing,
bus arbitration, procurement, and bring-up work from the prototype.

| Reference | P0 disposition | Why |
| --- | --- | --- |
| `U_FRAM` | DNP | ESP-IDF encrypted NVS supplies bounded persistence; queued writes occur only after active scoring stops. |
| `U_RTC` | DNP | Canonical scoring uses monotonic time. Network or test-host wall time is metadata only. |
| `U_SECURE_ELEMENT` | DNP | ESP32 eFuses and encrypted NVS own encrypted-remote identity and counters for P0. |
| `U_AUDIO` | DNP | The primary buzzer output provides audible indication. GPIO35 remains dedicated to IR receive. |
| `J_SPEAKER` | DNP | No onboard audio amplifier or P0 speaker load exists. |
| `ANT_EXTERNAL` | DNP | Ethernet is mandatory. Wi-Fi and Bluetooth remain disabled unless a temporary reviewed antenna is attached. |

No speculative footprints, pull-ups, bypass capacitors, connectors, or bus
stubs for these options belong on P0. A later production feature must return as
a new reviewed BOM decision rather than inheriting authority from a DNP row.

The retained persistence boundary uses ESP32 eFuses for device identity and
ESP-IDF encrypted NVS for storage. Flash erase and write are prohibited while
scoring acquisition is active. Remote-counter or journal updates wait in a
bounded internal-RAM queue and flush only after scoring stops. Corrupt or
unavailable NVS disables authenticated remote commands but cannot alter
electrical hit classification.

This decision does not approve the 3.3 V rail, layout, or fabrication. BP-121
and BP-142 still supply those dependencies.
