"""Exercise the patched pinned scraper with real Open States event objects, without network."""

import datetime
import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tarfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from openstates_source_policy import PATCHES
from prepare_openstates import ARCHIVE_SHA256


class WashingtonEventTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(os.environ.get("OPENSTATES_TEST_INPUTS", "/opt/openstates/inputs"))
        archive = root / "upstream.tar.gz"
        if not archive.exists() or importlib.util.find_spec("openstates") is None:
            raise unittest.SkipTest("Run in the pinned Open States runtime with retained source inputs")
        if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA256:
            raise ValueError("unexpected_test_source")
        with tarfile.open(archive) as bundle:
            entries = [item for item in bundle.getmembers() if item.name.endswith("/scrapers/wa/events.py")]
            if len(entries) != 1:
                raise ValueError("unexpected_test_source_members")
            source = bundle.extractfile(entries[0]).read().decode("utf8")
        for before, after in PATCHES["scrapers/wa/events.py"]:
            if source.count(before) != 1:
                raise ValueError("source_policy_target_mismatch")
            source = source.replace(before, after)
        sys.path.insert(0, str(root / "source/scrapers"))
        namespace = {"__name__": "wa.acceptance_events", "__package__": "wa"}
        exec(compile(source, "wa/events.py", "exec"), namespace)
        cls.scraper_class = namespace["WAEventScraper"]

    def scraper(self, date="2025-01-14T13:30:00", cancelled="false", agenda_id="32346"):
        scraper = self.scraper_class(None, "/tmp")
        meeting = f'''<ArrayOfCommitteeMeeting xmlns="http://WSLWebServices.leg.wa.gov/">
          <CommitteeMeeting><Cancelled>{cancelled}</Cancelled><Agency>House</Agency><Date>{date}</Date>
          <Committees><Committee><Id>31641</Id><Agency>House</Agency><Acronym>ED</Acronym>
          <LongName>Education</LongName></Committee></Committees>
          <AgendaId>{agenda_id}</AgendaId><Notes>Public hearing</Notes><Room>1</Room>
          <Building>Capitol</Building><City>Olympia</City><State>WA</State></CommitteeMeeting>
        </ArrayOfCommitteeMeeting>'''.encode()
        agenda = b'''<ArrayOfCommitteeMeetingItem xmlns="http://WSLWebServices.leg.wa.gov/">
          <CommitteeMeetingItem><BillId></BillId><ItemDescription>Agency briefing</ItemDescription></CommitteeMeetingItem>
          <CommitteeMeetingItem><BillId>HB 1000</BillId><ItemDescription>Public testimony</ItemDescription></CommitteeMeetingItem>
        </ArrayOfCommitteeMeetingItem>'''
        scraper.get = Mock(side_effect=lambda url: SimpleNamespace(
            content=agenda if "GetCommitteeMeetingItems?" in url else meeting))
        return scraper

    def test_cancelled_meeting_and_non_bill_agenda_are_preserved(self):
        scraper = self.scraper(cancelled="true")
        events = list(scraper.scrape(start="2025-01-13", end="2025-01-19"))
        self.assertEqual(len(events), 1)
        event = events[0]
        self.assertEqual(event.status, "cancelled")
        self.assertEqual(event.upstream_id, "32346")
        self.assertEqual(event.extras["committees"], [{"id": "31641", "agency": "House", "code": "ED", "name": "Education"}])
        self.assertEqual(event.start_date.utcoffset(), datetime.timedelta(hours=-8))
        self.assertEqual(len(event.agenda), 2)
        self.assertEqual(event.agenda[0]["description"], "Agency briefing")
        self.assertEqual(len(event.agenda[0]["related_entities"]), 0)
        self.assertEqual(len(event.agenda[1]["related_entities"]), 1)
        # One inventory request across all chambers, plus one agenda request.
        self.assertEqual(scraper.get.call_count, 2)
        again = list(scraper.scrape(start="2025-01-13", end="2025-01-19"))
        self.assertEqual(again[0].upstream_id, event.upstream_id)
        self.assertEqual(scraper.get.call_count, 4)

    def test_invalid_windows_fail_before_network(self):
        for start, end in [(None, None), ("2025-01-01", "2025-01-08"),
                           ("2025-01-02", "2025-01-01"), ("2025-02-30", "2025-03-01")]:
            scraper = self.scraper()
            with self.subTest(start=start, end=end), self.assertRaises(ValueError):
                list(scraper.scrape(start=start, end=end))
            scraper.get.assert_not_called()

    def test_invalid_cancellation_and_ambiguous_clocks_fail_closed(self):
        import pytz
        for date, cancelled, error in [
            ("2025-01-14T13:30:00", "unknown", ValueError),
            ("2025-11-02T01:30:00", "false", pytz.AmbiguousTimeError),
            ("2025-03-09T02:30:00", "false", pytz.NonExistentTimeError),
        ]:
            scraper = self.scraper(date, cancelled)
            with self.subTest(date=date, cancelled=cancelled), self.assertRaises(error):
                list(scraper.scrape(start=date[:10], end=date[:10]))

    def test_summer_time_uses_pacific_daylight_offset(self):
        scraper = self.scraper("2025-07-01T13:30:00")
        event = list(scraper.scrape(start="2025-07-01", end="2025-07-01"))[0]
        self.assertEqual(event.status, "confirmed")
        self.assertEqual(event.start_date.utcoffset(), datetime.timedelta(hours=-7))

    def test_response_scope_and_identity_are_validated(self):
        for agenda_id in ("", "0", "12/34", "１２３"):
            scraper = self.scraper(agenda_id=agenda_id)
            with self.subTest(agenda_id=agenda_id), self.assertRaisesRegex(ValueError, "invalid_agenda_identity"):
                list(scraper.scrape(start="2025-01-14", end="2025-01-14"))
            self.assertEqual(scraper.get.call_count, 1)
        scraper = self.scraper()
        with self.assertRaisesRegex(ValueError, "event_outside_requested_window"):
            list(scraper.scrape(start="2025-01-15", end="2025-01-15"))


if __name__ == "__main__":
    unittest.main()
