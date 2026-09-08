import tempfile
import unittest
from pathlib import Path

import pymupdf

from generate_measuring_tape import (
    CALIBRATION_TOP_MM,
    PAPERS,
    POINTS_PER_MM,
    STRIP_COUNT,
    STRIP_GAP_MM,
    STRIP_LENGTH_MM,
    STRIP_TOP_MM,
    STRIP_WIDTH_MM,
    TAB_LENGTH_MM,
    build_tape,
)


class MeasuringTapeTest(unittest.TestCase):
    def test_paper_dimensions_and_print_scaling(self):
        with tempfile.TemporaryDirectory() as directory:
            for paper, (width_mm, height_mm) in PAPERS.items():
                path = Path(directory) / f"{paper}.pdf"
                build_tape(path, paper)
                with pymupdf.open(path) as document:
                    self.assertEqual(len(document), 3)
                    self.assertIn("/PrintScaling/None", document.xref_get_key(document.pdf_catalog(), "ViewerPreferences")[1].replace(" ", ""))
                    for page in document:
                        self.assertAlmostEqual(page.rect.width / POINTS_PER_MM, width_mm, places=3)
                        self.assertAlmostEqual(page.rect.height / POINTS_PER_MM, height_mm, places=3)

    def test_actual_pdf_tick_spacing_and_calibration(self):
        with tempfile.TemporaryDirectory() as directory:
            for paper, (width_mm, _) in PAPERS.items():
                path = Path(directory) / f"{paper}.pdf"
                build_tape(path, paper)
                with pymupdf.open(path) as document:
                    left = (width_mm - STRIP_LENGTH_MM - TAB_LENGTH_MM) / 2
                    for sheet_index, page in enumerate(list(document)[1:]):
                        lines = [item for drawing in page.get_drawings() for item in drawing["items"] if item[0] == "l"]
                        for row in range(4):
                            top = STRIP_TOP_MM + row * (STRIP_WIDTH_MM + STRIP_GAP_MM)
                            start = (sheet_index * 4 + row) * STRIP_LENGTH_MM
                            metric_ticks = sorted(
                                item[1].x / POINTS_PER_MM - left
                                for item in lines
                                if abs(item[1].y / POINTS_PER_MM - top) < 0.001
                                and 1 < (item[2].y - item[1].y) / POINTS_PER_MM < 6
                            )
                            self.assertEqual(len(metric_ticks), 251)
                            for index, position in enumerate(metric_ticks):
                                self.assertAlmostEqual(position, index, places=3)
                            imperial_ticks = sorted(
                                item[1].x / POINTS_PER_MM - left + start
                                for item in lines
                                if abs(item[2].y / POINTS_PER_MM - (top + STRIP_WIDTH_MM)) < 0.001
                                and 1 < (item[2].y - item[1].y) / POINTS_PER_MM < 6
                            )
                            expected = [eighth * 25.4 / 8 for eighth in range(631)
                                        if start <= eighth * 25.4 / 8 <= start + STRIP_LENGTH_MM]
                            self.assertEqual(len(imperial_ticks), len(expected))
                            for actual, wanted in zip(imperial_ticks, expected):
                                self.assertAlmostEqual(actual, wanted, places=3)
                        calibration = [item for item in lines
                                       if abs(item[1].y / POINTS_PER_MM - (CALIBRATION_TOP_MM + 1.5)) < 0.001
                                       and abs(item[2].y - item[1].y) < 0.001]
                        self.assertEqual(len(calibration), 1)
                        self.assertAlmostEqual((calibration[0][2].x - calibration[0][1].x) / POINTS_PER_MM, 100, places=3)

    def test_strip_order_and_page_content_within_printable_margins(self):
        with tempfile.TemporaryDirectory() as directory:
            for paper in PAPERS:
                path = Path(directory) / f"{paper}.pdf"
                build_tape(path, paper)
                with pymupdf.open(path) as document:
                    for page_index, page in enumerate(document):
                        content = page.get_text()
                        self.assertIn("FENCING CLUB", content)
                        self.assertIn(f"{page_index + 1:02d} / 03", content)
                        if page_index:
                            for row in range(4):
                                index = (page_index - 1) * 4 + row
                                self.assertIn(f"{index + 1:02d} / {index * 25}-{(index + 1) * 25} cm", content)
                        for block in page.get_text("blocks"):
                            self.assertGreaterEqual(block[0], 10 * POINTS_PER_MM)
                            self.assertGreaterEqual(block[1], 6 * POINTS_PER_MM)
                            self.assertLessEqual(block[2], page.rect.width - 10 * POINTS_PER_MM)
                            self.assertLessEqual(block[3], page.rect.height - 5 * POINTS_PER_MM)

    def test_seven_tabs_and_embedded_brand_fonts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "a4.pdf"
            build_tape(path, "a4")
            with pymupdf.open(path) as document:
                self.assertEqual(STRIP_COUNT * STRIP_LENGTH_MM, 2000)
                self.assertEqual(sum(page.get_text().count("TAB") for page in document), 7)
                self.assertIn("Make your measuring tape.", document[0].get_text())
                fonts = document[0].get_fonts()
                self.assertTrue(any("Archivo" in font[3] for font in fonts))
                self.assertTrue(any("Inter" in font[3] for font in fonts))
                for font in fonts:
                    self.assertTrue(document.extract_font(font[0])[3])
                self.assertEqual(len(document[0].get_images()), 1)

    def test_measurement_numerals_stay_inside_strips_and_do_not_overlap(self):
        with tempfile.TemporaryDirectory() as directory:
            for paper, (width_mm, _) in PAPERS.items():
                path = Path(directory) / f"{paper}.pdf"
                build_tape(path, paper)
                left = (width_mm - STRIP_LENGTH_MM - TAB_LENGTH_MM) / 2 * POINTS_PER_MM
                right = left + STRIP_LENGTH_MM * POINTS_PER_MM
                with pymupdf.open(path) as document:
                    for page in list(document)[1:]:
                        numerals = [
                            span
                            for block in page.get_text("dict")["blocks"]
                            for line in block.get("lines", [])
                            for span in line["spans"]
                            if span["text"].isdigit() and abs(span["size"] - 8.5) < 0.01
                        ]
                        self.assertGreater(len(numerals), 120)
                        for span in numerals:
                            self.assertGreater(span["bbox"][0], left)
                            self.assertLess(span["bbox"][2], right)
                        for index, first in enumerate(numerals):
                            for second in numerals[index + 1:]:
                                first_box = pymupdf.Rect(first["bbox"])
                                second_box = pymupdf.Rect(second["bbox"])
                                self.assertTrue((first_box & second_box).is_empty,
                                                f"Numerals overlap: {first['text']} and {second['text']}")


if __name__ == "__main__":
    unittest.main()