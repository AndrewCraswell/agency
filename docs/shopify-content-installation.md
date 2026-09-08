# Shopify Content Installation

`@repo/shopify-content` installs declarative content manifests using an authenticated Shopify CLI session.
The theme ZIP and content bundle are separate artifacts: Shopify does not run an installer when a theme is uploaded.
Theme deployment, theme settings, attaching menus, and publishing remain explicit operations outside this command.

## Fencing Club Migration

This theme is being built specifically for the existing Fencing Club shop, not as a generic theme with optional
demo content. Its approved main menu, footer menus, size charts, and supporting content are required migration
deliverables. Portability supports rehearsal in Contoso and installation into Fencing Club; it does not make the
brand's content optional or require recreating the existing shop.

- Package the approved main menu and footer menu trees, including their destination references.
- Package sizing definitions, charts, size entries, guides, illustrations, directory page, and explicit product-chart
	assignments. Include other approved pages and content needed by the theme, preserving published legal wording.
- Record and apply the destination-specific theme settings, menu attachments, page templates, and chart catalog.
	Creating records alone is not a complete installation; these wiring steps are separate from the current installer.
- Reconcile existing store records and merchant edits before cutover. Resolve destination IDs, reuse matching
	records, and approve necessary replacements explicitly. A theme switch must not reset products, customers,
	orders, credentials, or unrelated configuration. Publishing and live-store writes require explicit authorization.

The complete `migration-manifest.json` contains 243 resources: the 131-resource sizing baseline, five main/footer
menus, 26 explicit chart assignments, seven support/policy pages, 73 collections, and the approved journal with
its articles. `theme-configuration.json` supplies menu attachments, directory page, and ordered sizing groups.
Catalog rehearsal is separate; see [Shopify catalog rehearsal](shopify-catalog-rehearsal.md).
Shopify edits do not sync back to the pack: reconcile approved content changes before the Fencing Club installation.

## Commands

Run from the repository root on Node 24+ and pnpm 11+:

```powershell
pnpm --filter @repo/fc-theme-base content:build
pnpm --filter @repo/shopify-content cli validate ../fc-theme-base/content/manifest.json
pnpm --filter @repo/shopify-content cli pack ../fc-theme-base/content/manifest.json --out ../../tmp/fencing-club-content
```

For the complete migration, generate the artifact with `node packages/fc-theme-base/content/build-migration.mjs`
and pass `migration-manifest.json` instead. The source JSON files are already captured; do not recapture them during
installation. The theme ZIP supplies templates, FAQ blocks, scripts, artwork, and printable PDFs.

The output directory must not exist. A bundle contains its own manifest and media, with no source-store IDs,
credentials, or paths outside the bundle. The CLI resolves file resources relative to the manifest directory.
`pack` bundles content only; run the theme's separate `package` command for its ZIP.

Authenticate once for the explicit destination, requesting only scopes needed for the resource kinds being installed:

```powershell
shopify store auth --store your-store.myshopify.com --scopes read_metaobject_definitions,write_metaobject_definitions,read_metaobjects,write_metaobjects,read_products,write_products,read_files,write_files,read_content,write_content,read_online_store_navigation,write_online_store_navigation
pnpm --filter @repo/shopify-content cli plan ../fc-theme-base/content/manifest.json --store your-store.myshopify.com
pnpm --filter @repo/shopify-content cli apply ../fc-theme-base/content/manifest.json --store your-store.myshopify.com --confirm-store your-store.myshopify.com
```

`validate` is entirely offline. `plan` reads but cannot write. `apply` requires the destination twice, prints a fresh
plan, then rechecks destination resources before writing. GraphQL operations use the pinned `2026-07` API and CLI
query/variable files. Tokens are managed by Shopify CLI, never included in a manifest or browser code.

Progress is written to stderr before every resource lookup, preflight check, and apply step, for example
`[plan 12/131] size.mens-jackets.44`. Stdout retains the plan JSON and apply results. Each Shopify request runs in
a dedicated launcher that awaits command completion and exits with its status, preventing lingering CLI handles
from holding an otherwise completed request open. Requests that never complete are force-stopped after 120 seconds;
they are not retried automatically. A partial output file is never used to infer mutation success.

## Manifest Contract

A manifest has a `name` and a `resources` array. Each resource has a unique `key`, `kind`, `data`, and optional
`dependsOn` keys. Relationships use `{ "$ref": "resource.key" }` for destination IDs, or
`{ "$ref": "resource.key", "field": "url" }` for URLs. References also establish installation order.
Use `dependsOn` when a relationship is implicit, such as an entry's definition identified by its type.

| Kind | Identity | Behavior |
| --- | --- | --- |
| `metaobject-definition` | Type | Creates merchant-owned definitions; incompatible existing schemas block installation. |
| `product-metafield-definition` | Namespace and key | Creates a typed product field; incompatible types/reference validation block installation. |
| `metaobject` | Type and handle | Creates fields after dependencies; supports explicit replacement. |
| `file` | Filename and local content hash | Staged upload, file creation, bounded readiness checks; reuses an exact ready file. |
| `page` | Handle | Creates a Page with its template suffix; unpublished unless explicitly specified. |
| `menu` | Handle | Creates nested navigation, at most three levels. |
| `collection` | Handle | Reuses an existing collection; creates missing collections with destination-resolved product membership. |
| `blog` | Handle | Reuses a complete existing journal or creates the journal and packaged articles; missing articles in an existing journal block the plan. |
| `product-chart-assignment` | Product handle, namespace and key | Assigns an explicit chart reference; missing products block installation. |

Resource payloads are validated before any network operation. Duplicate identities, missing references, cycles,
ambiguous search matches, changed input files, and stale plans fail closed. Definition changes are not silently
applied: resolve the schema conflict deliberately before retrying. Adding a new content type usually means another
definition and entries, not a new adapter. New Shopify resource families require an adapter with validation,
identity, lookup, create, and optional conflict/replacement handling, plus tests and GraphQL validation.

## Existing Content

Existing records are kept by default, even when their text differs from the content pack. This preserves merchant
edits and makes a normal rerun non-destructive. Plan output reports `create`, `keep`, `replace`, or `conflict`.

To authorize a specific replacement, pass its key to both plan and apply, for example `--replace chart.mens-jackets`.
There is no global overwrite switch. Replacing a chart does not implicitly replace its referenced size entries.
**Replacing a menu replaces its entire item tree**, including unrelated items: include all desired items in that
resource before explicitly approving it. Existing menus are not merged or attached to a theme automatically.

Shopify does not offer a cross-resource transaction. On failure the installer stops and retains completed resources;
fix the cause and plan again to resume. It never deletes store content as rollback. Rechecks reduce races but do not
make page/menu/metaobject updates transactional. Product assignments additionally use Shopify's compare-and-set
digest. Run a single installer per store and avoid concurrent edits during explicit replacement.

## Current Fencing Club Pack

The pack in [packages/fc-theme-base/content](../packages/fc-theme-base/content/README.md) contains five definitions,
five image files, five illustrated guides, 94 size entries, 13 charts, seven directory groups, one root page, and one
dedicated sizing menu: 131 resources.
The approved source measurements, including gaps and overlaps, remain literal strings. Only Mens jackets have
published imperial values; the pack does not invent conversions for the other charts.

Charts start as `DRAFT` and the root page starts unpublished. The menu is not automatically attached anywhere.
The metaobject definition enables web pages under `/pages/size-charts/{handle}`. The Admin API adapter derives links
from the returned definition URL prefix and entry handle; Liquid should use `chart.system.url`.

The theme includes a shared chart-page/flyout renderer, metaobject template, and root directory template described in
[Shopify Size Charts](shopify-size-charts.md). Do not activate chart entries, publish the root page, or attach the sizing
menu until those templates are installed and browser-tested on the destination store.
The installer deliberately does not publish a theme or mark the storefront rollout complete.

The seven `size_chart_group` records supply editable headings and category matching: Masks, Jackets, Pants, Gloves,
Underarm Protectors, Chest Protectors, and Footwear. Select them in **Theme settings >
Size charts > Groups in display order** to apply the packaged group order to both the directory and chart sidebar.
This theme-setting step is separate from record installation. The chart definition also includes `navigation_label`
for the short clothing labels. Existing definitions without this field require an explicit schema update before
installation; the installer reports the conflict rather than silently changing the definition.

## Theme Configuration

After content installation, run `configure-theme` against the new, unpublished theme. It refuses the live theme,
backs up existing files, verifies required resources, checks for concurrent changes, changes only sizing settings
and menu attachments, and verifies the stored result. It does not publish the theme.

```powershell
pnpm --filter @repo/shopify-content cli configure-theme ../fc-theme-base/content/theme-configuration.json --store your-store.myshopify.com --theme gid://shopify/OnlineStoreTheme/123 --backup ../../tmp/theme-settings-before.json
```

Add `--confirm-store your-store.myshopify.com` to apply, using a new backup filename. Shopify theme metaobject-list
settings contain plain record handles, not Admin API IDs or `shopify://metaobjects` links. Both directory and chart
sidebar use this same ordered list. Coordinate with any open editor drafts before saving; stale drafts can overwrite
newer files. `theme dev` can upload local settings, so keep the local selected groups aligned.

The live Fencing Club store currently defines `custom.size_chart` as `page_reference`. The new contract is
`metaobject_reference`. A live-store installation must explicitly replace that obsolete definition and reassign
the 26 mapped products after review. The installer intentionally reports this schema conflict; it never deletes
definitions or attempts a silent conversion. No such change is made by the Contoso rehearsal.

Collection records in this pack represent captured membership, not a recreation of app-dependent smart rules.
Existing live collections remain intact. Newly created collections use native manual source selections. Refresh
approved memberships before cutover if the source catalog has changed. Some source categories have no products.

## Verification

Run `pnpm --filter @repo/shopify-content test:coverage`, `check:types`, and `lint`, plus the repository's `pnpm verify`.
Tests cover dependency ordering, no-write planning, explicit replacement, partial failure, source/destination drift,
API errors, file transport, bundle relocation, and every packaged measurement. Initial verification uses test doubles;
an authorized destination-store plan and disposable-store application are still needed before production rollout.

See [Shopify theme packaging](https://shopify.dev/docs/api/shopify-cli/theme/theme-package) and
[metaobject definitions](https://shopify.dev/docs/apps/build/metaobjects/manage-metaobject-definitions).