// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLibraryServer, renderLibrary } from './component-library.mjs';
import { catalogFixture } from './component-library/fixtures.mjs';

let server;
let base;
beforeAll(async () => {
  server = createLibraryServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

describe('local component library', () => {
  it('renders production primitives, variant values and all menu families', async () => {
    const html = await renderLibrary();
    expect(html).not.toContain('data-appearance');
    expect(html).not.toContain('name="appearance"');
    expect(html).toContain('id="reduce-motion"');
    expect(html).toContain('id="reset-lab"');
    for (const token of ['ui-button--primary', 'ui-checkbox-field', 'ui-faq-item', '<ui-drawer', '<header-menu>', '<quantity-input', 'fc-mega__cards', 'fc-mega__columns', 'fc-mega-tool', 'fc-mega__body--panels']) {
      expect(html).toContain(token);
    }
    expect(html).toContain('value="XL"');
    expect(html).toContain('<time datetime="2026-08-17">August 17, 2026</time>');
    expect(html).not.toContain('>2026-08-17</time>');
    expect(html).not.toContain('[object Object]');
    expect(html).toContain('/assets/details-disclosure.js');
    expect(html).not.toContain('action="/cart');
    expect(html).not.toContain('src="https://');
    for (const stylesheet of ['section-contact-form.css', 'section-main-search.css']) expect(html).toContain(`/assets/${stylesheet}`);
    for (const token of ['--inputs-border-width: 1px', '--buttons-radius: 14px', '--font-heading-weight: 400', '--popup-border-width: 1px']) expect(html).toContain(token);
    for (const token of ['cookie-consent', 'ui-product-card--search', 'ui-article-card', 'ui-page-link-card', 'ui-contact-intent-card', 'data-section-example="journal"', 'data-section-example="support"', 'aria-disabled="true"', 'role="img"']) expect(html).toContain(token);
    for (const token of ['<ui-select', '<price-range', '<localization-form', '<predictive-search', '<header-drawer', '<media-gallery', '<product-modal', '<size-chart', '<policy-page', '<share-button', '<cart-note', '<cart-discount', 'data-tone="sale"', 'data-tone="event"', 'data-tone="vacation"']) expect(html).toContain(token);
    expect(html).toContain('LabCountry-country-results');
    expect(html).toContain('LabLanguageList');
    expect(html).toContain('<img id="Thumbnail-lab-media-0"');
    expect(html).not.toContain('&lt;img');
    expect(html).toContain('Mens');
    expect(html).toContain('class="ui-select__input"');
    expect(html).toContain('class="ui-text-field__input"');
    expect(html).toContain('class="ui-price-fields"');
    expect(html).toContain('class="ui-segmented-control"');
    expect(html).toContain('class="ui-choice"');
    expect(html).not.toContain('menu-drawer__category-link');
    expect(html).not.toContain('id="HeaderDrawer-footwear-collection"');
    expect(html).not.toContain('class="menu-drawer__close-button');
    expect(html).not.toContain('id="HeaderDrawer-weapons-weapons"');
    expect(html).not.toContain('id="HeaderDrawer-masks-masks"');
    expect(html).toContain('id="HeaderDrawer-weapons-foil"');
    expect(html).toContain('id="HeaderDrawer-masks-foil"');
    for (const mode of ['default', 'inverted', 'transparent']) expect(html).toContain(`data-header-example="${mode}"`);
    expect(html).toContain('HeaderMenu-inverted-weapons');
    expect(html).toContain('HeaderMenu-transparent-weapons');
    expect(html).toContain('/assets/ui-select.js');
    expect(html).not.toContain('collection-sort.js');
    expect(html).toContain('id="lab-radio-foil"');
    expect(html).toContain('class="ui-radio"');
    expect(html).toContain('id="lab-check-disabled"');
    for (const index of [1, 2, 3, 4, 5]) expect(html).toContain(`id="LabSearch-popular-category-${index}"`);
    expect(html).not.toContain('id="LabSearch-popular-category-6"');
  });
  it('serves uncached HTML and real component assets', async () => {
    const response = await fetch(base);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const asset = await fetch(`${base}/assets/component-ui.css`);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toBe('text/css');
    expect(await asset.text()).toContain('.ui-button');
  });
  it('rejects writes, unknown routes and traversal outside asset roots', async () => {
    expect((await fetch(`${base}/cart/add.js`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/cart`)).status).toBe(404);
    expect((await fetch(`${base}/assets/..%2f..%2fpackage.json`)).status).toBe(403);
    expect((await fetch(`${base}/lab/page.liquid`)).status).toBe(404);
  });
  it('uses production interactions without comparison-mode styles', async () => {
    const css = await (await fetch(`${base}/lab/library.css`)).text();
    expect(css).not.toContain('data-appearance');
    expect(css).not.toContain('--lab-fast');
    expect(css).toContain('body[data-reduced-motion]');
    expect(css).not.toContain('transition: all');
  });
  it('filters, sorts and paginates deterministic local products', () => {
    const jackets = catalogFixture(new URLSearchParams('type=Jackets&sort_by=price-descending'));
    expect(jackets.products_count).toBe(2);
    expect(jackets.products.map(product => product.price)).toEqual([14995, 6995]);
    expect(jackets.filters[0].values.find(value => value.label === 'Masks').count).toBe(0);
    expect(catalogFixture(new URLSearchParams('min=200')).products_count).toBe(0);
    expect(catalogFixture(new URLSearchParams('page=2')).paginate.current_page).toBe(2);
    expect(catalogFixture(new URLSearchParams('page=NaN')).paginate.current_page).toBe(1);
    const combined = catalogFixture(new URLSearchParams('type=Jackets&type=Gloves&color=Black'));
    expect(combined.products.map(product => product.id)).toEqual([802]);
  });
  it('serves rendered local responses and currency artwork without enabling writes', async () => {
    const catalog = await (await fetch(`${base}/lab/catalog?type=Jackets`)).text();
    expect(catalog).toContain('2 of 6 products');
    expect(catalog).toContain('class="ui-checkbox"');
    expect(catalog).not.toContain('value="XL"');
    expect(catalog).not.toContain('collection-filter-option__check');
    expect(catalog).not.toContain('aria-pressed=');
    expect(catalog).not.toContain('accessibility.selected');
    expect(catalog).toContain('data-filter-url=');
    expect(catalog).toContain('type="checkbox"');
    expect(catalog).toContain('class="swatch-input__input');
    expect(catalog).toContain('collection-filter-group--choice');
    expect(catalog).toContain('class="ui-choice__input');
    expect(catalog).toContain('name="filter.v.option.size"');
    expect(catalog).toContain('--swatch--background: white;');
    expect(catalog).not.toContain('collection-filter-option__swatch');
    expect(catalog).not.toContain('lab-active-filters');
    expect(catalog).not.toContain('ui-pill');
    const search = await (await fetch(`${base}/lab/search?q=jacket`)).text();
    expect(search).toContain('id="shopify-section-predictive-search"');
    expect(search).toContain('predictive-search-option-product-2');
    expect(search).toContain('predictive-search-option-article-1');
    expect(search).not.toContain('role="listbox"');
    expect(search).not.toContain('role="option"');
    expect(search).not.toContain('aria-selected');
    expect(search).not.toContain('tabindex="-1"');
    const empty = await (await fetch(`${base}/lab/search?q=unmatched`)).text();
    expect(empty).toContain('predictive-search__empty');
    for (const index of [1, 2, 3, 4, 5]) expect(empty).toContain(`id="predictive-search-option-empty-category-${index}"`);
    expect((await fetch(`${base}/lab/search`, { method: 'POST' })).status).toBe(405);
    expect((await (await fetch(`${base}/lab/country-flags.css`)).text())).toContain('/assets/country-flags-40.png');
  });
});