# Shopify Policy Pages

The Dawn-based theme in `packages/fc-theme-base` uses `templates/page.policy.json` and
`sections/main-policy.liquid` for store-managed policy pages. Assign the **policy** template to a page in Shopify;
the section renders its title and rich-text content, rather than embedding legal wording in the theme.

## Pages And Navigation

| Page | Path | Footer menu |
| --- | --- | --- |
| Shipping Policy | `/pages/shipping-policy` | Support: Shipping |
| Return & Refund Policy | `/pages/refund-policy` | Support: Returns |
| Privacy Policy | `/pages/privacy-policy` | Company: Privacy policy |
| Terms of Service | `/pages/terms-of-service` | Company: Terms of service |

The menus are Shopify resources with handles `footer-support` and `footer-company`, selected by the existing footer
section. Policy entries use `PAGE` resource references, not hardcoded URLs. Preserve unrelated entries when updating
menus: Shopify's `menuUpdate` replaces the supplied item list.

These custom pages do not replace Shopify's system `/policies/` routes or checkout policy settings. Keep those legal
settings consistent when policy wording changes. The initial content was taken from the published `fencing.club`
policies on September 6, 2026. Only markup and internal policy link destinations changed; the wording was preserved.
The initial page and menu setup was applied to `contosocamp.myshopify.com`, not the live Fencing Club store.

## Content And Layout

- Use `h2` for main sections and `h3` for subsections. Keep heading IDs stable so bookmarked section links remain valid.
- `assets/policy-page.js` builds the contents links from `h2` elements. No headings means no empty contents control.
- Desktop shows the contents list beside the article. Tablet and mobile use a native **On this page** disclosure.
  Only navigation collapses; the article remains readable with JavaScript disabled.
- Tables with a `thead` and regular body cells gain stacked, labelled cells on mobile. Complex spanning tables remain
  scrollable. Use real table headers and retain every data cell.
- Breadcrumbs lead from Home to the current page. There is no cross-policy selector in the content area.
- Navigation labels are editable section settings and can be translated through Shopify's theme-content workflow.

## Verification

Run `pnpm --filter @repo/fc-theme-base test:coverage` for contents, focus, lifecycle and table regression coverage, plus
Shopify Theme Check for the changed theme files. In the integrated browser, follow all four footer links, verify
the source wording, test the contents disclosure and anchor focus with a keyboard, and inspect desktop, tablet and
mobile layouts, including Privacy tables and long Terms headings. Also check no-JavaScript reading and print output.
The normal repository gate remains `pnpm verify`.