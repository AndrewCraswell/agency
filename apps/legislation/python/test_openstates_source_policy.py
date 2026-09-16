import tempfile
import re
import datetime as dt
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from openstates_source_policy import PATCHES, harden_source


class SourcePolicyTests(unittest.TestCase):
    def test_nc_vote_groups_accept_extra_and_reordered_class_tokens(self):
        try:
            from lxml import html
        except ImportError:
            self.skipTest("lxml is required; run this regression in the scraper image")
        selector = next(after for before, after in PATCHES["scrapers/nc/bills.py"]
                        if before.startswith("vdoc.xpath"))
        document = html.fromstring('''<main>
          <div class="row ncga-row-no-gutters mt-3">
            <div class="row ncga-row-no-gutters"><div>Ayes (Democrat)</div><div>One</div></div>
          </div>
          <div class="row ncga-row-no-gutters mt-2"><div>Ayes (Unaffiliated)</div><div>Cunningham; Majeed</div></div>
          <div class="mt-2 ncga-row-no-gutters row"><div>Not Voting (Republican)</div><div>Two</div></div>
          <div class="row ncga-row-no-gutters-suffix"><div>Must not match</div></div>
        </main>''')
        rows = eval(selector, {"vdoc": document})
        self.assertEqual(len(rows), 3)
        self.assertIn("Cunningham; Majeed", rows[1].text_content())
        self.assertIn("Not Voting", rows[2].text_content())

    def test_nc_not_voting_is_not_abstention(self):
        replacement = next(after for before, after in PATCHES["scrapers/nc/bills.py"]
                           if 'vote_type = "abstain"' in before)
        namespace = {}
        exec(replacement.strip(), namespace)
        self.assertEqual(namespace["vote_type"], "not voting")

    def test_alaska_selection_requires_all_requested_rows_before_yield(self):
        namespace = {}
        replacement = PATCHES["scrapers/ak/bills.py"][1][1]
        exec("def select(doc, selected):\n" + replacement + "            yield bill_link.text\n", namespace)
        rows = [SimpleNamespace(text="HB 1"), SimpleNamespace(text="HB 2")]
        doc = SimpleNamespace(xpath=lambda query: rows)
        self.assertEqual(list(namespace["select"](doc, ["HB2"])), ["HB 2"])
        with self.assertRaisesRegex(ValueError, "missing_selected_bill"):
            list(namespace["select"](doc, ["HB3"]))
        rows.append(SimpleNamespace(text="HB 1"))
        with self.assertRaisesRegex(ValueError, "duplicate_selected_bill"):
            list(namespace["select"](doc, ["HB1"]))

    def test_batch_entry_rejects_unbounded_and_mixed_chamber_requests(self):
        namespace = {"re": re}
        exec("class Policy:\n" + PATCHES["scrapers/nc/bills.py"][1][1], namespace)
        policy = namespace["Policy"]()
        policy.scrape_chamber = Mock(return_value=iter(["bill"]))
        self.assertEqual(list(policy.scrape("2025", "S10,S2")), ["bill"])
        policy.scrape_chamber.assert_called_once_with("upper", "2025", ["S10", "S2"])
        for session, ids in (("2025", None), ("2025E1", "S1"), ("2025", "S1,H1"), ("2025", "S1,S1")):
            with self.subTest(session=session, ids=ids), self.assertRaises(ValueError):
                list(policy.scrape(session, ids))

    def test_alaska_event_transport_rejects_http_and_xml_errors(self):
        replacement = PATCHES["scrapers/ak/events.py"][1][1]
        page = SimpleNamespace(xpath=Mock(return_value=[]))
        etree = SimpleNamespace(fromstring=Mock(return_value=page))
        namespace = {"lxml": SimpleNamespace(etree=etree)}
        exec("class Policy:\n    def fetch(self, url, args, headers):\n" + replacement, namespace)
        policy = namespace["Policy"]()
        response = SimpleNamespace(content=b"xml", raise_for_status=Mock())
        policy.get = Mock(return_value=response)
        self.assertIs(policy.fetch("https://www.akleg.gov/", {}, {}), page)
        policy.get.assert_called_once_with("https://www.akleg.gov/", params={}, headers={}, verify=True, timeout=(10, 60))
        response.raise_for_status.assert_called_once_with()
        page.xpath.return_value = [object()]
        with self.assertRaisesRegex(ValueError, "alaska_meetings_source_error"):
            policy.fetch("https://www.akleg.gov/", {}, {})
        response.raise_for_status.side_effect = ValueError("HTTP failure")
        with self.assertRaisesRegex(ValueError, "HTTP failure"):
            policy.fetch("https://www.akleg.gov/", {}, {})

    def test_selected_feed_membership_is_complete_before_first_yield(self):
        replacement = PATCHES["scrapers/nc/bills.py"][3][1]
        namespace = {}
        exec("def select(data, selected):\n" + replacement + "            yield bill_id, bill_type, bill_title\n", namespace)
        def row(identifier):
            return [SimpleNamespace(text=value) for value in ["", identifier, "", "", "title", "", "", "SB"]]
        feed = [[None] * 4 + [row("S10"), row("S3"), row("S2")]]
        self.assertEqual(list(namespace["select"](feed, ["S2", "S10"])), [("S2", "SB", "title"), ("S10", "SB", "title")])
        for data, selected in ((feed, ["S2", "S1"]), ([[None] * 4 + [row("S2"), row("S2")]], ["S2"])):
            with self.assertRaises(ValueError):
                next(namespace["select"](data, selected))

    def test_vote_clock_preserves_am_pm(self):
        expression = PATCHES["scrapers/nc/bills.py"][0][1]
        for value, hour in (("8/4/2026 6:07 p.m.", 18), ("8/4/2026 12:00 a.m.", 0), ("8/4/2026 12:00 p.m.", 12)):
            with self.subTest(value=value):
                parsed = eval(expression, {"dt": dt, "date": value})
                self.assertEqual(parsed.hour, hour)

    def fixture(self, root):
        for name, patches in PATCHES.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("\n".join(before for before, _ in patches), encoding="utf8")

    def test_all_changes_applied_and_reapplication_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            harden_source(root)
            for name, patches in PATCHES.items():
                content = (root / name).read_text(encoding="utf8")
                for before, after in patches:
                    self.assertIn(after, content)
                    if before not in after:
                        self.assertNotIn(before, content)
            with self.assertRaisesRegex(ValueError, "source_policy_target_mismatch"):
                harden_source(root)

    def test_missing_and_duplicate_targets_fail_closed(self):
        for duplicate in (False, True):
            with self.subTest(duplicate=duplicate), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                self.fixture(root)
                target = root / "scrapers/nc/events.py"
                target.write_text("    verify = False\n" * (2 if duplicate else 0), encoding="utf8")
                with self.assertRaisesRegex(ValueError, "source_policy_target_mismatch"):
                    harden_source(root)

    def test_mixin_request_policy_propagates_tls_and_http_failures(self):
        # Execute the actual replacement block, not a second implementation of the policy.
        replacement = PATCHES["scrapers/utils/lxmlize.py"][1][1]
        namespace = {}
        exec("class Policy:\n    def fetch(self, url, headers=None):\n" + replacement, namespace)
        policy = namespace["Policy"]()
        response = SimpleNamespace(raise_for_status=Mock())
        policy.get = Mock(return_value=response)
        policy.fetch("https://www.ncleg.gov/LegislativeCalendar/")
        policy.get.assert_called_once_with("https://www.ncleg.gov/LegislativeCalendar/",
                                           verify=True, headers=None, timeout=(10, 60))
        response.raise_for_status.assert_called_once_with()
        for error in (ConnectionError("certificate verification failed"), TimeoutError("read deadline")):
            policy.get.reset_mock()
            policy.get.side_effect = error
            with self.assertRaises(type(error)):
                policy.fetch("https://www.ncleg.gov/")
            self.assertEqual(policy.get.call_count, 1)
        policy.get.side_effect = None
        response.raise_for_status.side_effect = ValueError("HTTP failure")
        with self.assertRaisesRegex(ValueError, "HTTP failure"):
            policy.fetch("https://www.ncleg.gov/")
