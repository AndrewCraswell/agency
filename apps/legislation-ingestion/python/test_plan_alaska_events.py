import unittest

from plan_alaska_events import plan_events


def row(day, title="Title"):
    return f"<Meeting><chamber>H</chamber><Sponsor>FIN</Sponsor><Schedule>2025-01-{day:02}T13:30:00-09:00</Schedule><Title>{title}</Title></Meeting>"


class EventPlanTests(unittest.TestCase):
    def test_publisher_ampersand_code_is_retained(self):
        source = ("<Meetings>" + row(1).replace("FIN", "L&amp;C") + "</Meetings>").encode()
        self.assertEqual(plan_events(source)["batches"][0]["event_keys"], ["H:L&C:2025-01-01T13:30:00-09:00"])

    def test_bounded_exhaustive_and_repeatable(self):
        source = ("<Meetings>" + "".join(row(day) for day in range(1, 24)) + "</Meetings>").encode()
        plan = plan_events(source)
        self.assertEqual(plan, plan_events(source))
        self.assertEqual([len(batch["event_keys"]) for batch in plan["batches"]], [10, 10, 3])
        self.assertEqual(len({key for batch in plan["batches"] for key in batch["event_keys"]}), 23)
        self.assertFalse(plan["complete_snapshot"])

    def test_conflicts_excluded_duplicates_collapsed(self):
        source = ("<Meetings>" + row(1) * 2 + row(2) + row(2, "Changed") + "</Meetings>").encode()
        plan = plan_events(source)
        self.assertEqual(plan["partition"]["accepted_occurrences"], 1)
        self.assertEqual(plan["partition"]["exact_duplicate_rows"], 1)
        self.assertEqual(len(plan["partition"]["quarantined"]), 1)
        self.assertEqual(len(plan["batches"][0]["event_keys"]), 1)

    def test_invalid_inventory_rejected(self):
        for source in [b"<Meetings/>", b"<Error>Unavailable</Error>", b'<!DOCTYPE x><Meetings/>',
                       ("<Meetings>" + row(1).replace("-09:00", "") + "</Meetings>").encode()]:
            with self.assertRaises(ValueError):
                plan_events(source)
        for size in [0, 11, True]:
            with self.assertRaisesRegex(ValueError, "invalid_batch_size"):
                plan_events(b"<Meetings/>", size)


if __name__ == "__main__":
    unittest.main()
