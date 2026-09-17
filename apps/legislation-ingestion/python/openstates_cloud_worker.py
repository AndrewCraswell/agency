"""Azure Queue worker for the isolated Open States extraction image.

The worker has no database credentials and performs no canonical writes. It claims
one immutable queue message, runs the existing bounded extraction adapter, writes
checksum-verified evidence to Blob Storage, and only then deletes the message.
"""

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote
import xml.etree.ElementTree as ET

import requests

from openstates_runner import REVISION, execute, validate_request


API_VERSION = "2023-11-03"
RUN_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9-]{0,100}$")
ACCOUNT = re.compile(r"^[a-z0-9]{3,24}$")
CONTAINER = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$")
QUEUE = CONTAINER


def required_environment(environment=os.environ):
    values = {
        "account": environment.get("AZURE_STORAGE_ACCOUNT", ""),
        "container": environment.get("AZURE_STATE_SOURCE_CONTAINER", ""),
        "queue": environment.get("OPENSTATES_SCRAPER_QUEUE", ""),
        "identity_endpoint": environment.get("IDENTITY_ENDPOINT", ""),
        "identity_header": environment.get("IDENTITY_HEADER", ""),
        "client_id": environment.get("AZURE_CLIENT_ID", ""),
    }
    if (not ACCOUNT.fullmatch(values["account"]) or not CONTAINER.fullmatch(values["container"])
            or not QUEUE.fullmatch(values["queue"]) or not values["identity_endpoint"].startswith("http")
            or not values["identity_header"] or not values["client_id"]):
        raise ValueError("invalid_worker_environment")
    return values


def managed_identity_token(config, session=requests):
    response = session.get(
        config["identity_endpoint"],
        params={
            "api-version": "2019-08-01",
            "resource": "https://storage.azure.com/",
            "client_id": config["client_id"],
        },
        headers={"X-IDENTITY-HEADER": config["identity_header"]},
        timeout=(10, 30),
    )
    response.raise_for_status()
    value = response.json()
    token = value.get("access_token") if isinstance(value, dict) else None
    if not isinstance(token, str) or not token:
        raise ValueError("invalid_identity_response")
    return token


def headers(token, **extra):
    return {
        "Authorization": "Bearer " + token,
        "x-ms-version": API_VERSION,
        **extra,
    }


def queue_url(config):
    return f"https://{config['account']}.queue.core.windows.net/{config['queue']}"


def receive_message(config, token, session=requests):
    response = session.get(
        queue_url(config) + "/messages",
        params={"numofmessages": "1", "visibilitytimeout": "1800"},
        headers=headers(token),
        timeout=(10, 30),
    )
    response.raise_for_status()
    root = ET.fromstring(response.content)
    message = root.find("QueueMessage")
    if message is None:
        return None
    fields = {child.tag: child.text or "" for child in message}
    try:
        payload = json.loads(base64.b64decode(fields["MessageText"], validate=True).decode("utf8"))
    except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("invalid_queue_message") from error
    run_id = payload.get("run_id") if isinstance(payload, dict) else None
    request = payload.get("request") if isinstance(payload, dict) else None
    if set(payload) != {"run_id", "request"} or not isinstance(run_id, str) or not RUN_ID.fullmatch(run_id):
        raise ValueError("invalid_queue_message")
    validate_request(request)
    return {
        "id": fields["MessageId"],
        "pop_receipt": fields["PopReceipt"],
        "run_id": run_id,
        "request": request,
    }


def blob_url(config, path):
    encoded = "/".join(quote(part, safe="") for part in path.split("/"))
    return f"https://{config['account']}.blob.core.windows.net/{config['container']}/{encoded}"


def put_immutable_blob(config, token, path, content, session=requests):
    response = session.put(
        blob_url(config, path),
        data=content,
        headers=headers(token, **{"x-ms-blob-type": "BlockBlob", "If-None-Match": "*"}),
        timeout=(10, 120),
    )
    if response.status_code in (201, 202):
        return
    if response.status_code != 412:
        response.raise_for_status()
    existing = session.get(blob_url(config, path), headers=headers(token), timeout=(10, 120))
    existing.raise_for_status()
    if existing.content != content:
        raise ValueError("blob_archive_conflict")


def archive_attempt(config, token, run_id, attempt, session=requests):
    work = Path(attempt["work_directory"])
    retained = {key: value for key, value in attempt.items() if key != "work_directory"}
    prefix = f"openstates/scrapers/{REVISION}/{attempt['request']['jurisdiction']}/{attempt['request']['domain']}/{run_id}"
    for entry in attempt["files"]:
        content = (work / entry["path"]).read_bytes()
        if len(content) != entry["bytes"] or hashlib.sha256(content).hexdigest() != entry["sha256"]:
            raise ValueError("local_artifact_checksum_mismatch")
        put_immutable_blob(config, token, f"{prefix}/files/{entry['path']}", content, session)
    manifest = json.dumps({"runId": run_id, "attempt": retained}, separators=(",", ":")).encode("utf8")
    put_immutable_blob(config, token, f"{prefix}/retained.json", manifest, session)
    return f"{prefix}/retained.json"


def delete_message(config, token, message, session=requests):
    response = session.delete(
        queue_url(config) + "/messages/" + quote(message["id"], safe=""),
        params={"popreceipt": message["pop_receipt"]},
        headers=headers(token),
        timeout=(10, 30),
    )
    response.raise_for_status()


def write_settlement(config, token, run_id, manifest_path, session=requests):
    prefix = manifest_path.removesuffix("retained.json")
    content = json.dumps(
        {"runId": run_id, "manifestPath": manifest_path, "queueMessageDeleted": True},
        separators=(",", ":"),
    ).encode("utf8")
    put_immutable_blob(config, token, prefix + "settled.json", content, session)
    return prefix + "settled.json"


def run(environment=os.environ, session=requests):
    config = required_environment(environment)
    token = managed_identity_token(config, session)
    message = receive_message(config, token, session)
    if message is None:
        return {"status": "idle", "canonical_writes": False}
    attempt = execute(message["request"], "/opt/openstates/inputs/source", "/tmp")
    manifest_path = archive_attempt(config, token, message["run_id"], attempt, session)
    delete_message(config, token, message, session)
    settlement_path = write_settlement(config, token, message["run_id"], manifest_path, session)
    return {
        "status": attempt["status"],
        "reason": attempt["reason"],
        "run_id": message["run_id"],
        "manifest_path": manifest_path,
        "settlement_path": settlement_path,
        "canonical_writes": False,
    }


if __name__ == "__main__":
    try:
        result = run()
        print(json.dumps(result, separators=(",", ":")))
        sys.exit(0 if result["status"] in ("idle", "extracted") else 1)
    except Exception:
        print(json.dumps({"status": "failed", "reason": "cloud_worker_rejected", "canonical_writes": False}))
        sys.exit(1)
