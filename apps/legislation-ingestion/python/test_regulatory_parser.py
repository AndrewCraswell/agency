import unittest

from regulations.parse_xml import reviewed_fr_duplicate_paths, reviewed_fr_missing_identity


def context(native_id: str, artifact_hash: str):
    return {"unit": {"nativeId": native_id}, "artifactHash": artifact_hash}


class RegulatoryParserSourceReviewTests(unittest.TestCase):
    def test_missing_identity_review_is_bound_to_exact_source_and_locator(self):
        reviewed = context(
            "FR-2021-11-19",
            "2b7290a3508d8d04859fb949a60323b58707f9c9429aeaa4fedd235da0abaa28",
        )
        locator = "/FEDREG[1]/NEWPART[1]/RULES[1]/RULE[1]"
        self.assertEqual(reviewed_fr_missing_identity(reviewed, locator), "2021-23972")
        self.assertIsNone(reviewed_fr_missing_identity(reviewed, locator.replace("RULE[1]", "RULE[2]")))
        self.assertIsNone(reviewed_fr_missing_identity(context("FR-2021-11-19", "0" * 64), locator))

    def test_duplicate_reviews_select_only_the_redundant_exact_source_node(self):
        cases = [
            (
                "FR-2020-07-24",
                "d4decec3457dda3b235e7ddfe606422e58d184bb46732ee6ebab32bfe9d1e849",
                "/FEDREG[1]/NOTICES[1]/NOTICE[75]",
            ),
            (
                "FR-2022-11-22",
                "33cbc83a1e4f42f5deeb56b94560c3c256701e8344d0d41c6b9df1a175b794b6",
                "/FEDREG[1]/NOTICES[1]/NOTICE[51]",
            ),
            (
                "FR-2023-01-09",
                "be4bf01bd8e7b975c32cf75ff97cfe0730ec58197640ab6d8b61957f6414b922",
                "/FEDREG[1]/NOTICES[1]/NOTICE[12]",
            ),
        ]
        for native_id, artifact_hash, locator in cases:
            with self.subTest(native_id=native_id):
                self.assertEqual(reviewed_fr_duplicate_paths(context(native_id, artifact_hash)), {locator})
                self.assertEqual(reviewed_fr_duplicate_paths(context(native_id, "0" * 64)), set())


if __name__ == "__main__":
    unittest.main()
