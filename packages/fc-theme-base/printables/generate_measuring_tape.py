from pathlib import Path

import pymupdf


POINTS_PER_MM = 72 / 25.4
PAPERS = {"a4": (297, 210), "letter": (279.4, 215.9)}
STRIP_LENGTH_MM = 250
STRIP_WIDTH_MM = 26
STRIP_GAP_MM = 7
STRIPS_PER_PAGE = 4
STRIP_COUNT = 8
STRIP_TOP_MM = 54
TAB_LENGTH_MM = 8
CALIBRATION_TOP_MM = 192
INK = (0.06, 0.06, 0.07)
MUTED = (0.35, 0.35, 0.38)
ACCENT = (0.65, 0.10, 0.18)
BASE = Path(__file__).parent
FONT_FILES = {
    "body": BASE / "fonts" / "Inter-Regular.ttf",
    "bold": BASE / "fonts" / "Inter-Semibold.ttf",
    "display": BASE / "fonts" / "Archivo-Semibold.ttf",
}
FONTS = {name: pymupdf.Font(fontfile=str(path)) for name, path in FONT_FILES.items()}


def point(horizontal_mm, vertical_mm):
    return pymupdf.Point(horizontal_mm * POINTS_PER_MM, vertical_mm * POINTS_PER_MM)


def text(page, horizontal_mm, vertical_mm, width_mm, content, size=9, font="body", color=INK,
         height_mm=8, align=pymupdf.TEXT_ALIGN_LEFT, lineheight=1.35):
    rectangle = pymupdf.Rect(point(horizontal_mm, vertical_mm),
                             point(horizontal_mm + width_mm, vertical_mm + height_mm))
    rectangle.y1 += max(0, lineheight - FONTS[font].ascender) * size
    available = page.insert_textbox(
        rectangle,
        content,
        fontsize=size,
        fontname=font,
        color=color,
        align=align,
        lineheight=lineheight,
    )
    if available < -0.01:
        raise ValueError(f"Print text does not fit: {content}")


def new_page(document, paper):
    width_mm, height_mm = PAPERS[paper]
    page = document.new_page(width=width_mm * POINTS_PER_MM, height=height_mm * POINTS_PER_MM)
    for name, path in FONT_FILES.items():
        page.insert_font(fontname=name, fontfile=str(path))
    return page


def draw_brand(page, paper, page_number, large=False):
    width_mm, _ = PAPERS[paper]
    paper_label = "A4" if paper == "a4" else "US LETTER"
    logo_size = 19 if large else 13
    logo_top = 13 if large else 11
    page.insert_image(
        pymupdf.Rect(point(16, logo_top), point(16 + logo_size, logo_top + logo_size)),
        filename=str(BASE / "fencing-club-mark.png"),
    )
    text(page, 40 if large else 33, 15 if large else 13, 150, "FENCING CLUB",
         size=21 if large else 15, font="display", height_mm=10)
    text(page, width_mm - 80, 15 if large else 12, 64, f"{paper_label} / LANDSCAPE",
         font="bold", align=pymupdf.TEXT_ALIGN_RIGHT)
    text(page, width_mm - 60, 23 if large else 19, 44, f"{page_number:02d} / 03",
         size=10 if large else 9, align=pymupdf.TEXT_ALIGN_RIGHT)
    if large:
        text(page, 40, 25, 100, "SIZE & FIT", font="bold", color=MUTED)


def draw_instructions(page, paper):
    width_mm, _ = PAPERS[paper]
    paper_label = "A4" if paper == "a4" else "US Letter"
    compact = paper == "letter"
    divider_left = 176 if compact else 186
    aside_left = divider_left + 12
    aside_width = width_mm - aside_left - 16
    body_width = 145 if compact else 157
    draw_brand(page, paper, 1, large=True)
    page.draw_rect(pymupdf.Rect(point(16, 39), point(34, 40)), color=None, fill=ACCENT)
    text(page, 16, 46, width_mm - 32, "Make your measuring tape.", size=31, font="display", height_mm=15)
    text(page, 16, 63, 220, "A 200 cm tape for checking your measurements.", size=12, color=MUTED)
    text(page, 16, 80, 162, "Print at 100%. Check before cutting.", size=14, font="display")
    text(page, 16, 90, body_width,
         f"Use {paper_label} landscape paper and print all three pages single-sided at Actual size (100%). "
         "Turn off Fit to page and Shrink to fit.", size=11, height_mm=18)
    text(page, 16, 109, body_width,
         "Measure the check line with a rigid ruler. If it is not exactly 10 cm, correct the print settings and print again.",
         size=11, height_mm=18)
    steps = [
        ("Cut the strips", "Cut around the dashed outlines. Keep the shaded tabs."),
        ("Match the ends", "Join strips 1-8 in order. Match the cm end marks, overlap only the tabs, then tape each join."),
        ("Measure without pulling", "Let the paper sit snugly. Keep it flat and do not stretch it."),
    ]
    for index, (heading, instruction) in enumerate(steps):
        top = 136 + index * 20
        text(page, 16, top, 10, f"{index + 1:02d}", size=13, font="bold", color=ACCENT)
        text(page, 30, top, 140, heading, size=11, font="bold")
        text(page, 30, top + 6, 136, instruction, size=9.5, height_mm=12)
    page.draw_line(point(divider_left, 80), point(divider_left, 189), color=(0.79, 0.79, 0.77), width=0.6)
    text(page, aside_left, 80, aside_width, "You will need", size=14, font="display")
    text(page, aside_left, 91, aside_width, "Printer and paper\nScissors\nClear tape\nA rigid ruler",
         size=11, height_mm=31, lineheight=1.75)
    text(page, aside_left, 128, aside_width, "One continuous tape", size=14, font="display")
    text(page, aside_left, 139, aside_width, "200 cm", size=30, font="display", height_mm=14)
    text(page, aside_left, 154, aside_width, "8 strips / 7 joins\nCentimetres and inches", size=10,
         height_mm=14, color=MUTED, lineheight=1.6)
    text(page, aside_left, 177, aside_width, "10 cm check line on every cutting sheet.", size=9.5,
         height_mm=14, color=MUTED)
    text(page, 16, 200, 100, "fencing.club", size=8.5, font="bold")
    text(page, 115, 200, width_mm - 131, "Keep this page beside you while you assemble the tape.", size=8.5,
         color=MUTED, align=pymupdf.TEXT_ALIGN_RIGHT)


def measurement_label(page, left_mm, top_mm, local_mm, value):
    label_left = local_mm - 4
    alignment = pymupdf.TEXT_ALIGN_CENTER
    if local_mm < 4.8:
        label_left = 0.8
        alignment = pymupdf.TEXT_ALIGN_LEFT
    elif local_mm > STRIP_LENGTH_MM - 4.8:
        label_left = STRIP_LENGTH_MM - 8.8
        alignment = pymupdf.TEXT_ALIGN_RIGHT
    text(page, left_mm + label_left, top_mm, 8, str(value), size=8.5,
         height_mm=4, align=alignment)


def draw_strip(page, left_mm, top_mm, strip_index):
    start_mm = strip_index * STRIP_LENGTH_MM
    end_mm = start_mm + STRIP_LENGTH_MM
    has_tab = strip_index < STRIP_COUNT - 1
    end_x = left_mm + STRIP_LENGTH_MM
    cut_right = end_x + (TAB_LENGTH_MM if has_tab else 0)
    bottom_mm = top_mm + STRIP_WIDTH_MM
    text(page, left_mm, top_mm - 5.5, 100,
         f"{strip_index + 1:02d} / {start_mm // 10}-{end_mm // 10} cm", size=8, font="bold")
    if has_tab:
        page.draw_rect(
            pymupdf.Rect(point(end_x, top_mm), point(cut_right, bottom_mm)),
            color=None,
            fill=(0.93, 0.93, 0.92),
        )
        text(page, end_x + 0.5, top_mm + 9, 7, f"{strip_index + 2:02d}", size=10, font="bold",
             align=pymupdf.TEXT_ALIGN_CENTER)
        text(page, end_x + 0.5, top_mm + 15, 7, "TAB", size=5.5, align=pymupdf.TEXT_ALIGN_CENTER)
    page.draw_rect(
        pymupdf.Rect(point(left_mm, top_mm), point(cut_right, bottom_mm)),
        color=MUTED,
        width=0.4,
        dashes="[2.834646 2.834646] 0",
    )
    lines = page.new_shape()
    for millimeters in range(start_mm, end_mm + 1):
        local_mm = millimeters - start_mm
        tick_length = 1.7
        if millimeters % 10 == 0:
            tick_length = 5.5
        elif millimeters % 5 == 0:
            tick_length = 3.2
        horizontal_mm = left_mm + local_mm
        lines.draw_line(point(horizontal_mm, top_mm), point(horizontal_mm, top_mm + tick_length))
        if millimeters % 10 == 0:
            measurement_label(page, left_mm, top_mm + 6.2, local_mm, millimeters // 10)
    for eighth in range(int(STRIP_COUNT * STRIP_LENGTH_MM * 8 / 25.4) + 1):
        millimeters = eighth * 25.4 / 8
        if millimeters < start_mm - 0.000001 or millimeters > end_mm + 0.000001:
            continue
        tick_length = 1.7
        if eighth % 8 == 0:
            tick_length = 5.5
        elif eighth % 4 == 0:
            tick_length = 4
        elif eighth % 2 == 0:
            tick_length = 2.8
        local_mm = millimeters - start_mm
        horizontal_mm = left_mm + local_mm
        lines.draw_line(point(horizontal_mm, bottom_mm - tick_length), point(horizontal_mm, bottom_mm))
        if eighth % 8 == 0:
            measurement_label(page, left_mm, top_mm + 17, local_mm, eighth // 8)
    lines.finish(color=INK, width=0.4)
    lines.commit()
    page.draw_line(point(end_x, top_mm), point(end_x, bottom_mm), color=INK, width=0.8)
    text(page, left_mm + 8, top_mm + 12, 40, "cm / mm", size=6.5, color=MUTED)
    text(page, left_mm + 94, top_mm + 12, 60, "FENCING CLUB", size=7, font="bold", color=MUTED,
         align=pymupdf.TEXT_ALIGN_CENTER)
    text(page, left_mm + 202, top_mm + 12, 40, "in / 1/8", size=6.5, color=MUTED,
         align=pymupdf.TEXT_ALIGN_RIGHT)


def draw_cutting_sheet(page, paper, sheet_index):
    width_mm, _ = PAPERS[paper]
    left_mm = (width_mm - STRIP_LENGTH_MM - TAB_LENGTH_MM) / 2
    draw_brand(page, paper, sheet_index + 2)
    text(page, 16, 29, 190,
         f"Strips {sheet_index * 4 + 1}-{sheet_index * 4 + 4} / {sheet_index * 100}-{(sheet_index + 1) * 100} cm",
         size=18, font="display", height_mm=10)
    text(page, 16, 39, width_mm - 32, "Actual size (100%). Check the line below before cutting.", color=MUTED)
    for row in range(STRIPS_PER_PAGE):
        draw_strip(page, left_mm, STRIP_TOP_MM + row * (STRIP_WIDTH_MM + STRIP_GAP_MM), sheet_index * 4 + row)
    text(page, left_mm, 187, 100, "10 cm print-scale check", size=8.5, font="bold")
    page.draw_line(point(left_mm, CALIBRATION_TOP_MM + 1.5), point(left_mm + 100, CALIBRATION_TOP_MM + 1.5),
                   color=INK, width=0.8)
    for horizontal_mm in [left_mm, left_mm + 100]:
        page.draw_line(point(horizontal_mm, CALIBRATION_TOP_MM), point(horizontal_mm, CALIBRATION_TOP_MM + 3),
                       color=INK, width=0.8)
    text(page, left_mm, 197, 100, "Measure between the two end marks.", size=7.5, color=MUTED)
    text(page, width_mm - 129, 189, 109.5,
         "Cut dashed lines. Keep the tabs.\nJoin at matching cm marks; do not add a gap.",
         height_mm=11, lineheight=1.5, align=pymupdf.TEXT_ALIGN_RIGHT)
    text(page, width_mm - 89, 201, 69.5, "fencing.club", size=8, font="bold", align=pymupdf.TEXT_ALIGN_RIGHT)


def build_tape(destination, paper):
    paper_label = "A4" if paper == "a4" else "US Letter"
    document = pymupdf.open()
    document.set_metadata(
        {
            "title": f"Fencing Club printable measuring tape - {paper_label} landscape",
            "author": "Fencing Club",
            "subject": "200 cm measuring tape with centimetres, inches and a print-scale check",
        }
    )
    draw_instructions(new_page(document, paper), paper)
    for sheet_index in range(2):
        draw_cutting_sheet(new_page(document, paper), paper, sheet_index)
    document.xref_set_key(document.pdf_catalog(), "ViewerPreferences", "<< /PrintScaling /None >>")
    document.subset_fonts()
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    document.save(destination, garbage=4, deflate=True, no_new_id=True)
    document.close()


if __name__ == "__main__":
    for paper in PAPERS:
        output = BASE.parent / "assets" / f"measuring-tape-{paper}.pdf"
        build_tape(output, paper)
        print(output)