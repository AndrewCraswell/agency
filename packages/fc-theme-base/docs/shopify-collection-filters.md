# Shopify Collection Filters

The theme renders `collection.filters` supplied by Shopify Search & Discovery. Product options and metafield values
do not automatically become storefront filters. Enable each source under **Search & Discovery > Filters**.

## Sources

| Label | Shopify source | Data contract |
| --- | --- | --- |
| Availability | Availability | Native in-stock and out-of-stock values and counts. |
| Price | Price | Shopify hides this outside the store's default currency. |
| Gender | `custom.gender` | Mens, Womens, Kids or Unisex; retain the reviewed destination values. |
| Skill Level | `custom.skill_level` | Imported Beginner, Intermediate and Advanced merchandising values. |
| Color | Product option Color | Native swatch data first; recognized standard color names use representative swatches. |
| Safety Level | `custom.protection_rating` | Explicit 350N, 800N or 1600N source claims, scoped to relevant products. |
| FIE Rating | `custom.fie_status` | FIE or Non-FIE only where supported; an unset field means unknown, not Non-FIE. |
| Weapon | `custom.weapon` | Existing list of Foil, Epee and Saber values; preserve multi-discipline applicability. |
| Brand | Vendor | Public-facing brand, never the internal supplier metafield. |

This order follows the live Fencing Club storefront, except that its mixed Safety Level source is replaced by
separate Safety Level and FIE Rating filters. Size and Sub-category are not enabled in the source configuration;
their rendering support remains available without displaying the long combined size list by default.

The migration builder includes public product definitions for Weapon, Gender, Skill Level, Safety Level and FIE Rating.
It does not enable Search & Discovery sources or populate those fields. Existing values without definitions must
be reviewed before exposing them. Fields remain absent on products where no reliable classification is available.

Size filters render the shared `ui-choice` pills as native checkboxes, preserving multi-select behavior and literal
Shopify values. Routing uses `filter.v.option.size`, not the editable filter heading. Long shoe-size labels wrap.
Color/Colour option filters use the shared `swatch-input` and `swatch` components. Native swatch images and RGB data
take priority; a limited allowlist of standard color names and two-color slash pairs provides representative colors
when Shopify supplies only a name. Clear uses a transparency pattern. These are not manufacturer color matches.
Unrecognized colors without native swatch data are omitted, and Color groups with no displayable options are hidden.
An unsupported color already selected through a URL remains a labelled, selected choice so it can be removed.
Other filter types keep their existing checkbox presentation.

Like `fc-theme`, filter groups start expanded and can be collapsed. Unselected zero-count options and empty groups
are omitted. Selected zero-count options remain visible and enabled so they can be removed, including on empty-result
pages. Filter choice and ordering come from Shopify, not a hardcoded per-collection allowlist. The source inspection
used read-only public collection markup; app-only grouping/settings were not changed on the source store.

## Classification

The September 12 Contoso rehearsal separated the 12 former `Kids` product types into Weapons, Masks, Training Vests,
Starter Kits and Points, based on their descriptions. Their audience remains Kids in the Fit attribute, including
the Kids Novus jacket and pants. Existing Men/Women fit values use the approved Mens/Womens labels. Product IDs,
handles, descriptions, variants, publication status and collection membership are not rewritten for this change.

Protection rating and FIE status are deliberately separate. The old `custom.safety_level` mixes ratings with
approval labels and contains conflicting or insufficient claims; it is not a filter source. In particular, the plain
Mens chest protector's FIE label does not establish approval of the shell without its separately sold padded cover.
New FIE values use a reviewed list of explicit descriptions, not a title-matching or blanket migration rule.
Source claims are not independent certification verification, and no new compliance guarantee is made.

Skill Level reuses the existing `custom.skill_level` values, matching the source store. These are merchandising
classifications, not safety recommendations; no values are inferred from sparse tags. Blade size currently has only
one value, so it provides no useful narrowing. Contextual handedness, stiffness and wiring remain optional follow-up
filters, not global defaults.

## Acceptance And Migration

Verify actual filtered product counts and selected values on desktop and mobile, combined filters with sorting,
and Clear all returning to the unfiltered collection. The component lab is not evidence that Shopify sources are
configured. The Clothing design's sidebar is a presentation reference, not authoritative product classification.

Contoso product curation is not a live-store migration. Local rehearsal evidence and the guarded plan are in
`tmp/filter-catalog-current.json`, `tmp/collection-filter-plan.json`, and `tmp/collection-filter-verified.json`.
Reconcile the reviewed assignments with the live source before an explicitly authorized cutover. Do not import
Contoso products into the live shop or overwrite source records using development-store IDs.