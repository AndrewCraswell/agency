# Printable Measuring Tape

Original Fencing Club measuring tape, supplied as three-page landscape A4 and US Letter PDFs. A branded instruction
page is followed by two cutting sheets. Eight 25 cm strips join into a 200 cm tape with seven 8 mm overlap tabs.
The top scale has millimetres and centimetres; the bottom scale has inches and eighth-inch marks.

Print all three pages single-sided at **100% / Actual size**, on the stated paper format in landscape orientation.
Do not use Fit to page. Check the 10 cm calibration line on each cutting sheet with a rigid ruler before cutting.
Join matching numbered end lines and overlap only the shaded tabs. Paper and taped
joins can stretch, so keep the tape snug and check the scale again after assembly.

The PDF stores dimensions in physical points and requests `/PrintScaling /None`. Printer dialogs can override that
preference; the user must still verify the printed calibration line. File geometry checks are not a physical print test.

## Regenerate

Requires Python and PyMuPDF, already available in the design environment. Bundled Archivo and Inter fonts match the
theme typography and are embedded in each PDF. Their licenses and provenance are in [fonts/README.md](fonts/README.md).
The generator, fonts, and logo are self-contained in this directory. Matching editable print artboards remain in
[FencingClubWebsite.pen](../../fc-theme/FencingClubWebsite.pen).

```powershell
python packages/fc-theme-base/printables/generate_measuring_tape.py
python -m unittest discover -s packages/fc-theme-base/printables -p "test_*.py"
```

Generation writes directly to [the A4 PDF](../assets/measuring-tape-a4.pdf) and
[the US Letter PDF](../assets/measuring-tape-letter.pdf). They ship with the theme's assets; no Shopify Files upload
or store-specific URL is needed.

## Storefront Integration

The shared [measuring-tape-downloads snippet](../snippets/measuring-tape-downloads.liquid) owns both asset URLs,
accessible download names, and print guidance. It uses ordinary links and works without JavaScript.

The shared chart renderer includes these links in an independent **Printable measuring tape** accordion after
**How to measure** on individual chart pages and in product size-chart drawers. There is no divider between these
accordions. The root `size-charts` page is a directory without measurement help. Ordinary pages and
generic product popups do not inject the PDFs. Theme settings can hide the links across both chart contexts.

A4 and US Letter are separate 32px rows with no additional gap. No chart values or per-product download URLs are
duplicated. See [the sizing runtime guide](../../../docs/shopify-size-charts.md) for metaobject and product assignment
setup. Browsers may open a PDF viewer instead of downloading when Shopify serves assets from a different origin;
the viewer's download command remains available.