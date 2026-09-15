"""Extraction boundary. No canonical DB or cloud-storage credentials enter the child."""

import json
import hashlib
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import threading
from collections import deque

REVISION = "d43f853796ceeeb49205f7d144790647764ce105"
PROFILES = {
    "nc": {"session": "2025", "bill_pattern": r"[HS][1-9][0-9]{0,4}", "domains": ("bills", "events")},
    "ak": {"session": "34", "bill_pattern": r"[HS](?:B|R|JR|J|CR|SC|SCR)[1-9][0-9]{0,4}", "domains": ("bills",)},
}


def failure_reason(chunks):
    # Inspect only the exception line, not arbitrary source bodies or embedded messages.
    text = b"".join(chunks).decode("utf8", errors="replace")
    categories = {
        "requests.exceptions.ReadTimeout": "source_timeout",
        "requests.exceptions.ConnectTimeout": "source_timeout",
        "requests.exceptions.SSLError": "source_tls_failure",
        "requests.exceptions.HTTPError": "source_http_failure",
        "scrapelib.HTTPError": "source_http_failure",
        "lxml.etree.XMLSyntaxError": "source_parse_failure",
        "lxml.etree.ParserError": "source_parse_failure",
        "jsonschema.exceptions.ValidationError": "source_validation_failure",
    }
    for line in reversed(text.splitlines()):
        exception = line.partition(":")[0]
        if exception in categories:
            if categories[exception] == "source_http_failure":
                status = re.match(r"\s*([45][0-9]{2})\b", line.partition(":")[2])
                if status:
                    code = int(status.group(1))
                    if code == 429:
                        return "source_http_rate_limited"
                    if code in (401, 403):
                        return "source_http_access_denied"
                    if code == 404:
                        return "source_http_not_found"
                    if code >= 500:
                        return "source_http_server_error"
            return categories[exception]
    return "subprocess_failure"


def drain_errors(stream, chunks):
    with stream:
        for chunk in iter(lambda: stream.read(4096), b""):
            chunks.append(chunk)


def output_inventory(work, jurisdiction="nc"):
    """Inventory bytes for durable upload, not a semantic acceptance or promotion."""
    data = work / "_data"
    if data.is_symlink():
        raise ValueError("linked_output")
    if not data.exists():
        raise ValueError("missing_output")
    # Upstream jurisdiction filenames contain colons, which are not portable to Windows.
    # Only configured jurisdictions can choose a directory; payload identifiers remain unchanged.
    if jurisdiction not in PROFILES:
        raise ValueError("unsupported_lane")
    native = data / jurisdiction / f"jurisdiction_ocd-jurisdiction-country:us-state:{jurisdiction}-government.json"
    portable = data / jurisdiction / f"jurisdiction_{jurisdiction}.json"
    if native.is_symlink() or portable.is_symlink() or (data / jurisdiction).is_symlink():
        raise ValueError("linked_output")
    if native.exists():
        if portable.exists():
            raise ValueError("unexpected_output")
        native.rename(portable)
    files = []
    total = 0
    # Do not follow links supplied by a subprocess, including directory links.
    def reject_walk_error(error):
        raise error
    for directory, directories, names in os.walk(data, onerror=reject_walk_error, followlinks=False):
        for name in directories + names:
            path = Path(directory) / name
            if path.is_symlink():
                raise ValueError("linked_output")
        for name in sorted(names):
            path = Path(directory) / name
            relative = path.relative_to(work).as_posix()
            if path.parent != data / jurisdiction or not re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*\.json", path.name) or not path.is_file():
                raise ValueError("unexpected_output")
            digest = hashlib.sha256()
            size = 0
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    size += len(chunk)
                    total += len(chunk)
                    if size > 64 * 1024 * 1024 or total > 2 * 1024 * 1024 * 1024:
                        raise ValueError("output_size_limit")
                    digest.update(chunk)
            files.append({"path": relative, "bytes": size, "sha256": digest.hexdigest()})
            if len(files) > 100_000:
                raise ValueError("output_file_limit")
    if not files:
        raise ValueError("missing_output")
    return sorted(files, key=lambda entry: entry["path"])


def validate_request(value):
    if not isinstance(value, dict) or set(value) != {"jurisdiction", "domain", "session", "timeout_seconds", "revision", "bill_ids"}:
        raise ValueError("invalid_request_fields")
    profile = PROFILES.get(value["jurisdiction"]) if isinstance(value["jurisdiction"], str) else None
    if not profile or value["domain"] not in profile["domains"]:
        raise ValueError("unsupported_lane")
    if value["revision"] != REVISION:
        raise ValueError("revision_mismatch")
    timeout = value["timeout_seconds"]
    if type(timeout) is not int or not 1 <= timeout <= 1500:
        raise ValueError("invalid_timeout")
    if value["domain"] == "bills":
        if value["session"] != profile["session"]:
            raise ValueError("invalid_session")
        ids = value["bill_ids"]
        if (not isinstance(ids, list) or not 1 <= len(ids) <= 10
                or any(not isinstance(item, str) or not re.fullmatch(profile["bill_pattern"], item) for item in ids)
                or len(set(ids)) != len(ids) or len({item[0] for item in ids}) != 1):
            raise ValueError("invalid_bill_batch")
    elif value["session"] is not None:
        raise ValueError("events_have_no_historical_session_parameter")
    elif value["bill_ids"] is not None:
        raise ValueError("events_have_no_bill_batch")
    return value


def command(request):
    validate_request(request)
    args = [sys.executable, "-m", "openstates.cli.update", request["jurisdiction"], "--scrape", request["domain"]]
    if request["domain"] == "bills":
        args.append("session=" + request["session"])
        args.append("bill_ids=" + ",".join(sorted(request["bill_ids"], key=lambda item: (item[0], int(re.search(r"[0-9]+$", item).group())))))
    return args


def child_environment(source_root, parent):
    # An allowlist deliberately excludes DB, Azure, Trigger, GCP, AWS, proxy and API secrets.
    allowed = {key: parent[key] for key in ("PATH", "SYSTEMROOT", "WINDIR", "LANG", "LC_ALL") if key in parent}
    allowed.update({"PYTHONPATH": str(Path(source_root).resolve() / "scrapers"),
                    "PYTHONUNBUFFERED": "1", "PYTHONDONTWRITEBYTECODE": "1", "VERIFY_CERTS": "True"})
    return allowed


def execute(request, source_root, staging_root):
    validate_request(request)
    if os.name != "posix":
        raise ValueError("linux_runtime_required")
    source = Path(source_root).resolve(strict=True)
    # Build tooling must stamp the exact checked-out revision; no runtime clone or mutable ref.
    if (source / "UPSTREAM_REVISION").read_text().strip() != REVISION:
        raise ValueError("build_revision_mismatch")
    # Reconstruct from the pinned upstream archive and current exact source policy.
    # A revision stamp alone cannot distinguish corrected code from older builds.
    from prepare_openstates import verify_prepared
    verify_prepared(source.parent)
    build_inputs_sha256 = hashlib.sha256((source.parent / "build-inputs.json").read_bytes()).hexdigest()
    staging = Path(staging_root).resolve(strict=True)
    work = Path(tempfile.mkdtemp(prefix=f"openstates-{request['jurisdiction']}-", dir=staging))
    # Upstream output can contain source bodies or URLs. Never forward it to task logs.
    process = None
    code = None
    reason = None
    files = []
    errors = deque(maxlen=16)
    error_reader = None
    try:
        with open(os.devnull, "wb") as sink:
            process = subprocess.Popen(command(request), cwd=work, env=child_environment(source, os.environ),
                                       stdout=sink, stderr=subprocess.PIPE, start_new_session=True)
            error_reader = threading.Thread(target=drain_errors, args=(process.stderr, errors), daemon=True)
            error_reader.start()
            code = process.wait(timeout=request["timeout_seconds"])
            status = "extracted" if code == 0 else "failed"
    except subprocess.TimeoutExpired:
        status = "timed_out"
        reason = "execution_deadline"
    except OSError:
        status = "failed"
        reason = "process_start_or_wait_failed"
    finally:
        if process is not None:
            # Also remove descendants that outlived their parent. Each attempt has a private session.
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
        if error_reader is not None:
            error_reader.join(timeout=2)
    if status == "failed" and reason is None:
        reason = failure_reason(list(errors))
    try:
        files = output_inventory(work, request["jurisdiction"])
    except (OSError, ValueError) as error:
        if status == "extracted":
            status = "rejected"
            reason = str(error) if isinstance(error, ValueError) else "output_unreadable"
    result = {"status": status, "exit_code": code, "work_directory": str(work),
              "revision": REVISION, "build_inputs_sha256": build_inputs_sha256,
              "canonical_writes": False, "request": request,
              "reason": reason, "files": files, "semantically_validated": False}
    (work / "attempt.json").write_text(json.dumps(result), encoding="utf8")
    # Caller must archive and validate the files before cleanup or canonical promotion.
    return result


if __name__ == "__main__":
    try:
        if len(sys.argv) != 4:
            raise ValueError("invalid_arguments")
        result = execute(json.loads(sys.argv[1]), sys.argv[2], sys.argv[3])
        print(json.dumps({key: value for key, value in result.items() if key != "files"}))
        sys.exit(0 if result["status"] == "extracted" else 1)
    except Exception:
        print(json.dumps({"status": "failed", "reason": "runner_rejected", "canonical_writes": False}))
        sys.exit(1)
