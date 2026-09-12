"""Prepare U5's standalone profile from a real, 40-byte STUSB4500 NVM readback.

Offline only: this does not connect to, erase or program hardware. Reserved bytes
come from the supplied device, not from another board's factory defaults.
Field layout: SparkFun_STUSB4500_Arduino_Library, read/write and configuration
setters; see power-handoff.md for sources and the required factory checks.
"""

import argparse
import hashlib
from pathlib import Path


def prepare_profile(original: bytes) -> bytes:
    if len(original) != 40 or original in (bytes(40), bytes([255]) * 40):
        raise ValueError("Expected a nonblank raw 40-byte STUSB4500 NVM readback")
    profile = bytearray(original)
    # Sector 3, byte 2: 0.5A PDO1, two PDOs, no external power, no USB data.
    profile[26] = 0x14
    # Sector 3, byte 4: PDO2 current code 11 = 3A; preserve UVLO setting.
    profile[28] = (profile[28] & 0xF0) | 0x0B
    # Sector 4, bytes 0/1: PDO2 = 400 * 50mV = 20V.
    profile[32] &= 0x3F
    profile[33] = 0x64
    # POWER_OK_CFG = 10b. Preserve unrelated fields in the same byte.
    profile[36] = (profile[36] & 0x9F) | 0x40
    # POWER_ONLY_ABOVE_5V = 1; REQ_SRC_CURRENT = 0.
    profile[38] = (profile[38] & 0xE7) | 0x08
    return bytes(profile)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("readback", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    original = args.readback.read_bytes()
    profile = prepare_profile(original)
    # Never overwrite the readback or an earlier programming image.
    with args.output.open("xb") as output:
        output.write(profile)
    print("U5: PDO1 5V/0.5A; PDO2 20V/3A; two PDOs; power-only above 5V")
    print("Source SHA256:", hashlib.sha256(original).hexdigest())
    print("Output SHA256:", hashlib.sha256(profile).hexdigest())
    for index, (before, after) in enumerate(zip(original, profile)):
        if before != after:
            print(f"Sector {index // 8}, byte {index % 8}: {before:02X} -> {after:02X}")
    print("Not programmed. Inspect in ST's tool, write all five sectors, verify and cold-cycle.")


if __name__ == "__main__":
    main()
