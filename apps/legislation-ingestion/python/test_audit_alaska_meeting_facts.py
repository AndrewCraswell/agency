import unittest
from audit_alaska_meeting_facts import audit


class FactAuditTests(unittest.TestCase):
    def test_source_facts_and_offset_equivalence(self):
        source = b'<Meetings><Meeting Canceled="true"><chamber>H</chamber><Sponsor>FIN</Sponsor><Schedule>2025-01-01T13:00:00-09:00</Schedule><Title>Finance</Title></Meeting></Meetings>'
        row = {"source_id": "H:FIN:2025-01-01T13:00:00-09:00", "name": "HOUSE Finance",
               "location": None, "status": "cancelled", "start": "2025-01-01T22:00:00+00:00"}
        self.assertEqual(audit(source, [row])["matched"], 1)
        changed = {**row, "location": "Invented", "status": "completed"}
        self.assertEqual(audit(source, [changed])["mismatches"][0]["fields"], ["location", "status"])


if __name__ == "__main__":
    unittest.main()
