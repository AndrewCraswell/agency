import unittest
import os
import hashlib
from pathlib import Path
import tempfile
from unittest.mock import patch
from openstates_runner import REVISION, child_environment, command, execute, failure_reason, output_inventory, validate_request


class RunnerContractTests(unittest.TestCase):
    def test_alaska_events_require_bounded_explicit_occurrences(self):
        key = "H:L&C:2025-01-22T13:30:00-09:00"
        value = self.request(jurisdiction="ak", domain="events", session="34", bill_ids=None, event_keys=[key])
        self.assertEqual(command(value)[-2:], ["session=34", "event_keys=" + key])
        for keys in ([], [key, key], ["bad"], [key] * 11):
            with self.assertRaisesRegex(ValueError, "invalid_event_batch"):
                validate_request(dict(value, event_keys=keys))
        with self.assertRaisesRegex(ValueError, "unexpected_event_keys"):
            validate_request(self.request(event_keys=[key]))
    def test_alaska_uses_explicit_profile_without_enabling_events(self):
        request = self.request(jurisdiction="ak", session="34", bill_ids=["HB10", "HB2"])
        self.assertEqual(command(request)[3], "ak")
        self.assertEqual(command(request)[-2:], ["session=34", "bill_ids=HB2,HB10"])
        for changes in ({"session": "2025"}, {"bill_ids": ["H1"]}, {"bill_ids": ["HB1", "SB1"]},
                        {"domain": "events", "session": None, "bill_ids": None}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_request(dict(request, **changes))

    def request(self, **changes):
        return dict({"jurisdiction": "nc", "domain": "bills", "session": "2025",
                     "timeout_seconds": 1200, "revision": REVISION, "bill_ids": ["S1"]}, **changes)

    def test_extraction_only_explicit_session(self):
        args = command(self.request())
        self.assertIn("--scrape", args)
        self.assertNotIn("--import", args)
        self.assertNotIn("--fastmode", args)
        self.assertEqual(args[-2:], ["session=2025", "bill_ids=S1"])

    def test_rejects_extra_flags_and_unbounded_runtime(self):
        for changes in ({"args": ["--import"]}, {"timeout_seconds": 1501}, {"timeout_seconds": True},
                        {"session": "2025 --import"}, {"session": "2025E1"}, {"session": "2023"},
                        {"jurisdiction": "ca"}, {"revision": "main"}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                validate_request(self.request(**changes))

    def test_events_do_not_claim_historical_window(self):
        self.assertEqual(command(self.request(domain="events", session=None, bill_ids=None))[-1], "events")
        with self.assertRaises(ValueError):
            command(self.request(domain="events"))

    def test_bill_batches_are_bounded_unique_single_chamber_and_deterministic(self):
        for ids in (None, [], ["S1", "S1"], ["H1", "S1"], ["S01"], ["S1 --import"], [1],
                    ["S" + str(number) for number in range(1, 12)]):
            with self.subTest(ids=ids), self.assertRaises(ValueError):
                command(self.request(bill_ids=ids))
        self.assertEqual(command(self.request(bill_ids=["H10", "H2"]))[-1], "bill_ids=H2,H10")
        with self.assertRaises(ValueError):
            command(self.request(domain="events", session=None))

    def test_secret_and_upload_configuration_is_not_inherited(self):
        env = child_environment(".", {"PATH": "bin", "DATABASE_URL": "secret", "AWS_SECRET_ACCESS_KEY": "secret",
                                      "BUCKET_NAME": "production", "TRIGGER_SECRET_KEY": "secret",
                                      "S3_REALTIME_BASE": "production", "PYTHONPATH": "untrusted"})
        self.assertEqual(set(env), {"PATH", "PYTHONPATH", "PYTHONUNBUFFERED", "PYTHONDONTWRITEBYTECODE", "VERIFY_CERTS"})
        self.assertNotIn("untrusted", env.values())

    def test_safe_failure_classification_never_returns_diagnostics(self):
        self.assertEqual(failure_reason([b"requests.exceptions.ReadTimeout: secret url"]), "source_timeout")
        self.assertEqual(failure_reason([b"requests.exceptions.SSLError: secret certificate"]), "source_tls_failure")
        for exception in ("ConnectionError", "ChunkedEncodingError", "ContentDecodingError"):
            self.assertEqual(failure_reason([f"requests.exceptions.{exception}: private-url".encode()]), "source_network_failure")
        self.assertEqual(failure_reason([b"RuntimeError: requests.exceptions.ConnectionError: private-url"]), "subprocess_failure")
        self.assertEqual(failure_reason([b"RuntimeError: requests.exceptions.ReadTimeout: secret"]), "subprocess_failure")
        self.assertEqual(failure_reason([b"\xff"]), "subprocess_failure")
        for code, expected in ((429, "source_http_rate_limited"), (403, "source_http_access_denied"),
                               (404, "source_http_not_found"), (503, "source_http_server_error")):
            self.assertEqual(failure_reason([f"scrapelib.HTTPError: {code} while retrieving secret-url".encode()]), expected)
        self.assertEqual(failure_reason([b"scrapelib.HTTPError: unknown body includes 403"]), "source_http_failure")

    @unittest.skipUnless(os.name == "posix", "Linux subprocess boundary")
    def test_real_child_success_failure_and_timeout(self):
        for body, status in [("from pathlib import Path; p=Path('_data/nc'); p.mkdir(parents=True); (p/'bill.json').write_text('{}')", "extracted"),
                             ("print('no output')", "rejected"),
                             ("raise SystemExit(7)", "failed"),
                             ("import sys; sys.stderr.write('secret' * 20000 + '\\nrequests.exceptions.ReadTimeout: secret\\n'); raise SystemExit(1)", "failed"),
                             ("import time; time.sleep(60)", "timed_out")]:
            with self.subTest(status=status), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = root / "source"
                package = source / "scrapers" / "openstates" / "cli"
                package.mkdir(parents=True)
                (source / "UPSTREAM_REVISION").write_text(REVISION)
                (package.parent / "__init__.py").write_text("")
                (package / "__init__.py").write_text("")
                (package / "update.py").write_text(body)
                (root / "build-inputs.json").write_bytes(b"fixture-build")
                with patch("prepare_openstates.verify_prepared") as verify:
                    result = execute(self.request(timeout_seconds=1), source, root)
                verify.assert_called_once_with(root)
                self.assertEqual(result["build_inputs_sha256"], hashlib.sha256(b"fixture-build").hexdigest())
                self.assertEqual(result["status"], status)
                self.assertFalse(result["canonical_writes"])
                self.assertFalse(result["semantically_validated"])
                self.assertNotIn("secret", (Path(result["work_directory"]) / "attempt.json").read_text())
                if "ReadTimeout" in body:
                    self.assertEqual(result["reason"], "source_timeout")
                self.assertTrue((Path(result["work_directory"]) / "attempt.json").exists())

    def test_inventory_hashes_bytes_and_rejects_wrong_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            directory = work / "_data" / "nc"
            directory.mkdir(parents=True)
            (directory / "bill.json").write_bytes(b"{}")
            self.assertEqual(output_inventory(work), [{"path": "_data/nc/bill.json", "bytes": 2,
                "sha256": "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"}])
            (directory / "unapproved.txt").write_text("no")
            with self.assertRaisesRegex(ValueError, "unexpected_output"):
                output_inventory(work)

    @unittest.skipUnless(os.name == "posix", "Linux subprocess boundary")
    def test_start_failure_is_retained_and_redacted(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            source = source / "source"
            source.mkdir()
            (source / "UPSTREAM_REVISION").write_text(REVISION)
            (source.parent / "build-inputs.json").write_bytes(b"fixture-build")
            with patch("prepare_openstates.verify_prepared"), patch("openstates_runner.subprocess.Popen", side_effect=OSError("secret diagnostic")):
                result = execute(self.request(), source, source)
            self.assertEqual(result["status"], "failed")
            self.assertEqual(result["reason"], "process_start_or_wait_failed")
            evidence = (Path(result["work_directory"]) / "attempt.json").read_text()
            self.assertNotIn("secret diagnostic", evidence)

    @unittest.skipUnless(os.name == "posix", "Linux subprocess boundary")
    def test_unverified_build_cannot_start_child(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            (source / "UPSTREAM_REVISION").write_text(REVISION)
            with patch("prepare_openstates.verify_prepared", side_effect=ValueError("build_input_content_mismatch")), patch("openstates_runner.subprocess.Popen") as child:
                with self.assertRaisesRegex(ValueError, "build_input_content_mismatch"):
                    execute(self.request(), source, source)
            child.assert_not_called()

    @unittest.skipUnless(os.name == "posix", "Linux links")
    def test_inventory_rejects_linked_root_directory_and_file(self):
        for level in ("root", "directory", "file"):
            with self.subTest(level=level), tempfile.TemporaryDirectory() as temporary:
                work = Path(temporary)
                outside = work / "outside"
                outside.mkdir()
                (outside / "bill.json").write_text("{}")
                if level == "root":
                    (work / "_data").symlink_to(outside, target_is_directory=True)
                else:
                    (work / "_data").mkdir()
                    if level == "directory":
                        (work / "_data" / "nc").symlink_to(outside, target_is_directory=True)
                    else:
                        (work / "_data" / "nc").mkdir()
                        (work / "_data" / "nc" / "bill.json").symlink_to(outside / "bill.json")
                with self.assertRaisesRegex(ValueError, "linked_output"):
                    output_inventory(work)

    @unittest.skipUnless(os.name == "posix", "Upstream colon filenames require Linux")
    def test_jurisdiction_filename_is_portable_without_changing_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            work = Path(temporary)
            data = work / "_data/nc"
            data.mkdir(parents=True)
            native = data / "jurisdiction_ocd-jurisdiction-country:us-state:nc-government.json"
            native.write_bytes(b'{"id":"ocd-jurisdiction/country:us/state:nc/government"}')
            inventory = output_inventory(work)
            self.assertEqual(inventory[0]["path"], "_data/nc/jurisdiction_nc.json")
            self.assertFalse(native.exists())
            self.assertEqual((data / "jurisdiction_nc.json").read_bytes(), b'{"id":"ocd-jurisdiction/country:us/state:nc/government"}')
            native.write_bytes(b"different")
            with self.assertRaisesRegex(ValueError, "unexpected_output"):
                output_inventory(work)


if __name__ == "__main__":
    unittest.main()
