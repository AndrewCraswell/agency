# Fencing Club Content Pack

This directory holds approved Fencing Club content to install when migrating the existing shop to the new theme.
It is not optional demo content or a snapshot of development-store resource IDs. The same portable bundle supports
rehearsals in Contoso without treating the migration as a new shop.
Use [the installation guide](../../../docs/shopify-content-installation.md) for validation, packaging, planning,
authentication, and explicit application.

- `sizing-source.json` holds the approved chart values, guide text, and fit advice captured from the published
  Fencing Club charts and approved design on September 6, 2026. Do not normalize gaps, overlaps, shoe-size scales,
  or source rounding. Measurement strings include ranges and inequalities, so they are not all plain decimals.
- `build-manifest.mjs` generates `manifest.json`. Regenerate with `pnpm --filter @repo/fc-theme-base content:build`.
- `media/` contains the approved graphite guide illustrations. The sock image includes A/B labels from the design.
- `manifest.json` is the generated install artifact. It contains references by stable resource keys, not store IDs.

The size-entry definition uses named measurement fields so merchants edit values using native forms. A chart stores
ordered field keys and their displayed labels, plus an ordered list of size-entry references. The renderer must verify
label/key counts and supported units before rendering. Illustrations and instructions are shared guide records.
Per-product assignment is the `custom.size_chart` metaobject-reference field. The sizing-only artifact has no
product assignments; the complete migration artifact contains 26 explicit assignments from the source Page references.

The pack also contains seven menu-aligned `size_chart_group` records: Masks, Jackets, Pants, Gloves,
Underarm Protectors, Chest Protectors, and Footwear. Footwear contains the two published sock charts. Each has an
editable heading and category match. The group definition also supports manually selected charts in display order.
Select and reorder groups in the theme's **Groups in display order** setting; that setting is shared by the directory
and chart sidebar and is not applied by the content installer. Jacket, pants, and chest protector chart records
have short `navigation_label` values Kids, Mens, or Womens. These spellings, without apostrophes, apply to all
titles, entry names, and sizing references as well. Source measurements and stable handles are unchanged.

## Adding Content

Add definitions and entries to the manifest builder for additional reusable content. Pages and menus can be declared
as resources using existing adapter kinds. Independent packs may use the same definition resource keys; definitions
are matched by type on the destination and checked for compatibility. Keep every dependency within a pack, or combine
the resource arrays before validation. There is no implicit lookup by development-store ID or product title.

The sizing-only pack creates a separate `size-charts` menu in the same order as `sizing-source.json` groups.
`build-migration.mjs` adds `navigation-source.json`, `chart-assignments.json`, `pages-source.json`,
`collections-source.json`, and `journal-source.json` to produce the complete 248-resource `migration-manifest.json`.
It also defines the product filter fields `custom.weapon` (Weapon), `custom.gender` (Gender),
`custom.skill_level` (Skill Level), `custom.protection_rating` (Safety Level) and `custom.fie_status` (FIE Rating). Definitions do not populate missing product values or enable
Search & Discovery filters. See [collection filters](../../../docs/shopify-collection-filters.md).
`theme-configuration.json` contains the separate menu-attachment and ordered-group settings. Creating records
and attaching them to the theme are separate steps.
For a store-specific product assignment, add a `product-chart-assignment` resource with explicit `productHandle`,
`namespace: "custom"`, `key: "size_chart"`, and `value: { "$ref": "chart.mens-jackets" }`.
Changing the pack does not overwrite an installed record unless its resource key is explicitly approved with
`--replace`. Reconcile approved Shopify edits before migration; content edited in Contoso is not automatically
exported into this package. Preserve existing store data and unrelated configuration during theme cutover.

`capture-migration.mjs` rebuilds the approved page/collection/journal source files from explicitly supplied offline
captures. It is a capture-time tool, not an installation step. The About us HTML preserves the published story.
Collection membership is a catalog snapshot; existing destination collections are reused without replacing rules.
The 26 chart mappings are explicit product handles, grounded in their source sizing Page references.

Charts and the root page are initially unpublished. The theme includes the shared chart templates and product
flyout; see [the sizing runtime guide](../../../docs/shopify-size-charts.md). Verify those templates on the destination
store before publishing content. The measuring-tape PDFs ship in the theme's assets directory and are not duplicated
in Shopify Files by this pack.