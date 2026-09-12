"""Tests for the actual factory-programming byte transformation, not its prose."""

import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "power_profile", Path(__file__).with_name("prepare-power-profile.py")
)
power_profile = importlib.util.module_from_spec(spec)
spec.loader.exec_module(power_profile)


class PowerProfileTests(unittest.TestCase):
    def test_profile_decodes_to_standalone_contract(self):
        result = power_profile.prepare_profile(bytes(range(40)))
        self.assertEqual((result[26] >> 1) & 3, 2)
        self.assertEqual(result[26] >> 4, 1)  # 0.5A current code
        self.assertEqual(result[26] & 9, 0)  # external power / USB communications
        self.assertEqual(result[28] & 15, 11)  # 3A current code
        self.assertEqual((result[33] << 2) | (result[32] >> 6), 400)
        self.assertEqual((result[36] >> 5) & 3, 2)
        self.assertEqual((result[38] >> 3) & 3, 1)

    def test_unrelated_and_reserved_bits_are_preserved(self):
        masks = {26: 0xFF, 28: 0x0F, 32: 0xC0, 33: 0xFF, 36: 0x60, 38: 0x18}
        for fill in range(256):
            original = bytes((fill + i) % 256 for i in range(40))
            result = power_profile.prepare_profile(original)
            for i in range(40):
                self.assertEqual((result[i] ^ original[i]) & ~masks.get(i, 0), 0)
            self.assertEqual(power_profile.prepare_profile(result), result)

    def test_rejects_truncated_oversized_and_blank_reads(self):
        for original in (b"", bytes(39), bytes(41), bytes(40), bytes([255]) * 40):
            with self.subTest(length=len(original)):
                with self.assertRaises(ValueError):
                    power_profile.prepare_profile(original)

    def test_cli_writes_exact_bytes_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "readback.bin"
            output = Path(directory) / "prepared.bin"
            original = bytes(range(40))
            source.write_bytes(original)
            command = [sys.executable, power_profile.__file__, str(source), str(output)]
            first = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(first.returncode, 0, first.stderr)
            self.assertEqual(output.read_bytes(), power_profile.prepare_profile(original))
            self.assertIn("Not programmed", first.stdout)
            second = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(second.returncode, 0)
            same_file = subprocess.run(command[:-1] + [str(source)], capture_output=True, text=True)
            self.assertNotEqual(same_file.returncode, 0)
            self.assertEqual(source.read_bytes(), original)
            self.assertEqual(output.read_bytes(), power_profile.prepare_profile(original))


if __name__ == "__main__":
    unittest.main()
