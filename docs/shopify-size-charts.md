# Shopify Size Charts

The Dawn theme renders editable `size_chart` metaobjects through one shared Liquid snippet and JavaScript component.
Use [the content installer](shopify-content-installation.md) to create the definitions, guides, size entries, and
initial draft charts. The theme does not embed copies of the published measurements in its templates.

## Pages and Product Assignment

- Assign the `size-charts` Page template to the directory page at `/pages/size-charts`. It shows grouped chart links,
  not sizing tables or measuring diagrams.
- The `templates/metaobject/size_chart.json` template displays each active chart at its Shopify-generated URL, such
  as `/pages/size-charts/mens-jackets`. Links use `chart.system.url`, not a manually maintained route list.
- Both templates place a separate **Page breadcrumbs** section before their main content. The sizing directory
  and chart sections do not render breadcrumbs themselves. The breadcrumb section uses the Page or chart title;
  its optional parent page defaults to the shared sizing directory on chart pages.
- Add the **Size chart** block to the product section; it is included in the default product template. Assign the
  product's `custom.size_chart` metafield to one chart record. Products without a complete, published assignment
  have no customer-facing size-chart trigger. The editor shows an assignment reminder instead.
- The chart page and product drawer both render `snippets/size-chart-content.liquid`. The drawer uses one heading,
  `Size chart: {chart.title}`, with no product subtitle or repeated body title. Supported units appear above the size
  selectors; charts without imperial values have no empty title/units row. Full pages retain their chart heading.
  Table regions are labelled by their captions in both contexts. Product variants and quantities are untouched.

Definitions must exist before the theme's custom metaobject settings can be used on a new store. Install the draft
content first, then upload the theme and verify the store preview before publishing. Upload the product section
schema before templates that use its new block when using incremental theme uploads.

## Merchant Controls

**Content > Metaobjects** holds measurement values, size labels, chart titles/categories, guide illustrations and
alternative text, measuring instructions, and fit advice. Each chart references an ordered list of size entries
and a shared guide. Published values remain literal strings, including ranges and inequalities. Unit conversion
is not inferred: the inch switch appears only when complete published imperial data exists.

**Size charts directory section** controls the page heading and one, two, or three columns on larger screens.
An empty heading uses the Page title. Phones always use one column; the three-column setting starts at desktop width.
The product block label is configurable in the product template.

**Content > Metaobjects > Size chart group** owns the menu-aligned headings: Masks, Jackets, Pants, Gloves,
Underarm Protectors, Chest Protectors, and Footwear. Jackets and Pants remain separate chart families within
uniforms. Footwear contains the two published sock charts; no shoe chart is inferred.

- **Heading** changes the displayed group name without renaming charts or changing their category values.
- **Chart selection: category** includes charts matching **Category to match**. Keep this value unchanged when only
  renaming the displayed heading. New matching active charts appear automatically when the chart catalog is unset.
- **Chart selection: manual** uses **Charts in display order**, including its order. An empty manual group stays empty.

In **Theme settings > Size charts > Groups in display order**, select groups, use their reorder handles, then Save.
This one list controls the directory and each chart's sidebar. Remove a group from the list to omit it from these
views without deleting the charts or their product assignments. When the list is empty, groups come directly from
chart categories. Empty or invalid groups are not rendered.

**Charts in display order** optionally limits and orders the candidates for category groups. Leave it empty to use
active charts automatically. Manual groups use their own selected charts instead. Both pickers support up to 50
entries. Directory page, default measurement units, and printable-tape visibility remain shared theme settings.

Always use **Mens**, **Womens**, and **Kids**, without apostrophes, in Fencing Club copy, including chart titles,
breadcrumbs, drawer headings, size-entry names, and measurement labels such as **US Mens size**.
Each chart has an optional **Navigation label**. Jacket, pants, and chest protector links use these short labels;
full chart titles add the equipment name in page headings, breadcrumbs, and drawers. Leave the navigation
label empty to use the full title. The separate Shopify sizing menu is installation content, not the directory's
runtime source; editing its items does not change these groups.

`size-chart-validity.liquid` checks types, required values, unique measurement keys and entry references, label/key
counts, imperial completeness, guide assets, and the 50-size limit. Consumers strip whitespace from the captured
result because Shopify can emit a carriage return before `true`. Invalid charts are excluded from the directory
and product triggers; an invalid chart page shows an unavailable state rather than an incomplete table. A catalog
with no valid groups shows the empty state instead of an empty container.

## Behavior

- Comparison starts with the first two sizes. Buttons toggle table columns using `aria-pressed`, wrapping only when
  the available width requires it. Size columns use their intrinsic content width; they do not divide or fill the
  available page width. Values remain on one line on screen. The table scrolls horizontally with sticky measurement
  labels when necessary. In the drawer, row dividers extend across unused width through an empty CSS-generated
  trailing area, without adding blank data cells or stretching selected sizes. This decoration is omitted in print;
  full-page charts retain their content-sized table.
- Chart URLs preserve `unit=cm|in` and repeated `size={entry-handle}` parameters. `size=` represents an intentionally
  empty selection. Invalid values fall back to supported defaults. Flyout selections are carried into **View full
  chart**, not written to the product URL. The full-chart navigation is an icon-enabled `ui-link` in the persistent
  drawer footer, not a button or a link buried in the chart body. Each chart references its footer link by a unique
  ID so multiple drawer instances update only their own destinations. No body-measurement calculator or automatic
  variant selection exists.
- Desktop uses grouped monochrome category navigation; tablet/mobile use a **Browse size charts** disclosure.
  Breadcrumbs link Home, Size charts, and the current chart. There is no duplicate All size charts sidebar link.
  Sidebar chart links are text-only; bold text and `aria-current` identify the current chart. Category disclosure
  chevrons and the root directory's link arrows remain.
- Measuring illustrations are at most 280px wide with their original proportions. Wide chart content places the
  instructions alongside the image; smaller content areas stack them. Fit advice follows inside **How to measure**.
  **Printable measuring tape** is a separate, initially closed accordion on both pages and flyouts. A4 and US Letter
  links use `ui-link` with its arrow icon, standard hover/focus treatment, and no underline at rest. They remain
  separate 32px rows with no extra gap. Links inherit the theme focus ring instead of a sizing-specific override.
  There is no divider between the two accordions. Hiding downloads removes the entire printable-tape accordion.
- The product view uses the [shared drawer](shopify-drawers.md), with a 250ms panel slide and backdrop fade on open
  and close. Reduced motion skips transitions. Native focus containment and scroll locking remain active through
  dismissal, then focus returns to the trigger. The header and compact footer stay visible while the body scrolls.
  Without JavaScript the trigger is a normal link to the assigned chart page. Closing and reopening preserves chart selections.
- Initial HTML contains all size columns, and help is open without JavaScript. Printing includes every size column,
  expands help, and hides interaction controls. Screen-only column hiding never discards measurement data.

## Verification

Run `pnpm --filter @repo/fc-theme-base test:coverage` and Shopify Theme Check, then the required `pnpm verify`.
The Liquid tests render all 13 packaged charts through the production snippets; interaction tests cover selections,
unit/deep-link state, printing, navigation, dialog focus restoration, and cleanup.

For an isolated browser preview, run `node packages/fc-theme-base/tests/preview-size-charts.mjs`. It prints a local URL
on a free port and renders the production Liquid/CSS/JS using packaged data. Its minimal header and product fixture
are test-only. Follow the directory links or open `/products/sizing-fixture?variant=123` to test the dialog. This does
not replace acceptance in the actual Shopify development theme with installed, active metaobjects.

The Pencil size-chart drawer master and its responsive examples mirror the single heading, independent help/tape
accordions, compact comparison columns with full-width rules, and persistent icon-link footer. Static design views
document the shared drawer's motion contract; browser acceptance verifies the actual animation and focus behavior.

Contoso's directory Page and all 13 chart records are now published for development acceptance. All 94 size entries
were compared with the Shopify-rendered pages, including the approved imperial values. The clothing mega-menu and
Support sizing links target the directory; Shopify-hosted images and both PDFs return successfully. This does not
publish the Fencing Club theme, import products, complete product assignments, or constitute a physical print test.