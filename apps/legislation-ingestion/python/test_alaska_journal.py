import unittest
from alaska_journal import journal_text, merge_adjacent_journal_text, parse_roll_call


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
[[JOURNAL_ANCHOR:2680]]
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

    def test_rejects_missing_or_ambiguous_source_anchor(self):
        duplicate = (
            "[[JOURNAL_ANCHOR:AM1]]\n" + self.sample()
            + "[[JOURNAL_ANCHOR:AM1]]\n" + self.sample()
        )
        for text in [self.sample(), "[[JOURNAL_ANCHOR:AM1]]\n" + self.sample() * 2, duplicate]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_roll_call(text, "HB1", (2, 1, 1), "AM1")

    def test_accepts_one_matching_roll_call_across_repeated_source_anchor(self):
        text = (
            "[[JOURNAL_ANCHOR:AM11]]\nAmendment text without a roll call\n"
            "[[JOURNAL_ANCHOR:AM11]]\n" + self.sample()
        )
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "AM11")), 4)

    def test_accepts_bill_heading_immediately_before_printed_page_anchor(self):
        text = "HB 1\n[[JOURNAL_ANCHOR:2901]]\n" + self.sample().replace("HB 1\n", "", 1)
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "2901")), 4)

    def test_numeric_page_anchor_can_cross_an_embedded_amendment_anchor(self):
        text = (
            "[[JOURNAL_ANCHOR:2177]]\nAction begins\n"
            "[[JOURNAL_ANCHOR:AM2]]\nAmendment text\n"
            "[[JOURNAL_ANCHOR:2178]]\n" + self.sample()
        )
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "2177")), 4)

    def test_numeric_page_scope_excludes_same_tally_two_printed_pages_later(self):
        text = (
            "[[JOURNAL_ANCHOR:0727]]\nPage 0727\n" + self.sample("Adams, Brown")
            + "[[JOURNAL_ANCHOR:0728]]\nPage 0728\nDifferent motion\n"
            + "[[JOURNAL_ANCHOR:0729]]\nPage 0729\n" + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "727")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_numeric_citation_uses_first_exact_call_when_tally_continues_next_page(self):
        text = (
            "[[JOURNAL_ANCHOR:0775]]\nPage 0775\nMotion begins\n"
            "[[JOURNAL_ANCHOR:0776]]\nPage 0776\n" + self.sample("Adams, Brown") + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "775", "775")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_numeric_citation_accepts_tally_started_on_previous_page(self):
        text = (
            "[[JOURNAL_ANCHOR:0833]]\nPage 0833\nHB 1\nFinal Passage\n"
            "YEAS: 2 NAYS: 1 EXCUSED: 1 ABSENT: 0\n"
            "[[JOURNAL_ANCHOR:0834]]\nPage 0834\n"
            "Yeas: Adams, Brown\nNays: Clark\nExcused: Davis\nAnd so the bill passed.\n"
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "834", "834")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_numeric_citation_uses_motion_descriptor_before_page_anchor(self):
        text = (
            'The question being: "Shall HB 1 pass the Senate?"\n'
            "HB 1 Third Reading - Final Passage\n"
            "[[JOURNAL_ANCHOR:2876]]\nPage 2876\n"
            + self.sample().replace("HB 1\nFinal Passage\n", "", 1)
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "2876", "2876", True,
                                "(S) PASSED Y2 N1 E1")),
            4,
        )

    def test_zero_dash_passage_tally_excludes_same_page_reserve_fund_vote(self):
        passage = self.sample(counts="2   NAYS: 0   EXCUSED: 0   ABSENT: 0").replace(
            "Nays: Clark\n\nExcused: Davis\n\n", ""
        )
        reserve = self.sample("Evans, Fox", counts="2   NAYS: 0   EXCUSED: 0   ABSENT: 0").replace(
            "Nays: Clark\n\nExcused: Davis\n\n", ""
        )
        text = (
            "[[JOURNAL_ANCHOR:1911]]\nPage 1911\n"
            'The question being: "Shall HB 1, funded from the constitutional budget reserve, pass the Senate?"\n'
            + passage
            + 'The question being: "Shall the constitutional budget reserve fund section be adopted?"\n'
            + reserve.replace("Final Passage", "Adopt Budget Reserve Fund Sections")
        )
        passage_result = parse_roll_call(
            text, "HB1", (2, 0, 0), "1911", "1911", True, "(S) PASSED Y2 N-"
        )
        reserve_result = parse_roll_call(
            text, "HB1", (2, 0, 0), "1911", "1911", True,
            "(S) CBRF SECTION(S) ADP VOTE Y2 N-",
        )
        self.assertEqual(passage_result, [("yes", "Adams"), ("yes", "Brown")])
        self.assertEqual(reserve_result, [("yes", "Evans"), ("yes", "Fox")])

    def test_adjacent_response_replaces_truncated_overlap_instead_of_duplicating_it(self):
        primary = (
            "[[JOURNAL_ANCHOR:2170]]\nPage 2170\nHB 1 Third Reading\n"
            "YEAS: 2 NAYS: 1 EXCUSED: 1 ABSENT: 0\n"
            "[[JOURNAL_ANCHOR:2171]]\nPage 2171\nYeas: Adams\n"
        )
        adjacent = (
            "[[JOURNAL_ANCHOR:2170]]\nPage 2170\nRepeated prior page\n"
            "[[JOURNAL_ANCHOR:2171]]\nPage 2171\n"
            "Yeas: Adams, Brown\nNays: Clark\nExcused: Davis\n"
            "[[JOURNAL_ANCHOR:2172]]\nPage 2172\n"
        )
        merged = merge_adjacent_journal_text(primary, adjacent, "2171")
        self.assertNotIn("Repeated prior page", merged)
        self.assertEqual(merged.count("[[JOURNAL_ANCHOR:2171]]"), 1)
        self.assertEqual(len(parse_roll_call(merged, "HB1", (2, 1, 1), "2170", "2170", True)), 4)

    def test_numeric_citation_ignores_completed_previous_page_vote(self):
        text = (
            "[[JOURNAL_ANCHOR:0833]]\nPage 0833\n" + self.sample("Adams, Brown")
            + "[[JOURNAL_ANCHOR:0834]]\nPage 0834\n" + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "834", "834")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_numeric_citation_rejects_two_exact_calls_on_cited_page(self):
        text = "[[JOURNAL_ANCHOR:0776]]\nPage 0776\n" + self.sample() + self.sample("Evans, Fox")
        with self.assertRaises(ValueError):
            parse_roll_call(text, "HB1", (2, 1, 1), "776", "776")

    def test_named_anchor_prefers_complete_call_before_next_printed_page(self):
        text = (
            "[[JOURNAL_ANCHOR:AM10]]\n" + self.sample("Adams, Brown")
            + "[[JOURNAL_ANCHOR:0730]]\nPage 0730\nRescind action\n" + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM10")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_parent_amendment_crosses_lower_numbered_nested_amendment(self):
        text = (
            "[[JOURNAL_ANCHOR:AM20]]\nParent amendment\n"
            "Amendment No. 2 to Amendment No. 20 was offered\n"
            "[[JOURNAL_ANCHOR:AM2]]\nAmendment to parent\n"
            "[[JOURNAL_ANCHOR:0738]]\nPage 0738\n" + self.sample()
            + "[[JOURNAL_ANCHOR:AM22]]\nNext amendment\n"
        )
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "AM20")), 4)

    def test_lower_numbered_ordinary_amendment_ends_named_action(self):
        text = (
            "[[JOURNAL_ANCHOR:AM5]]\n" + self.sample("Adams, Brown")
            + "Amendment No. 4 was offered\n[[JOURNAL_ANCHOR:AM4]]\n"
            + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM5")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_cited_printed_page_disambiguates_reused_named_anchor(self):
        text = (
            "[[JOURNAL_ANCHOR:AM50]]\nNested and parent amendment\n"
            "[[JOURNAL_ANCHOR:0773]]\nPage 0773\n" + self.sample("Adams, Brown")
            + "[[JOURNAL_ANCHOR:0775]]\nPage 0775\n" + self.sample("Evans, Fox")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM50", "775")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_named_anchor_on_cited_page_is_not_counted_twice(self):
        text = "[[JOURNAL_ANCHOR:0812]]\nPage 0812\n[[JOURNAL_ANCHOR:AM1]]\n" + self.sample()
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "AM1", "812")), 4)

    def test_cited_page_recovers_reused_named_anchor_behind_later_amendment(self):
        text = (
            "[[JOURNAL_ANCHOR:0812]]\nPage 0812\n[[JOURNAL_ANCHOR:AM1]]\n"
            + self.sample("Adams, Brown")
            + "[[JOURNAL_ANCHOR:AM2]]\nA later amendment begins\n"
            + "[[JOURNAL_ANCHOR:0814]]\nPage 0814\nAmendment No. 1 was before the House\n"
            + self.sample("Evans, Fox").replace("Final Passage", "Amendment No. 1")
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM1", "814", True, "AM NO 1 FAILED")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_cited_page_recovers_action_when_named_anchor_is_on_next_page(self):
        text = (
            "[[JOURNAL_ANCHOR:1155]]\nPage 1155\nAmendment No. 2 was before the Senate\n"
            "[[JOURNAL_ANCHOR:1156]]\nPage 1156\n[[JOURNAL_ANCHOR:AM2]]\n"
            "[[JOURNAL_ANCHOR:HB1]]\n[[JOURNAL_ANCHOR:AM3]]\n"
            + self.sample().replace("Final Passage", "Amendment No. 2")
            + "[[JOURNAL_ANCHOR:1157]]\nPage 1157\n"
        )
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM2", "1155", True,
                                 "AM NO 2 FAILED")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_direct_amendment_hint_rejects_nearby_rescind_call(self):
        direct = self.sample("Adams, Brown").replace(
            "Final Passage", 'The question being: "Shall Amendment No. 10 be adopted?"'
        )
        rescind = self.sample("Evans, Fox").replace(
            "Final Passage",
            'The question being: "Shall the House rescind previous action in failing to adopt '
            'Amendment No. 10?"',
        )
        text = "[[JOURNAL_ANCHOR:0729]]\n[[JOURNAL_ANCHOR:AM10]]\n" + direct + rescind
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM10", "729", True,
                                 "AM NO 10 FAILED")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_reconsidered_passage_rejects_same_day_reconsideration_call(self):
        same_day = self.sample("Adams, Brown").replace(
            "Final Passage", 'The question being: "Shall reconsideration be taken up on the same day?" '
            "Take Up Reconsideration on the Same Day",
        )
        passage = self.sample("Evans, Fox").replace(
            "Final Passage", 'The question to be reconsidered: "Shall HB 1 pass the House?" '
            "Final Passage Reconsideration",
        )
        text = "[[JOURNAL_ANCHOR:0821]]\n" + same_day + passage
        result = parse_roll_call(text, "HB1", (2, 1, 1), "821", "821", True,
                                 "(H) PASSED ON RECONSIDERATION Y2 N1 E1")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_same_day_reconsideration_accepts_senate_publisher_wording(self):
        text = "[[JOURNAL_ANCHOR:2401]]\n" + self.sample().replace(
            "Final Passage", "Take up Reconsideration Same Day?",
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "2401", "2401", True,
                                "(S) RECON SAME DAY VOTE Y2 N1 E1 - IN 3RD RDG")),
            4,
        )

    def test_effective_date_hint_rejects_equal_final_passage_tally(self):
        passage = self.sample("Adams, Brown")
        effective_date = self.sample("Evans, Fox").replace(
            "Final Passage", "Effective Date Clause",
        )
        text = "[[JOURNAL_ANCHOR:1154]]\n" + passage + effective_date
        result = parse_roll_call(text, "HB1", (2, 1, 1), "1154", "1154", True,
                                 "(H) EFFECTIVE DATE(S) FAILED Y2 N1 E1")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_concurrence_hint_rejects_equal_effective_date_tally(self):
        concurrence = self.sample("Adams, Brown").replace(
            "Final Passage", "Concur in the Senate amendment",
        )
        effective_date = self.sample("Evans, Fox").replace(
            "Final Passage", "Effective Date Concur",
        )
        text = "[[JOURNAL_ANCHOR:2326]]\n" + concurrence + effective_date
        result = parse_roll_call(text, "HB1", (2, 1, 1), "2326", "2326", True,
                                 "(H) CONCUR AM OF (S) Y2 N1 E1")
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_explicit_procedural_motion_disambiguates_same_page_tallies(self):
        withdrawn = self.sample("Adams, Brown").replace(
            "Final Passage", "Amendment No. 51/Withdraw"
        ).replace("And so the bill passed.", "And so, the motion to withdraw failed.")
        tabled = self.sample("Evans, Fox").replace(
            "Final Passage", "Amendment No. 51/Table"
        ).replace("And so the bill passed.", "And so, Amendment No. 51 was not tabled.")
        text = "[[JOURNAL_ANCHOR:0776]]\nPage 0776\n" + withdrawn + tabled
        result = parse_roll_call(text, "HB1", (2, 1, 1), "AM51", "776", True, "AM NO 51 NOT TABLED")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_compound_withdraw_action_matches_its_rule_suspension_question(self):
        text = (
            "[[JOURNAL_ANCHOR:1865]]\nPage 1865\nMotion to withdraw HB 1 from Rules.\n"
            "[[JOURNAL_ANCHOR:1866]]\nPage 1866\n"
            'The question being: "Shall the House suspend Uniform Rule 18?"\n'
            + self.sample().replace("Final Passage", "Suspend Uniform Rule 18")
        )
        result = parse_roll_call(
            text, "HB1", (2, 1, 1), "1865", "1865", True,
            "(H) WAIVE RULE 18, WITHDRAW FROM RULES, TAKE UP CONCUR TODAY, PASSED Y2 N1 E1",
        )
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_rescind_motion_uses_referenced_amendment_number(self):
        amendment_51 = self.sample("Adams, Brown").replace(
            "Final Passage", "Rescind Previous Action in failing to adopt Amendment No. 51"
        )
        amendment_12 = self.sample("Evans, Fox").replace(
            "Final Passage", "Rescind Previous Action in failing to adopt Amendment No. 12"
        )
        text = "[[JOURNAL_ANCHOR:0435]]\nPage 0435\n" + amendment_51 + amendment_12
        result = parse_roll_call(text, "HB1", (2, 1, 1), "435", "435", True, "RESCIND ACTION AM 12")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_passage_and_budget_reserve_votes_with_same_tally_are_distinct(self):
        passage = self.sample("Adams, Brown")
        reserve = (
            'The question being: "Shall the House adopt the constitutional budget reserve appropriations?"\n'
            + self.sample("Evans, Fox").replace(
                "Final Passage", "Constitutional Budget Reserve Appropriations"
            )
        )
        text = "[[JOURNAL_ANCHOR:0816]]\nPage 0816\n" + passage + reserve
        passage_result = parse_roll_call(text, "HB1", (2, 1, 1), "816", "816", True, "(H) PASSED Y2 N1 E1")
        reserve_result = parse_roll_call(text, "HB1", (2, 1, 1), "816", "816", True, "(H) CBRF SECTION(S) FAILED Y2 N1 E1")
        self.assertEqual(passage_result[:2], [("yes", "Adams"), ("yes", "Brown")])
        self.assertEqual(reserve_result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_procedural_passed_action_is_not_forced_to_final_passage(self):
        text = "[[JOURNAL_ANCHOR:0214]]\nPage 0214\n" + self.sample().replace(
            "Final Passage", "Discharge from EDC, Rule 48(D)"
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "214", "214", True,
                                "(H) DISCHARGE FROM EDC, RULE 48(D), PASSED Y2 N1 E1")),
            4,
        )

    def test_not_tabled_accepts_publisher_table_label_with_failed_motion(self):
        text = "[[JOURNAL_ANCHOR:0776]]\nPage 0776\n" + self.sample().replace(
            "Final Passage", "Amendment No. 51/Table"
        ).replace("And so the bill passed.", "And so, the motion failed.")
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "776", "776", True, "AM NO 51 NOT TABLED")),
            4,
        )

    def test_tabled_accepts_publisher_table_label(self):
        text = "[[JOURNAL_ANCHOR:0776]]\nPage 0776\n" + self.sample().replace(
            "Final Passage", "Amendment No. 51/Table"
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "776", "776", True, "AM NO 51 TABLED")),
            4,
        )

    def test_tabled_parenthetical_does_not_reclassify_return_to_second_motion(self):
        generic = self.sample("Adams, Brown").replace(
            "Final Passage", "Return to Second for Amendments Reconsideration",
        )
        specific = self.sample("Evans, Fox").replace(
            "Final Passage", "Return to Second for Amendment No. 53 Reconsideration",
        )
        text = "[[JOURNAL_ANCHOR:2170]]\n" + generic + specific
        result = parse_roll_call(text, "HB1", (2, 1, 1), "2170", "2170", True,
                                 "(H) RETURN TO SECOND FOR AM 53(TABLED) FAILED Y2 N1 E1")
        self.assertEqual(result[:2], [("yes", "Evans"), ("yes", "Fox")])

    def test_procedural_question_can_precede_tally_by_more_than_800_characters(self):
        text = (
            "[[JOURNAL_ANCHOR:0228]]\nPage 0228\n"
            "Shall HB 1 be withdrawn from the Rules Committee?\n"
            + ("debate " * 130)
            + self.sample().replace("Final Passage", "Bill to Calendar from Rules")
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "228", "228", True, "WITHDRAW FROM RLS")),
            4,
        )

    def test_semantic_window_ignores_publisher_display_padding(self):
        text = (
            "[[JOURNAL_ANCHOR:0435]]\nPage 0435\n"
            "Rescind previous action in failing to adopt Amendment No. 12\n"
            + (" " * 5000)
            + self.sample().replace("Final Passage", "Rescind Previous Action")
        )
        self.assertEqual(
            len(parse_roll_call(text, "HB1", (2, 1, 1), "435", "435", True, "RESCIND ACTION")),
            4,
        )

    def test_numeric_page_anchor_ignores_publisher_leading_zeroes(self):
        text = "[[JOURNAL_ANCHOR:0366]]\n" + self.sample()
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "AM27", "366")), 4)

    def test_accepts_one_shared_roll_call_for_each_explicitly_named_bill(self):
        text = "HB 1 and HB 2\n" + self.sample().replace("HB 1\n", "", 1)
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1))), 4)
        self.assertEqual(len(parse_roll_call(text, "HB2", (2, 1, 1))), 4)

    def test_accepts_unique_procedural_call_only_when_official_url_is_bill_scoped(self):
        text = "[[JOURNAL_ANCHOR:673]]\nAdjournment motion\n" + self.sample().replace("HB 1\n", "", 1)
        with self.assertRaises(ValueError):
            parse_roll_call(text, "HB1", (2, 1, 1), "673")
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "673", None, True)), 4)

    def test_combines_two_complete_chamber_calls_for_published_joint_total(self):
        house = self.sample("Adams, Brown", counts="2   NAYS: 1   EXCUSED: 1   ABSENT: 0")
        senate = self.sample("Evans, Fox", counts="2   NAYS: 1   EXCUSED: 1   ABSENT: 0") \
            .replace("Nays: Clark", "Nays: Green").replace("Excused: Davis", "Excused: Hill")
        text = "[[JOURNAL_ANCHOR:3101]]\n" + house + senate + "TOTAL:  YEAS: 4 NAYS: 2 EXCUSED: 2 ABSENT: 0\n"
        result = parse_roll_call(text, "HB1", (4, 2, 2), "3101")
        self.assertEqual(len(result), 8)

    def test_accepts_plural_published_joint_totals_label(self):
        house = self.sample("Adams, Brown")
        senate = self.sample("Evans, Fox").replace("Nays: Clark", "Nays: Green").replace(
            "Excused: Davis", "Excused: Hill"
        )
        text = "[[JOURNAL_ANCHOR:0850]]\nPage 0850\n" + house + senate + (
            "[[JOURNAL_ANCHOR:0851]]\nPage 0851\n"
            "TOTALS: YEAS: 4 NAYS: 2 EXCUSED: 2 ABSENT: 0\n"
        )
        result = parse_roll_call(text, "HB1", (4, 2, 2), "850", "850", True,
                                 "(H) GOVERNOR VETO SUSTAINED Y4 N2 E2")
        self.assertEqual(len(result), 8)
        self.assertEqual(result[:2], [("yes", "Adams"), ("yes", "Brown")])

    def test_rejects_joint_total_with_missing_or_overlapping_chamber_positions(self):
        complete = self.sample("Adams, Brown")
        partial = self.sample("Evans")
        duplicate = self.sample("Adams, Fox")
        for second in (partial, duplicate):
            text = complete + second + "TOTAL: YEAS: 4 NAYS: 2 EXCUSED: 2 ABSENT: 0\n"
            with self.subTest(second=second), self.assertRaises(ValueError):
                parse_roll_call(text, "HB1", (4, 2, 2))

    def test_uses_numeric_page_fallback_when_publisher_fragment_is_missing(self):
        text = "[[JOURNAL_ANCHOR:2198]]\n" + self.sample()
        self.assertEqual(len(parse_roll_call(text, "HB1", (2, 1, 1), "AM8", "2198")), 4)

    def test_does_not_fallback_when_publisher_fragment_is_present_but_ambiguous(self):
        text = (
            "[[JOURNAL_ANCHOR:AM8]]\n" + self.sample()
            + "[[JOURNAL_ANCHOR:AM8]]\n" + self.sample()
            + "[[JOURNAL_ANCHOR:2198]]\n" + self.sample("Evans, Fox")
        )
        with self.assertRaises(ValueError):
            parse_roll_call(text, "HB1", (2, 1, 1), "AM8", "2198")

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
