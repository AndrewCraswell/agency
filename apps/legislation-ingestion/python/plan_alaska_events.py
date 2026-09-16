"""Freeze bounded occurrence batches from retained official XML; no canonical writes."""

import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

from alaska_meeting_partition import partition_meetings


def plan_events(source, batch_size=10):
    if type(batch_size) is not int or not 1 <= batch_size <= 10:
        raise ValueError("invalid_batch_size")
    if not isinstance(source, bytes) or not source or len(source) > 16 * 1024 * 1024:
        raise ValueError("invalid_source_size")
    if re.search(br"<!DOCTYPE|<!ENTITY", source, re.I):
        raise ValueError("unsafe_source_xml")
    root = ET.fromstring(source)
    if any(node.tag.split("}")[-1] == "Error" for node in root.iter()):
        raise ValueError("alaska_meetings_source_error")
    records = []
    for row in root.iter("Meeting"):
        chamber = (row.findtext("chamber") or "").strip()
        sponsor = (row.findtext("Sponsor") or "").strip()
        timestamp = datetime.fromisoformat((row.findtext("Schedule") or "").strip())
        if chamber not in ("H", "S", "J") or not re.fullmatch(r"[A-Z0-9&]+", sponsor) or timestamp.utcoffset() is None:
            raise ValueError("invalid_alaska_meeting_identity")
        key = f"{chamber}:{sponsor}:{timestamp.isoformat()}"
        records.append((key, ET.tostring(row, encoding="utf8")))
    if not records:
        raise ValueError("empty_meeting_inventory")
    _, report = partition_meetings(records)
    excluded = {item["occurrence_key"] for item in report["quarantined"]}
    keys = sorted({key for key, _ in records} - excluded)
    source_hash = hashlib.sha256(source).hexdigest()
    batches = []
    for offset in range(0, len(keys), batch_size):
        selected = keys[offset:offset + batch_size]
        identity = json.dumps([source_hash, selected], separators=(",", ":")).encode()
        batches.append({"id": hashlib.sha256(identity).hexdigest(), "event_keys": selected})
    return {"jurisdiction": "ak", "session": "34", "source_sha256": source_hash,
            "partition": report, "batches": batches, "complete_snapshot": False}


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4) or (len(sys.argv) == 4 and sys.argv[3] != "--verify"):
        raise SystemExit("Usage: plan_alaska_events.py <retained-meetings.xml> <plan.json> [--verify]")
    result = plan_events(Path(sys.argv[1]).read_bytes())
    if len(sys.argv) == 4:
        if json.loads(Path(sys.argv[2]).read_text(encoding="utf8")) != result:
            raise ValueError("frozen_event_plan_mismatch")
        print(json.dumps({"verified": True, "batches": len(result["batches"])}))
        raise SystemExit(0)
    # Exclusive creation prevents replacing a frozen inventory during a resumed run.
    with Path(sys.argv[2]).open("x", encoding="utf8") as output:
        json.dump(result, output, sort_keys=True, indent=2)
    print(json.dumps({"batches": len(result["batches"]),
                      "occurrences": result["partition"]["accepted_occurrences"],
                      "quarantined": len(result["partition"]["quarantined"])}))
