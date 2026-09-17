import unittest
from alaska_journal import journal_text, parse_roll_call


class JournalTests(unittest.TestCase):
    def sample(self, names="Adams, Brown", heading="HB 1", counts="2   NAYS: 1   EXCUSED: 1   ABSENT: 0"):
        return f"{heading}\nFinal Passage\nYEAS: {counts}\n\nYeas: {names}\n\nNays: Clark\n\nExcused: Davis\n\nAnd so the bill passed.\n"

    def test_preserves_named_options_and_wraps(self):
        result = parse_roll_call(self.sample("Adams,\nBrown"), "HB1", (2, 1, 1))
        self.assertEqual(result, [("yes", "Adams"), ("yes", "Brown"), ("no", "Clark"), ("excused", "Davis")])

    def test_rejects_wrong_bill_tallies_and_ambiguous_motions(self):
        for text, bill, totals in [(self.sample(), "SB1", (2, 1, 1)), (self.sample(), "HB1", (3, 0, 1)),
                                   (self.sample() * 2, "HB1", (2, 1, 1))]:
            with self.subTest(bill=bill), self.assertRaises(ValueError):
                parse_roll_call(text, bill, totals)

    def test_rejects_partial_duplicate_and_unparseable_voters(self):
        for names in ["Adams", "Adams, Adams", "Clark, Brown", "Adams, 123"]:
            with self.subTest(names=names), self.assertRaises(ValueError):
                parse_roll_call(self.sample(names), "HB1", (2, 1, 1))

    def test_accepts_committee_substitute_identifier(self):
        self.assertEqual(len(parse_roll_call(self.sample(heading="CSHB 1(STA)"), "HB1", (2, 1, 1))), 4)

    def test_continues_an_incomplete_group_across_split_printed_page_header(self):
        text = """HB 10
Effective Date
YEAS:  4   NAYS:  1   EXCUSED:  0   ABSENT:  0

Yeas:  Adams, Brown,

2026-05-16                     House Journal
Page 2680

Clark, Davis

Nays:  Evans

And so the effective date clause was adopted.
"""
        self.assertEqual(
            parse_roll_call(text, "HB10", (4, 1, 0)),
            [("yes", "Adams"), ("yes", "Brown"), ("yes", "Clark"), ("yes", "Davis"), ("no", "Evans")],
        )

    def test_does_not_absorb_a_page_header_after_a_complete_group(self):
        text = self.sample() + "\n2026-05-16 House Journal\nPage 2680\nNarrative, Not A Voter\n"
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1))), 4)

    def test_uses_source_anchor_to_disambiguate_equal_tallies(self):
        first = self.sample("Adams, Brown")
        second = self.sample("Evans, Fox")
        text = (
            f"[[JOURNAL_ANCHOR:AM1]]\n{first}[[JOURNAL_ANCHOR:HB1]]\nHB 1\n"
            f"[[JOURNAL_ANCHOR:1121]]\n[[JOURNAL_ANCHOR:AM2]]\n"
            f"[[JOURNAL_ANCHOR:SCR14]]\nSCR 14\n{second}"
        )
        self.assertEqual(
            parse_roll_call(text, "HB1", (2, 1, 1), "AM2")[:2],
            [("yes", "Evans"), ("yes", "Fox")],
        )
        self.assertEqual(
            parse_roll_call(text, "HB1", (2, 1, 1), "AM1")[:2],
            [("yes", "Adams"), ("yes", "Brown")],
        )

    def test_rejects_missing_or_duplicate_source_anchor(self):
        for text in [self.sample(), "[[JOURNAL_ANCHOR:AM1]]\n" + self.sample() * 2]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_roll_call(text, "HB1", (2, 1, 1), "AM1")

    def test_preserves_valid_named_anchors_in_journal_text(self):
        class Anchor:
            text = "HB 1"

            def get(self, name, default=""):
                return "AM1" if name == "name" else default

        anchor = Anchor()

        class Pre:
            def xpath(self, expression):
                if expression == ".//a[@name]":
                    return [anchor]
                if expression == ".//text()":
                    return [anchor.text, "Final Passage"]
                raise AssertionError(expression)

        pre = Pre()

        class Document:
            def xpath(self, expression):
                self.expression = expression
                return [pre]

        self.assertIn("[[JOURNAL_ANCHOR:AM1]]", journal_text(Document()))


if __name__ == "__main__":
    unittest.main()
