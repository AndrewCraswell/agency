"""Compare locally imported meeting facts with a retained official inventory, without writes."""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import xml.etree.ElementTree as ET

from plan_alaska_events import plan_events


def audit(source, persisted):
    plan = plan_events(source)
    admitted = {key for batch in plan["batches"] for key in batch["event_keys"]}
    expected = {}
    chambers = {"H": "HOUSE", "S": "SENATE", "J": "JOINT"}
    for row in ET.fromstring(source).iter("Meeting"):
        chamber = row.findtext("chamber").strip()
        timestamp = datetime.fromisoformat(row.findtext("Schedule").strip())
        key = f"{chamber}:{row.findtext('Sponsor').strip()}:{timestamp.isoformat()}"
        if key in admitted:
            expected[key] = {
                "name": f"{chambers[chamber]} {row.findtext('Title', '').strip()}",
                "location": row.findtext("Location", "").strip() or None,
                "status": "cancelled" if row.get("Canceled") == "true" else "scheduled",
                "start": timestamp,
            }
    mismatches = []
    matched = 0
    for actual in persisted:
        key = actual["source_id"]
        facts = expected.get(key)
        if facts is None:
            mismatches.append({"source_id": key, "fields": ["not_in_admitted_inventory"]})
            continue
        fields = [name for name in ("name", "location", "status") if actual[name] != facts[name]]
        if datetime.fromisoformat(actual["start"]) != facts["start"]:
            fields.append("start")
        if fields:
            mismatches.append({"source_id": key, "fields": fields})
        else:
            matched += 1
    return {"inventory": len(admitted), "checked": len(persisted), "matched": matched,
            "mismatches": mismatches, "productionWrites": False, "completenessChanged": False}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Expected retained official meeting XML")
    query = """select coalesce(json_agg(x), '[]') from (
      select source_id,name,location->>'name' location,status,start_at as start
      from legislation.legislative_events
      where id like 'event:openstates:ak-meeting-34-%' order by source_id
    ) x"""
    result = subprocess.run(["docker", "exec", "legislation-local-postgres-1", "psql", "-U", "legislation",
                             "-d", "legislation_test", "-At", "-c", query],
                            check=True, capture_output=True, text=True, timeout=30)
    print(json.dumps(audit(Path(sys.argv[1]).read_bytes(), json.loads(result.stdout))))
