import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import openstates_cloud_worker as worker
from openstates_runner import REVISION


class Response:
    def __init__(self, status=200, content=b"", value=None):
        self.status_code = status
        self.content = content
        self._value = value

    def json(self):
        return self._value

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"http {self.status_code}")


class CloudWorkerTests(unittest.TestCase):
    def environment(self):
        return {
            "AZURE_STORAGE_ACCOUNT": "legislationtest",
            "AZURE_STATE_SOURCE_CONTAINER": "state-sources",
            "OPENSTATES_SCRAPER_QUEUE": "openstates-scraper-dispatch",
            "IDENTITY_ENDPOINT": "http://identity/token",
            "IDENTITY_HEADER": "header",
            "AZURE_CLIENT_ID": "client",
        }

    def request(self):
        return {
            "jurisdiction": "ak",
            "domain": "events",
            "session": "34",
            "timeout_seconds": 300,
            "revision": REVISION,
            "bill_ids": None,
            "event_keys": ["H:L&C:2025-01-22T13:30:00-09:00"],
        }

    def test_environment_rejects_unsafe_storage_names(self):
        for key, value in (("AZURE_STORAGE_ACCOUNT", "Bad"), ("AZURE_STATE_SOURCE_CONTAINER", "../bad"),
                           ("OPENSTATES_SCRAPER_QUEUE", "bad_queue"), ("IDENTITY_ENDPOINT", "file:///token")):
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "invalid_worker_environment"):
                worker.required_environment(dict(self.environment(), **{key: value}))

    def test_receives_one_strict_base64_message(self):
        payload = base64.b64encode(json.dumps({"run_id": "run-1", "request": self.request()}).encode()).decode()
        xml = ("<QueueMessagesList><QueueMessage><MessageId>id</MessageId><PopReceipt>receipt</PopReceipt>"
               f"<MessageText>{payload}</MessageText></QueueMessage></QueueMessagesList>").encode()
        session = Mock()
        session.get.return_value = Response(content=xml)
        result = worker.receive_message(worker.required_environment(self.environment()), "token", session)
        self.assertEqual(result["run_id"], "run-1")
        self.assertEqual(session.get.call_args.kwargs["params"]["visibilitytimeout"], "1800")

    def test_rejects_message_with_extra_control_fields(self):
        payload = base64.b64encode(json.dumps({"run_id": "run-1", "request": self.request(), "command": "bad"}).encode()).decode()
        xml = f"<QueueMessagesList><QueueMessage><MessageId>id</MessageId><PopReceipt>r</PopReceipt><MessageText>{payload}</MessageText></QueueMessage></QueueMessagesList>".encode()
        session = Mock()
        session.get.return_value = Response(content=xml)
        with self.assertRaisesRegex(ValueError, "invalid_queue_message"):
            worker.receive_message(worker.required_environment(self.environment()), "token", session)

    def test_archives_files_before_completion_manifest_and_is_idempotent(self):
        config = worker.required_environment(self.environment())
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "_data" / "ak" / "event.json"
            path.parent.mkdir(parents=True)
            path.write_bytes(b'{"ok":true}')
            attempt = {
                "status": "extracted", "exit_code": 0, "work_directory": directory, "revision": REVISION,
                "build_inputs_sha256": "a" * 64, "canonical_writes": False, "request": self.request(),
                "reason": None, "files": [{"path": "_data/ak/event.json", "bytes": path.stat().st_size,
                                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}],
                "semantically_validated": False,
            }
            session = Mock()
            session.put.side_effect = [Response(201), Response(201)]
            manifest = worker.archive_attempt(config, "token", "run-1", attempt, session)
            self.assertTrue(manifest.endswith("/run-1/retained.json"))
            calls = session.put.call_args_list
            self.assertIn("/files/_data/ak/event.json", calls[0].args[0])
            self.assertTrue(calls[1].args[0].endswith("/retained.json"))
            retained = json.loads(calls[1].kwargs["data"])
            self.assertNotIn("work_directory", retained["attempt"])
            self.assertEqual(calls[0].kwargs["headers"]["If-None-Match"], "*")

    def test_existing_blob_must_match_exact_bytes(self):
        config = worker.required_environment(self.environment())
        session = Mock()
        session.put.return_value = Response(412)
        session.get.return_value = Response(200, b"different")
        with self.assertRaisesRegex(ValueError, "blob_archive_conflict"):
            worker.put_immutable_blob(config, "token", "path/file.json", b"expected", session)

    @patch("openstates_cloud_worker.execute")
    def test_deletes_message_only_after_archive(self, execute):
        execute.return_value = {"status": "extracted", "reason": None}
        message = {"id": "id", "pop_receipt": "receipt", "run_id": "run-1", "request": self.request()}
        with patch("openstates_cloud_worker.managed_identity_token", return_value="token"), \
             patch("openstates_cloud_worker.receive_message", return_value=message), \
             patch("openstates_cloud_worker.archive_attempt", return_value="manifest") as archive, \
             patch("openstates_cloud_worker.delete_message") as delete, \
             patch("openstates_cloud_worker.write_settlement", return_value="settled") as settle:
            result = worker.run(self.environment(), Mock())
        archive.assert_called_once()
        delete.assert_called_once()
        settle.assert_called_once()
        self.assertEqual(result["status"], "extracted")
        self.assertEqual(result["settlement_path"], "settled")

    def test_settlement_is_written_only_after_queue_acknowledgement(self):
        config = worker.required_environment(self.environment())
        session = Mock()
        session.put.return_value = Response(201)
        path = worker.write_settlement(config, "token", "run-1", "prefix/retained.json", session)
        self.assertEqual(path, "prefix/settled.json")
        body = json.loads(session.put.call_args.kwargs["data"])
        self.assertEqual(body, {"runId": "run-1", "manifestPath": "prefix/retained.json", "queueMessageDeleted": True})


if __name__ == "__main__":
    unittest.main()
