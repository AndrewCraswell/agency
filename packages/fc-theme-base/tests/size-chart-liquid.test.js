import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Liquid } from 'liquidjs';
import { chartFixtures, createSizingLiquid, sizingContext, source } from './helpers/sizing-liquid.mjs';

const engine = createSizingLiquid({ cache: true });
function htmlFragment(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

describe('production size-chart Liquid', () => {
  it('uses menu-aligned groups with no lost or duplicated charts in either navigation view', async () => {
    const context = sizingContext();
    context.settings.size_chart_groups = source.groups.map((group) => ({
      title: { value: group.title }, selection: { value: 'category' }, category: { value: group.category },
    }));
    for (const is_navigation of [false, true]) {
      const fragment = htmlFragment(await engine.renderFile('size-chart-directory', { ...context, is_navigation }));
      expect([...fragment.querySelectorAll(is_navigation ? 'summary span' : 'h2')].map((heading) => heading.textContent)).toEqual(source.groups.map((group) => group.title));
      const links = [...fragment.querySelectorAll('a')].map((link) => link.getAttribute('href'));
      expect(links).toHaveLength(13);
      expect(new Set(links).size).toBe(13);
      const footwear = [...fragment.querySelectorAll('.size-chart-directory__group')].find((group) => group.querySelector('h2, summary span').textContent === 'Footwear');
      expect([...footwear.querySelectorAll('a')].map((link) => link.textContent.trim())).toEqual(['Standard socks', 'Elite competition socks']);
    }
  });

  it.each([true, false])('normalizes Shopify capture whitespace while preserving validity %s', async (valid) => {
    const shopifyEngine = createSizingLiquid({
      cache: true,
      fs: {
        ...new Liquid().options.fs,
        async readFile(path) {
          const content = await readFile(path, 'utf8');
          if (basename(path) === 'size-chart-validity.liquid') return `{{ "\r" }}${content}`;
          return content;
        },
      },
    });
    const chart = chartFixtures()[0];
    if (!valid) chart.entries.value[0].chest_cm.value = '';
    const context = sizingContext([chart]);
    expect(await shopifyEngine.renderFile('size-chart-validity', context)).toBe(`\r${valid}`);
    const page = htmlFragment(await shopifyEngine.renderFile('size-chart-content', context));
    expect(page.querySelectorAll('table')).toHaveLength(valid ? 1 : 0);
    const directory = htmlFragment(await shopifyEngine.renderFile('size-chart-directory', context));
    expect(directory.querySelectorAll('a')).toHaveLength(valid ? 1 : 0);
    const product = { metafields: { custom: { size_chart: { value: chart } } } };
    const block = { id: 'chart', settings: { label: 'Size chart' } };
    const drawer = htmlFragment(await shopifyEngine.renderFile('size-chart-flyout', { ...context, product, block, section_id: 'product' }));
    expect(drawer.querySelectorAll('[data-drawer-open]')).toHaveLength(valid ? 1 : 0);
  });

  it.each(source.charts.map((chart, index) => [chart.handle, index]))('renders every published value for %s without JavaScript', async (_handle, index) => {
    const chart = chartFixtures()[index];
    const fragment = htmlFragment(await engine.renderFile('size-chart-content', { ...sizingContext(), chart }));
    const expected = source.charts[index];
    expect(fragment.querySelector('h1').textContent.trim()).toBe(expected.title);
    expect(fragment.querySelectorAll('thead [data-size-column]')).toHaveLength(expected.rows.length);
    const rows = [...fragment.querySelectorAll('tbody tr')];
    for (const [rowIndex, row] of rows.entries()) {
      expect([...row.querySelectorAll('td [data-value-unit="cm"]')].map((cell) => cell.textContent)).toEqual(expected.rows.map((entry) => entry[rowIndex + 1]));
    }
    expect(fragment.querySelectorAll('[data-size-column][hidden]')).toHaveLength(0);
    expect(fragment.querySelector('[data-chart-controls]').hidden).toBe(true);
    expect(fragment.querySelector('[data-chart-help]').open).toBe(true);
    expect(fragment.querySelectorAll('.measuring-tape-downloads a')).toHaveLength(2);
    expect(fragment.querySelector('img').getAttribute('alt')).not.toBe('');
  });

  it('keeps page and flyout table content identical without embedding drawer navigation', async () => {
    const context = sizingContext();
    const page = htmlFragment(await engine.renderFile('size-chart-content', context));
    const flyout = htmlFragment(await engine.renderFile('size-chart-content', { ...context, is_flyout: true }));
    expect(page.querySelector('table').outerHTML).toBe(flyout.querySelector('table').outerHTML);
    expect(flyout.querySelector('h1')).toBeNull();
    expect(flyout.querySelector('.size-chart__heading h2')).toBeNull();
    expect(flyout.querySelector('.size-chart__full-link')).toBeNull();
    expect(page.querySelector('.size-chart__full-link')).toBeNull();
  });

  it.each([false, true])('keeps measuring help and printable tape independent in flyout mode %s', async (is_flyout) => {
    const context = { ...sizingContext(), is_flyout };
    const fragment = htmlFragment(await engine.renderFile('size-chart-content', context));
    const help = fragment.querySelector('[data-chart-help]');
    const downloads = fragment.querySelector('details.measuring-tape-downloads');
    expect(downloads.parentElement).toBe(help.parentElement);
    expect(help.nextElementSibling).toBe(downloads);
    expect(downloads.open).toBe(false);
    expect(downloads.querySelector('summary h2').textContent).toBe('Printable measuring tape');
    expect(downloads.querySelectorAll('a[download]')).toHaveLength(2);
    expect(downloads.querySelectorAll('a.ui-link--with-icon .ui-icon')).toHaveLength(2);
    expect([...downloads.querySelectorAll('a')].map((link) => ({
      label: link.getAttribute('aria-label'), href: link.getAttribute('href'),
      download: link.getAttribute('download'), type: link.getAttribute('type'),
    }))).toEqual([
      { label: 'Download A4 PDF measuring tape', href: '/assets/measuring-tape-a4.pdf', download: 'fencing-club-measuring-tape-a4.pdf', type: 'application/pdf' },
      { label: 'Download US Letter PDF measuring tape', href: '/assets/measuring-tape-letter.pdf', download: 'fencing-club-measuring-tape-letter.pdf', type: 'application/pdf' },
    ]);
    downloads.open = true;
    help.open = false;
    expect(downloads.open).toBe(true);
    const hidden = htmlFragment(await engine.renderFile('size-chart-content', {
      ...context, settings: { ...context.settings, size_chart_hide_downloads: true },
    }));
    expect(hidden.querySelector('.measuring-tape-downloads')).toBeNull();
    expect(hidden.querySelector('[data-chart-help]')).not.toBeNull();
  });

  it('keeps download metadata optional for ordinary shared links and escapes accessible names', async () => {
    const plain = htmlFragment(await engine.renderFile('ui-link', { label: 'Size charts', url: '/pages/size-charts' })).querySelector('a');
    expect(plain.textContent).toBe('Size charts');
    expect(plain.getAttribute('href')).toBe('/pages/size-charts');
    expect(plain.hasAttribute('download')).toBe(false);
    expect(plain.hasAttribute('type')).toBe(false);
    expect(plain.hasAttribute('aria-label')).toBe(false);
    expect(plain.hasAttribute('id')).toBe(false);
    const download = htmlFragment(await engine.renderFile('ui-link', {
      label: 'A4 PDF', url: '/tape.pdf', download: 'tape"quoted.pdf', type: 'application/pdf', aria_label: 'Download "A4" tape', id: 'link"quoted',
    })).querySelector('a');
    expect(download.getAttribute('download')).toBe('tape"quoted.pdf');
    expect(download.getAttribute('aria-label')).toBe('Download "A4" tape');
    expect(download.id).toBe('link"quoted');
  });

  it.each(['missing', 'wrong-type', 'missing-value', 'mismatched-labels', 'mismatched-imperial', 'missing-guide', 'duplicate-entries', 'duplicate-keys'])('refuses a %s chart', async (defect) => {
    const chart = chartFixtures()[0];
    if (defect === 'missing') chart.system.url = '';
    if (defect === 'wrong-type') chart.system.type = 'unrelated';
    if (defect === 'missing-value') chart.entries.value[0].chest_cm.value = '';
    if (defect === 'mismatched-labels') chart.measurement_labels.value = ['Chest'];
    if (defect === 'mismatched-imperial') chart.imperial_keys.value = ['chest_in'];
    if (defect === 'missing-guide') chart.guide.value = undefined;
    if (defect === 'duplicate-entries') chart.entries.value.push(chart.entries.value[0]);
    if (defect === 'duplicate-keys') chart.measurement_keys.value = ['chest_cm', 'chest_cm'];
    const fragment = htmlFragment(await engine.renderFile('size-chart-content', { ...sizingContext(), chart }));
    expect(fragment.querySelector('table')).toBeNull();
    expect(fragment.textContent).toContain('This size chart is unavailable.');
  });

  it('renders the configured order in the directory and selects only the current sidebar link', async () => {
    const charts = chartFixtures();
    const context = sizingContext([charts[10], charts[0], charts[1]]);
    const directory = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect([...directory.querySelectorAll('a')].map((link) => link.textContent.trim())).toEqual(['Gloves', 'Mens', 'Womens']);
    expect(directory.querySelectorAll('details')).toHaveLength(0);
    expect(directory.querySelectorAll('a .fc-icon--arrow-right')).toHaveLength(3);
    const navigation = htmlFragment(await engine.renderFile('size-chart-directory', { ...context, current_chart: charts[1], is_navigation: true }));
    expect(navigation.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(navigation.querySelector('[aria-current="page"]').textContent.trim()).toBe('Womens');
    expect(navigation.querySelector('details[open] summary').textContent.trim()).toBe('Jackets');
    expect(navigation.querySelectorAll('a svg')).toHaveLength(0);
    expect(navigation.querySelectorAll('summary .fc-icon--chevron-down')).toHaveLength(2);
  });

  it('uses editable short navigation labels without changing chart titles or destinations', async () => {
    const charts = chartFixtures();
    const clothing = charts.filter((chart) => ['Jackets', 'Pants'].includes(chart.category.value));
    const labels = ['Mens', 'Womens', 'Kids', 'Mens', 'Womens', 'Kids'];
    clothing.forEach((chart, index) => { chart.navigation_label = { value: labels[index] }; });
    const context = sizingContext(clothing);
    for (const is_navigation of [false, true]) {
      const fragment = htmlFragment(await engine.renderFile('size-chart-directory', { ...context, is_navigation, current_chart: clothing[0] }));
      expect([...fragment.querySelectorAll('a')].map((link) => link.textContent.trim())).toEqual(labels);
      expect([...fragment.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(clothing.map((chart) => chart.system.url));
    }
    const page = htmlFragment(await engine.renderFile('size-chart-content', context));
    expect(page.querySelector('h1').textContent.trim()).toBe('Mens jackets');
    clothing[0].navigation_label.value = '';
    const fallback = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect(fallback.querySelector('a').textContent.trim()).toBe('Mens jackets');
  });

  it('renders directory and chart breadcrumbs and keeps the root free of sizing tables', async () => {
    const context = sizingContext();
    const index = htmlFragment(await engine.renderTemplate('page.size-charts', context));
    expect(index.querySelectorAll('.size-chart-directory a')).toHaveLength(13);
    expect(index.querySelector('table')).toBeNull();
    expect(index.querySelector('.ui-breadcrumbs [aria-current]').textContent).toBe('Size charts');
    const page = htmlFragment(await engine.renderTemplate('metaobject/size_chart', context));
    expect([...page.querySelectorAll('.ui-breadcrumbs a')].map((link) => link.getAttribute('href'))).toEqual(['/', '/pages/size-charts']);
    expect(page.querySelector('.ui-breadcrumbs [aria-current]').textContent).toBe('Mens jackets');
    for (const fragment of [index, page]) {
      expect(fragment.querySelectorAll('.ui-breadcrumbs')).toHaveLength(1);
      expect(fragment.querySelector('.size-charts-page .ui-breadcrumbs')).toBeNull();
      expect(fragment.querySelector('.page-breadcrumbs').compareDocumentPosition(fragment.querySelector('.size-charts-page')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    for (const section of ['main-size-charts', 'main-size-chart']) {
      const standalone = htmlFragment(await engine.renderFile(section, context));
      expect(standalone.querySelector('.ui-breadcrumbs')).toBeNull();
    }
  }, 15000);

  it('configures the directory heading and layout without changing the page identity', async () => {
    const context = sizingContext();
    const fragment = htmlFragment(await engine.renderFile('main-size-charts', {
      ...context, section: { id: 'directory', settings: { heading: 'Find your size', columns: '3' } },
    }));
    expect(fragment.querySelector('h1').textContent).toBe('Find your size');
    expect(fragment.querySelector('.size-charts-page__main--columns-3')).not.toBeNull();
    expect(fragment.querySelector('.ui-breadcrumbs')).toBeNull();
    expect(fragment.querySelectorAll('.size-chart-directory a')).toHaveLength(13);
  });

  it('shares editable headings, category matches and manual chart ordering with the sidebar', async () => {
    const charts = chartFixtures();
    const context = sizingContext(charts);
    context.settings.size_chart_groups = [
      { title: { value: 'Hand protection' }, selection: { value: 'manual' }, charts: { value: [charts[10], charts[7]] } },
      { title: { value: 'Club jackets' }, selection: { value: 'category' }, category: { value: 'Jackets' } },
    ];
    for (const is_navigation of [false, true]) {
      const fragment = htmlFragment(await engine.renderFile('size-chart-directory', { ...context, is_navigation, current_chart: charts[7] }));
      expect([...fragment.querySelectorAll(is_navigation ? 'summary span' : 'h2')].map((heading) => heading.textContent)).toEqual(['Hand protection', 'Club jackets']);
      expect([...fragment.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual([charts[10], charts[7], ...charts.slice(0, 3)].map((chart) => chart.system.url));
      if (is_navigation) {
        expect(fragment.querySelectorAll('details[open]')).toHaveLength(1);
        expect(fragment.querySelector('details[open] summary').textContent.trim()).toBe('Hand protection');
      }
    }
  });

  it('picks up new active category matches when the catalog is automatic', async () => {
    const context = sizingContext();
    context.settings.size_chart_catalog = [];
    context.settings.size_chart_groups = [{ title: { value: 'Jackets' }, selection: { value: 'category' }, category: { value: 'Jackets' } }];
    const extra = chartFixtures()[0];
    extra.system.handle = 'club-jackets';
    extra.system.url = '/pages/size-charts/club-jackets';
    context.metaobjects.size_chart.values.push(extra);
    const automatic = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect(automatic.querySelectorAll('a')).toHaveLength(4);
    expect(automatic.querySelector('a[href="/pages/size-charts/club-jackets"]')).not.toBeNull();
    context.settings.size_chart_groups[0] = { title: { value: 'Chosen jackets' }, selection: { value: 'manual' }, charts: { value: [context.chart] } };
    const manual = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect(manual.querySelectorAll('a')).toHaveLength(1);
  });

  it('omits empty or invalid groups and reports an unavailable catalog instead of an empty container', async () => {
    const context = sizingContext();
    const invalid = chartFixtures()[0];
    invalid.system.url = '';
    context.settings.size_chart_groups = [
      { title: { value: 'Empty' }, selection: { value: 'manual' }, charts: { value: [] } },
      { title: { value: 'Invalid' }, selection: { value: 'manual' }, charts: { value: [invalid] } },
      { title: { value: 'Unconfigured' }, selection: { value: 'category' }, category: { value: '' } },
    ];
    const fragment = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect(fragment.querySelector('.size-chart-directory')).toBeNull();
    expect(fragment.textContent).toContain('Size charts are not available yet.');
    context.settings.size_chart_groups = [];
    context.settings.size_chart_catalog = [invalid];
    const invalidCatalog = htmlFragment(await engine.renderFile('size-chart-directory', context));
    expect(invalidCatalog.querySelector('.size-chart-directory')).toBeNull();
    expect(invalidCatalog.textContent).toContain('Size charts are not available yet.');
  });

  it('links the clothing menu to the configured sizing directory or its locale-aware fallback', async () => {
    const link = { handle: 'clothing', links: [{ title: 'Jackets', url: '/collections/jackets', links: [{ title: 'Mens', url: '/collections/mens-jackets' }] }] };
    const context = { ...sizingContext(), link };
    const standard = htmlFragment(await engine.renderFile('mega-menu-body', context));
    expect(standard.querySelector('.fc-mega-feature').getAttribute('href')).toBe('/pages/size-charts');
    const configured = htmlFragment(await engine.renderFile('mega-menu-body', {
      ...context, settings: { ...context.settings, size_chart_index_page: { url: '/pages/club-sizing' } },
    }));
    expect(configured.querySelector('.fc-mega-feature').getAttribute('href')).toBe('/pages/club-sizing');
    const fallback = htmlFragment(await engine.renderFile('mega-menu-body', {
      ...context, pages: {}, routes: { root_url: '/en-ca/' },
    }));
    expect(fallback.querySelector('.fc-mega-feature').getAttribute('href')).toBe('/en-ca/pages/size-charts');
  });

  it('uses only the product metadata assignment and hides an unassigned trigger', async () => {
    const context = sizingContext();
    const product = { title: 'Assigned product', metafields: { custom: { size_chart: { value: context.chart } } } };
    const block = { id: 'chart-block', settings: { label: 'Size chart' } };
    const assigned = htmlFragment(await engine.renderFile('size-chart-flyout', { ...context, product, block, section_id: 'product' }));
    expect(assigned.querySelector('[data-drawer-open]').getAttribute('href')).toBe(context.chart.system.url);
    expect(assigned.querySelector('dialog [data-chart-content]')).not.toBeNull();
    expect(assigned.querySelector('ui-drawer .ui-drawer--wide')).not.toBeNull();
    expect(assigned.querySelector('.ui-drawer__description')).toBeNull();
    expect(assigned.querySelector('.ui-drawer__title').textContent).toBe('Size chart: Mens jackets');
    expect(assigned.querySelector('.ui-drawer__body .size-chart__heading h2')).toBeNull();
    expect(assigned.querySelector('[data-drawer-open]').getAttribute('aria-controls')).toBe(assigned.querySelector('dialog').id);
    expect(assigned.querySelector('dialog').getAttribute('aria-labelledby')).toBe(assigned.querySelector('.ui-drawer__title').id);
    const fullChart = assigned.querySelector('.ui-drawer__footer .ui-link--with-icon');
    expect(fullChart.textContent.trim()).toBe('View full chart');
    expect(fullChart.getAttribute('href')).toBe(context.chart.system.url);
    expect(fullChart.querySelector('.ui-icon')).not.toBeNull();
    expect(assigned.querySelector('[data-chart-content]').dataset.fullChartLinkId).toBe(fullChart.id);
    expect(assigned.querySelector('.ui-drawer__body .size-chart__full-link')).toBeNull();
    const absent = htmlFragment(await engine.renderFile('size-chart-flyout', { ...context, product: { title: 'Mens jacket' }, block }));
    expect(absent.querySelector('[data-drawer-open]')).toBeNull();
  });

  it.each(source.charts.map((chart, index) => [chart.handle, index]))('uses one record-derived drawer heading for %s', async (_handle, index) => {
    const context = sizingContext();
    const chart = chartFixtures()[index];
    const product = { title: 'Not a chart title', metafields: { custom: { size_chart: { value: chart } } } };
    const block = { id: 'chart-block', settings: { label: 'Size chart' } };
    const fragment = htmlFragment(await engine.renderFile('size-chart-flyout', { ...context, product, block, section_id: 'product' }));
    expect(fragment.querySelector('.ui-drawer__title').textContent).toBe(`Size chart: ${source.charts[index].title}`);
    expect(fragment.querySelector('.ui-drawer__description')).toBeNull();
    expect(fragment.querySelectorAll('.ui-drawer__body h1, .ui-drawer__body .size-chart__heading h2')).toHaveLength(0);
    const region = fragment.querySelector('[data-chart-table-region]');
    expect(region.getAttribute('aria-labelledby')).toBe(fragment.querySelector('caption').id);
    expect(fragment.querySelector('caption').textContent).toBe(chart.title.value);
    expect(fragment.querySelectorAll('.size-chart__heading')).toHaveLength(chart.imperial_keys?.value?.length ? 1 : 0);
  });
});