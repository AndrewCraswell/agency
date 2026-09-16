import unittest
from alaska_meeting_partition import partition_meetings


class MeetingPartitionTests(unittest.TestCase):
    def test_exact_duplicates_collapse_but_conflicts_remain_complete(self):
        accepted, report = partition_meetings([
            ("a", b"one"), ("a", b"one"), ("b", b"two"), ("b", b"changed"), ("c", b"three")
        ])
        self.assertEqual(accepted, [b"one", b"three"])
        self.assertEqual(report["exact_duplicate_rows"], 1)
        self.assertFalse(report["complete_snapshot"])
        self.assertEqual(report["quarantined"][0]["source_rows"], ["two", "changed"])
        self.assertEqual(report["input_rows"], 5)

    def test_order_does_not_change_admitted_records(self):
        rows = [("b", b"b"), ("a", b"a"), ("b", b"b")]
        self.assertEqual(partition_meetings(rows), partition_meetings(list(reversed(rows))))

    def test_malformed_identity_or_source_fails_closed(self):
        for row in [("", b"xml"), (None, b"xml"), ("key", b""), ("key", "xml")]:
            with self.assertRaisesRegex(ValueError, "invalid_meeting_partition_record"):
                partition_meetings([row])
