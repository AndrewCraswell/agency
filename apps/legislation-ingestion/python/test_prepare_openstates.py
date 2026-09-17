import tempfile
from contextlib import redirect_stdout
from pathlib import Path
import unittest
import hashlib
import io
import json
import os
import tarfile
from unittest.mock import patch

from prepare_openstates import REVISION, main, prepare, requirements, verify_prepared
from openstates_source_policy import PATCHES


class BuildInputTests(unittest.TestCase):
    def test_help_is_side_effect_free(self):
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as temporary, patch("prepare_openstates.ARCHIVE_URL", "invalid://must-not-open"), redirect_stdout(output):
            previous = Path.cwd()
            try:
                os.chdir(temporary)
                self.assertEqual(main(["--help"]), 0)
                self.assertFalse((Path(temporary) / "--help").exists())
            finally:
                os.chdir(previous)
        self.assertEqual(output.getvalue().strip(), "usage: prepare_openstates.py <new-build-input-directory>")

    def package(self, **changes):
        return dict({"name": "example", "version": "1.2.3", "optional": False, "groups": ["main"],
                     "files": [{"hash": "sha256:" + "a" * 64}]}, **changes)

    def test_exports_hashes_markers_and_only_required_main_packages(self):
        exported = requirements({"package": [self.package(markers={"main": 'sys_platform == "win32"'}),
            self.package(name="ignored", optional=True), self.package(name="development", groups=["dev"])]})
        self.assertIn('example==1.2.3 ; sys_platform == "win32"', exported)
        self.assertIn("--hash=sha256:" + "a" * 64, exported)
        self.assertNotIn("ignored", exported)
        self.assertNotIn("development", exported)
        self.assertNotIn("+    ", exported)

    def test_missing_main_marker_means_unconditional_main(self):
        exported = requirements({"package": [self.package(markers={"dev": 'python_version == "3.9"'})]})
        self.assertNotIn(" ; ", exported)

    def test_rejects_unlocked_or_injected_requirements(self):
        for changes in ({"source": {"type": "git"}}, {"files": []}, {"name": "bad\n--index-url"},
                        {"markers": "\n--index-url"}, {"files": [{"hash": "md5:abc"}]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                requirements({"package": [self.package(**changes)]})

    def test_wrong_source_bytes_never_create_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = Path(temporary) / "build"
            with self.assertRaisesRegex(ValueError, "source_archive_digest_mismatch"):
                prepare(b"untrusted archive", destination)
            self.assertFalse(destination.exists())

    def archive(self):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as archive:
            contents = {"poetry.lock": b"package = []\n", "LICENSE": b"fixture license\n",
                               "a.txt": b"a", "B.txt": b"b",
                               "scrapers/nc/__init__.py": b"# fixture\n"}
            contents.update({name: "\n".join(before for before, _ in patches).encode("utf8")
                             for name, patches in PATCHES.items()})
            for name, body in contents.items():
                entry = tarfile.TarInfo(f"openstates-scrapers-{REVISION}/{name}")
                entry.size = len(body)
                archive.addfile(entry, io.BytesIO(body))
        return stream.getvalue()

    def test_replay_verification_and_platform_independent_generated_bytes(self):
        archive = self.archive()
        with tempfile.TemporaryDirectory() as temporary, patch("prepare_openstates.ARCHIVE_SHA256", hashlib.sha256(archive).hexdigest()):
            destination = Path(temporary) / "build"
            manifest = prepare(archive, destination)
            paths = [entry["path"] for entry in manifest["files"]]
            self.assertEqual(paths, sorted(paths))
            result = verify_prepared(destination)
            self.assertEqual(result["verified_files"], len(manifest["files"]))
            self.assertFalse(result["runtime_verified"])
            for name in ("requirements.txt", "source/UPSTREAM_REVISION", "build-inputs.json"):
                self.assertNotIn(b"\r", (destination / name).read_bytes())
            with self.assertRaises(FileExistsError):
                prepare(archive, destination)

    def test_rejects_missing_extra_modified_and_reblessed_files(self):
        archive = self.archive()
        for mutation in ("missing", "extra", "modified", "reblessed", "manifest", "archive"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary, patch("prepare_openstates.ARCHIVE_SHA256", hashlib.sha256(archive).hexdigest()):
                destination = Path(temporary) / "build"
                manifest = prepare(archive, destination)
                source = destination / "source/scrapers/nc/__init__.py"
                if mutation == "missing":
                    source.unlink()
                elif mutation == "extra":
                    (destination / "extra.py").write_text("unapproved")
                elif mutation in ("modified", "reblessed"):
                    source.write_bytes(b"changed source")
                    if mutation == "reblessed":
                        for entry in manifest["files"]:
                            if entry["path"] == "source/scrapers/nc/__init__.py":
                                entry.update(bytes=source.stat().st_size, sha256=hashlib.sha256(source.read_bytes()).hexdigest())
                        (destination / "build-inputs.json").write_text(json.dumps(manifest))
                elif mutation == "archive":
                    (destination / "upstream.tar.gz").write_bytes(b"wrong archive")
                else:
                    manifest["runtime_verified"] = True
                    (destination / "build-inputs.json").write_text(json.dumps(manifest))
                with self.assertRaises(ValueError):
                    verify_prepared(destination)

    @unittest.skipUnless(os.name == "posix", "Linux links")
    def test_rejects_linked_build_files(self):
        archive = self.archive()
        with tempfile.TemporaryDirectory() as temporary, patch("prepare_openstates.ARCHIVE_SHA256", hashlib.sha256(archive).hexdigest()):
            destination = Path(temporary) / "build"
            prepare(archive, destination)
            link = destination / "source/LICENSE"
            link.unlink()
            link.symlink_to(destination / "source/poetry.lock")
            with self.assertRaisesRegex(ValueError, "linked_build_input"):
                verify_prepared(destination)
