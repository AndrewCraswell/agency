"""Prepare immutable build inputs, never run by a scheduled extraction task."""

import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile
import tempfile
import tomllib
from urllib.request import urlopen

from openstates_runner import REVISION
from openstates_source_policy import harden_source

ARCHIVE_SHA256 = "df5e199a0d89b425fd12c68855f4e4bbc8d9906079f74ce5f5a12b774367f51e"
ARCHIVE_URL = f"https://codeload.github.com/openstates/openstates-scrapers/tar.gz/{REVISION}"


def requirements(lock):
    """Export main, non-optional locked packages; pip enforces hashes and dependency closure."""
    lines = ["# Generated from the retained upstream poetry.lock. Do not edit."]
    for package in lock["package"]:
        if package.get("optional") or "main" not in package["groups"]:
            continue
        if "source" in package:
            raise ValueError("non_registry_dependency")
        name, version = package["name"], package["version"]
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", name) or not re.fullmatch(r"[A-Za-z0-9_.+!-]+", version):
            raise ValueError("invalid_dependency")
        marker = package.get("markers")
        if isinstance(marker, dict):
            marker = marker.get("main")
        if marker is not None and (not isinstance(marker, str) or "\n" in marker or "\r" in marker):
            raise ValueError("unsupported_marker")
        hashes = sorted({file["hash"] for file in package["files"]})
        if not hashes or any(not re.fullmatch(r"sha256:[0-9a-f]{64}", value) for value in hashes):
            raise ValueError("unhashed_dependency")
        requirement = name + "==" + version + (" ; " + marker if marker else "")
        continuation = " " + chr(92) + "\n    "
        lines.append(requirement + continuation + continuation.join("--hash=" + value for value in hashes))
    return "\n".join(lines) + "\n"


def prepare(archive, destination):
    if hashlib.sha256(archive).hexdigest() != ARCHIVE_SHA256:
        raise ValueError("source_archive_digest_mismatch")
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    source = destination / "source"
    source.mkdir()
    (destination / "upstream.tar.gz").write_bytes(archive)
    root = f"openstates-scrapers-{REVISION}"
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as bundle:
        for entry in bundle:
            path = PurePosixPath(entry.name)
            if path.parts[0] != root or ".." in path.parts or path.is_absolute():
                raise ValueError("unsafe_archive_path")
            target = source.joinpath(*path.parts[1:])
            if entry.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif entry.isfile() and entry.size <= 16 * 1024 * 1024:
                target.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(entry) as stream:
                    target.write_bytes(stream.read())
            else:
                raise ValueError("unsupported_archive_entry")
    harden_source(source)
    lock = source / "poetry.lock"
    exported = requirements(tomllib.loads(lock.read_text(encoding="utf8")))
    (destination / "requirements.txt").write_bytes(exported.encode("utf8"))
    (source / "UPSTREAM_REVISION").write_bytes((REVISION + "\n").encode("utf8"))
    files = [{"path": path.relative_to(destination).as_posix(),
              "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size}
             for path in sorted(destination.rglob("*"), key=lambda path: path.relative_to(destination).as_posix())
             if path.is_file()]
    manifest = {"revision": REVISION, "archive_url": ARCHIVE_URL, "archive_sha256": ARCHIVE_SHA256,
                "files": files, "runtime_verified": False, "canonical_writes": False}
    (destination / "build-inputs.json").write_bytes(json.dumps(manifest, indent=2).encode("utf8"))
    return manifest


def verify_prepared(destination):
    """Reconstruct trusted inputs offline; a rewritten manifest cannot bless modified source."""
    destination = Path(destination).resolve(strict=True)
    actual = {}
    # Do not silently skip unreadable directories or accept links to files outside the bundle.
    def reject_walk_error(error):
        raise error
    for directory, directories, names in os.walk(destination, onerror=reject_walk_error, followlinks=False):
        for name in directories + names:
            path = Path(directory) / name
            if path.is_symlink():
                raise ValueError("linked_build_input")
        for name in names:
            path = Path(directory) / name
            if not path.is_file():
                raise ValueError("invalid_build_input")
            relative = path.relative_to(destination).as_posix()
            actual[relative] = {"path": relative, "bytes": path.stat().st_size,
                                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    # Regeneration uses the pinned archive digest, not the candidate's own file hashes.
    with tempfile.TemporaryDirectory(prefix="openstates-build-verification-") as temporary:
        expected = prepare((destination / "upstream.tar.gz").read_bytes(), Path(temporary) / "expected")
    if set(actual) != {entry["path"] for entry in expected["files"]} | {"build-inputs.json"}:
        raise ValueError("build_input_file_set_mismatch")
    if any(actual[entry["path"]] != entry for entry in expected["files"]):
        raise ValueError("build_input_content_mismatch")
    if json.loads((destination / "build-inputs.json").read_text(encoding="utf8")) != expected:
        raise ValueError("build_input_manifest_mismatch")
    return {"revision": REVISION, "verified_files": len(expected["files"]), "runtime_verified": False}


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--archive":
        manifest = prepare(Path(sys.argv[2]).read_bytes(), sys.argv[3])
        print(json.dumps({"revision": REVISION, "files": len(manifest["files"]), "runtime_verified": False}))
        raise SystemExit(0)
    if len(sys.argv) == 3 and sys.argv[1] == "--verify":
        print(json.dumps(verify_prepared(sys.argv[2])))
        raise SystemExit(0)
    if len(sys.argv) != 2:
        raise SystemExit("usage: prepare_openstates.py <new-build-input-directory>")
    with urlopen(ARCHIVE_URL, timeout=60) as response:
        archive = response.read(16 * 1024 * 1024 + 1)
    manifest = prepare(archive, sys.argv[1])
    print(json.dumps({"revision": REVISION, "files": len(manifest["files"]), "runtime_verified": False}))
