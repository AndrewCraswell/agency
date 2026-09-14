# Shopify Catalog Rehearsal

The catalog tooling copies Fencing Club products into Contoso for realistic development acceptance. It is separate
from theme migration: the live shop already owns its catalog and must not import Contoso products back.

## Boundaries

- Confirmed source: `8f3f5f-3.myshopify.com`, primary domain `fencing.club`. Source access is read-only.
- Write destination: `contosocamp.myshopify.com` only. Both import and finalization refuse any other destination.
- The captured source has 204 products and 606 images. The importer preserves existing destination products.
- After explicit approval, the 29 original Contoso demo products were deleted on September 11, 2026, using their
  captured IDs and verified handles. All 204 imported products remain. The home page now selects imported products
  and links to their real collections. This cleanup is separate from the importer's create-only contract.
- No customers, orders, credentials, fulfillment configuration, or source stock quantities are copied.
- Titles, descriptions, SEO, and option copy use Mens, Womens, Kids without apostrophes. Handles and SKUs stay literal.
- Products start as drafts with tracked zero stock and the current product template. Gift cards and subscription-only
  products are rejected. Missing or truncated nested data fails closed; no partial source product is imported.
- Native bundle relationships are captured separately. The 21 bundle products contain 45 parent variants and 93
  component references. Destination IDs are resolved through exact option values and SKUs; component quantities
  are preserved. Shopify recalculates bundle prices on attachment, so verified draft bundles get source prices restored.

## Commands

Run from the repository root with authenticated Shopify CLI sessions:

```powershell
pnpm --filter @repo/shopify-content cli snapshot-catalog --store 8f3f5f-3.myshopify.com --out ../../tmp/source-catalog.json
pnpm --filter @repo/shopify-content cli import-catalog ../../tmp/source-catalog.json --store contosocamp.myshopify.com
```

The snapshot is a new local file and retains raw source fields for audit. It is not a portable manifest and must not
be bundled into the live-store theme package. `import-catalog` plans all products before writing. Add
`--confirm-store contosocamp.myshopify.com` to create missing drafts. Existing handles are kept, never updated or deleted.
Import output records created IDs and exclusions. Inspect remote state before rerunning an ambiguous request.

`finalize-catalog` takes the source snapshot, collection content, exact source bundle captures, explicit chart mapping,
destination location and Online Store publication. It verifies all product copy, variants, prices, and ready media;
restores missing components; restores source draft-bundle prices; assigns the 26 charts; seeds 20 units only for
zero-stock non-bundle items using `changeFromQuantity: 0`; attaches captured collection memberships; then activates
and publishes products according to source status. It never publishes a theme. Nonzero stock is preserved on rerun.

```powershell
pnpm --filter @repo/shopify-content cli finalize-catalog ../../tmp/source-catalog.json --content ../fc-theme-base/content/collections-source.json --bundles ../../tmp --assignments ../fc-theme-base/content/chart-assignments.json --store contosocamp.myshopify.com --confirm-store contosocamp.myshopify.com --location gid://shopify/Location/94863982776 --publication gid://shopify/Publication/218077561016
```

Bundle files must be named `migration-bundle-{source-product-handle}.json`; their product IDs must match the source.
The command loads only expected bundle handles, never unrelated diagnostic files from the directory.

## Exclusions And Acceptance

Portable scalar fields in `custom`, `structured_data`, and `reviews` are copied. App-owned option configuration,
review-widget HTML, advertising integration fields, and source-specific reference metafields remain in the raw
snapshot and are reported as exclusions. They are not valid cross-store configuration. The old Page-based sizing
field is replaced by the explicit mapping to installed chart metaobjects. Native bundle relationships are restored,
but installing third-party apps and recreating their configuration is not part of this catalog copy.

Product images are imported into Shopify Files; source products without images remain without images. Collection
membership is a reproducible snapshot, not a reproduction of source smart rules or app configuration. Existing
Contoso collections retain their own sources and receive a separate captured-membership source.

Before signoff, inspect real product pages and drawers at desktop/mobile widths, test keyboard close/focus return,
verify variant/quantity preservation, and follow menu routes. A fixture product does not replace real-store acceptance.
Run focused catalog tests/types/lint and the repository's required `pnpm verify`.