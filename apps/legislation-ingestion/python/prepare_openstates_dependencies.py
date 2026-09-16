"""Offline, deterministic metadata repair for the pinned upstream dependency bundle."""

import base64
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import tempfile
import tomllib
import zipfile

from prepare_openstates import requirements, verify_prepared

ORIGINAL_SHA256 = "0accd78ec42864e3e3827f9ef798ced9aac4727b664303b724a198fed73fa438"
METADATA = "textract-1.6.5.dist-info/METADATA"
RECORD = "textract-1.6.5.dist-info/RECORD"
CORRECTED_NAME = "textract-1.6.5-1-py3-none-any.whl"
BEFORE = b"Requires-Dist: extract-msg (<=0.29.*)"
AFTER = b"Requires-Dist: extract-msg (<=0.29)"


def corrected_wheel(original):
    if hashlib.sha256(original).hexdigest() != ORIGINAL_SHA256:
        raise ValueError("dependency_source_digest_mismatch")
    with zipfile.ZipFile(io.BytesIO(original)) as archive:
        names = archive.namelist()
        if len(set(names)) != len(names):
            raise ValueError("duplicate_wheel_entry")
        files = {name: archive.read(name) for name in names}
    if files[METADATA].count(BEFORE) != 1:
        raise ValueError("dependency_metadata_target_mismatch")
    files[METADATA] = files[METADATA].replace(BEFORE, AFTER)
    record = io.StringIO(newline="")
    writer = csv.writer(record, lineterminator="\n")
    for name in sorted(files):
        if name != RECORD:
            digest = base64.urlsafe_b64encode(hashlib.sha256(files[name]).digest()).rstrip(b"=").decode()
            writer.writerow([name, "sha256=" + digest, len(files[name])])
    writer.writerow([RECORD, "", ""])
    files[RECORD] = record.getvalue().encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name in sorted(files):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, files[name])
    return output.getvalue()


def prepare_dependencies(inputs, wheel, destination):
    inputs = Path(inputs)
    verify_prepared(inputs)
    original = Path(wheel).read_bytes()
    corrected = corrected_wheel(original)
    digest = hashlib.sha256(corrected).hexdigest()
    exported = (inputs / "requirements.txt").read_text(encoding="utf8")
    pattern = r"textract==1\.6\.5 \\\n(?:    --hash=sha256:[0-9a-f]{64} \\\n)*    --hash=sha256:[0-9a-f]{64}\n"
    replacement = f"./{CORRECTED_NAME} --hash=sha256:{digest}\n"
    exported, count = re.subn(pattern, replacement, exported)
    if count != 1:
        raise ValueError("dependency_requirement_target_mismatch")
    lock = tomllib.loads((inputs / "source/poetry.lock").read_text(encoding="utf8"))
    textract = [entry for entry in lock["package"] if entry["name"] == "textract"]
    if len(textract) != 1 or textract[0]["dependencies"]["extract-msg"] != "<=0.29":
        raise ValueError("dependency_lock_constraint_mismatch")
    bootstrap = requirements({"package": [entry for entry in lock["package"] if entry["name"] == "setuptools"]})
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    payloads = {CORRECTED_NAME: corrected, "original-textract.whl": original,
                "requirements.txt": exported.encode(), "bootstrap.txt": bootstrap.encode()}
    for name, content in payloads.items():
        (destination / name).write_bytes(content)
    manifest = {"repair": "textract-extract-msg-metadata", "original_sha256": ORIGINAL_SHA256,
                "constraint_before": BEFORE.decode(), "constraint_after": AFTER.decode(),
                "executable_code_changed": False, "runtime_verified": False,
                "inputs_manifest_sha256": hashlib.sha256((inputs / "build-inputs.json").read_bytes()).hexdigest(),
                "files": [{"path": name, "sha256": hashlib.sha256(content).hexdigest(), "bytes": len(content)}
                          for name, content in sorted(payloads.items())]}
    (destination / "dependency-inputs.json").write_bytes(json.dumps(manifest, indent=2).encode())
    return manifest


def verify_dependencies(inputs, destination):
    destination = Path(destination)
    if destination.is_symlink():
        raise ValueError("linked_dependency_inputs")
    with tempfile.TemporaryDirectory(prefix="openstates-dependency-verification-") as temporary:
        expected = Path(temporary) / "expected"
        manifest = prepare_dependencies(inputs, destination / "original-textract.whl", expected)
        if {path.name for path in destination.iterdir()} != {path.name for path in expected.iterdir()}:
            raise ValueError("dependency_file_set_mismatch")
        for path in expected.iterdir():
            candidate = destination / path.name
            if candidate.is_symlink() or not candidate.is_file() or candidate.read_bytes() != path.read_bytes():
                raise ValueError("dependency_content_mismatch")
    return {"verified_files": len(manifest["files"]), "runtime_verified": False}


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--verify":
        print(json.dumps(verify_dependencies(sys.argv[2], sys.argv[3])))
        raise SystemExit(0)
    if len(sys.argv) != 4:
        raise SystemExit("usage: prepare_openstates_dependencies.py <verified-inputs> <original-wheel> <new-directory>")
    print(json.dumps(prepare_dependencies(*sys.argv[1:])))
