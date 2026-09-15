import base64
import csv
import hashlib
import io
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from prepare_openstates_dependencies import AFTER, BEFORE, METADATA, RECORD, corrected_wheel, prepare_dependencies, verify_dependencies


class DependencyRepairTests(unittest.TestCase):
    def wheel(self, metadata=BEFORE):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr(METADATA, metadata + b"\n")
            archive.writestr(RECORD, b"old record\n")
            archive.writestr("textract/__init__.py", b"# executable fixture\n")
            archive.writestr("textract-1.6.5.dist-info/LICENSE", b"retained license\n")
        return output.getvalue()

    def test_repair_is_deterministic_and_preserves_code_and_license(self):
        original = self.wheel()
        with patch("prepare_openstates_dependencies.ORIGINAL_SHA256", hashlib.sha256(original).hexdigest()):
            repaired = corrected_wheel(original)
            self.assertEqual(repaired, corrected_wheel(original))
        with zipfile.ZipFile(io.BytesIO(original)) as before, zipfile.ZipFile(io.BytesIO(repaired)) as after:
            self.assertEqual(set(before.namelist()), set(after.namelist()))
            for name in before.namelist():
                if name not in (METADATA, RECORD):
                    self.assertEqual(before.read(name), after.read(name))
            self.assertEqual(after.read(METADATA), AFTER + b"\n")
            for name, digest, size in csv.reader(io.StringIO(after.read(RECORD).decode())):
                if name == RECORD:
                    self.assertEqual((digest, size), ("", ""))
                else:
                    content = after.read(name)
                    self.assertEqual(int(size), len(content))
                    self.assertEqual(digest, "sha256=" + base64.urlsafe_b64encode(hashlib.sha256(content).digest()).rstrip(b"=").decode())

    def test_untrusted_original_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "dependency_source_digest_mismatch"):
            corrected_wheel(self.wheel())

    def test_metadata_drift_fails_closed(self):
        for value in (AFTER, BEFORE + b"\n" + BEFORE):
            original = self.wheel(value)
            with patch("prepare_openstates_dependencies.ORIGINAL_SHA256", hashlib.sha256(original).hexdigest()):
                with self.assertRaisesRegex(ValueError, "dependency_metadata_target_mismatch"):
                    corrected_wheel(original)

    def test_bundle_replay_rejects_tampering(self):
        original = self.wheel()
        with tempfile.TemporaryDirectory() as temporary, patch("prepare_openstates_dependencies.verify_prepared"), patch("prepare_openstates_dependencies.ORIGINAL_SHA256", hashlib.sha256(original).hexdigest()):
            root = Path(temporary)
            inputs = root / "inputs"
            (inputs / "source").mkdir(parents=True)
            (inputs / "build-inputs.json").write_bytes(b"{}")
            (inputs / "requirements.txt").write_text("textract==1.6.5 \\\n    --hash=sha256:" + "a" * 64 + "\n", encoding="utf8")
            (inputs / "source/poetry.lock").write_text('''[[package]]
name = "textract"
[package.dependencies]
extract-msg = "<=0.29"
[[package]]
name = "setuptools"
version = "75.6.0"
groups = ["main"]
files = [{hash = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]
''', encoding="utf8")
            wheel = root / "original.whl"
            wheel.write_bytes(original)
            output = root / "output"
            prepare_dependencies(inputs, wheel, output)
            self.assertEqual(verify_dependencies(inputs, output)["verified_files"], 4)
            with self.assertRaises(FileExistsError):
                prepare_dependencies(inputs, wheel, output)
            (output / "requirements.txt").write_text("unapproved", encoding="utf8")
            with self.assertRaisesRegex(ValueError, "dependency_content_mismatch"):
                verify_dependencies(inputs, output)
