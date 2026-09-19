"""Installed-runtime acceptance; run in a network-disabled container before live extraction."""

import importlib.metadata
import json
from pathlib import Path
import sys

from openstates_runner import command, REVISION, PROFILES
from prepare_openstates import verify_prepared


def smoke(inputs):
    inputs = Path(inputs)
    verify_prepared(inputs)
    if importlib.metadata.version("openstates") != "6.25.5":
        raise ValueError("core_version_mismatch")
    sys.path.insert(0, str(inputs / "source/scrapers"))
    from openstates.cli.update import get_jurisdiction, parse_args
    for state, profile in PROFILES.items():
        jurisdiction, _ = get_jurisdiction(state)
        if jurisdiction.jurisdiction_id != f"ocd-jurisdiction/country:us/state:{state}/government":
            raise ValueError("jurisdiction_mismatch")
        if not set(profile["domains"]).issubset(jurisdiction.scrapers):
            raise ValueError("lane_mismatch")
        if profile["session"] not in {session["identifier"] for session in jurisdiction.legislative_sessions}:
            raise ValueError("missing_pilot_session")
        for domain in profile["domains"]:
            session = profile["session"] if domain == "bills" else None
            identifier = {"nc": "S1", "ak": "SB1", "wa": "SB 5000"}[state]
            request = {"jurisdiction": state, "domain": domain, "session": session,
                       "timeout_seconds": 1200, "revision": REVISION, "bill_ids": [identifier] if session else None}
            expected = [domain] + (["session=" + session, "bill_ids=" + identifier] if session else [])
            if state == "ak" and domain == "events":
                key = "H:FIN:2025-01-22T13:30:00-09:00"
                request.update(session="34", event_keys=[key])
                expected = [domain, "session=34", "event_keys=" + key]
            if state == "wa" and domain == "events":
                request.update(session=profile["session"], event_window={"start": "2025-01-13", "end": "2025-01-19"})
                expected = [domain, "session=" + profile["session"], "start=2025-01-13", "end=2025-01-19"]
            sys.argv = ["openstates"] + command(request)[3:]
            args, other = parse_args()
            if args.actions != ["scrape"] or args.module != state or not args.strict or args.SCRAPELIB_VERIFY is not True:
                raise ValueError("unsafe_cli_contract")
            if other != expected:
                raise ValueError("unexpected_scraper_arguments")
    return {"startup_verified": True, "core_version": "6.25.5", "lanes": ["bills", "events"],
            "jurisdictions": list(PROFILES), "revision": REVISION, "live_scrape_verified": False, "canonical_writes": False}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: smoke_openstates_runtime.py <verified-build-inputs>")
    print(json.dumps(smoke(sys.argv[1])))
