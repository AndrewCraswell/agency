import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { Liquid } from 'liquidjs';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

beforeAll(async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  await import('../assets/cookie-consent.js');
  await import('../assets/details-disclosure.js');
  await import('../assets/global.js');
  await import('../assets/ui-select.js');
  await import('../assets/localization-form.js');
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('component accessibility contracts', () => {
  it('keeps closing search panels inert and ignores dismissed or superseded results', async () => {
    const isolated = new Window({ url: 'https://example.test/' });
    isolated.eval(`${readFileSync(resolve('assets/search-form.js'), 'utf8')}\n${readFileSync(resolve('assets/predictive-search.js'), 'utf8')}`);
    isolated.routes = { predictive_search_url: '/search/suggest' };
    const prototype = isolated.customElements.get('predictive-search').prototype;
    const host = isolated.document.createElement('div');
    host.innerHTML = '<input id="search" type="search" role="combobox"><div id="search-results" data-results></div><div id="search-suggestions" data-idle></div>';
    isolated.document.body.append(host);
    Object.assign(host, {
      input: host.querySelector('input'), predictiveSearchResults: host.querySelector('[data-results]'),
      idleResults: host.querySelector('[data-idle]'), abortController: new isolated.AbortController(),
      cachedResults: {}, allPredictiveSearchInstances: [host],
      renderRecentSearches: vi.fn(), updatePanelGeometry: vi.fn(),
      setLiveRegionLoadingState: vi.fn(), dispatchSearchUpdateEvent: () => null,
      renderSearchResults: vi.fn(),
    });
    for (const name of ['openIdle', 'closeIdle', 'open', 'close', 'closeResults', 'getSearchResults']) host[name] = prototype[name];
    host.openIdle();
    expect(host.idleResults.inert).toBe(false);
    expect(host.input.getAttribute('aria-controls')).toBe('search-suggestions');
    expect(host.input.getAttribute('aria-expanded')).toBe('true');
    host.open();
    expect(host.idleResults.inert).toBe(true);
    expect(host.predictiveSearchResults.inert).toBe(false);
    expect(host.input.getAttribute('aria-controls')).toBe('search-results');
    const requests = [];
    isolated.fetch = vi.fn((_url, options) => new Promise(resolveRequest => requests.push({ options, resolveRequest })));
    const dismissed = host.getSearchResults('jacket');
    host.close();
    expect(host.predictiveSearchResults.inert).toBe(true);
    expect(host.input.getAttribute('aria-expanded')).toBe('false');
    expect(requests[0].options.signal.aborted).toBe(true);
    requests[0].resolveRequest({ ok: true, text: async () => '<div id="shopify-section-predictive-search">Dismissed</div>' });
    await dismissed;
    expect(host.renderSearchResults).not.toHaveBeenCalled();
    prototype.onChange.call(host);
    expect(isolated.fetch).toHaveBeenCalledTimes(1);
    host.openIdle();
    expect(host.dismissed).toBe(false);
    const first = host.getSearchResults('glove');
    const second = host.getSearchResults('mask');
    requests[2].resolveRequest({ ok: true, text: async () => '<div id="shopify-section-predictive-search">Current</div>' });
    await second;
    requests[1].resolveRequest({ ok: true, text: async () => '<div id="shopify-section-predictive-search">Stale</div>' });
    await first;
    expect(host.renderSearchResults).toHaveBeenCalledExactlyOnceWith('Current');
    expect(host.cachedResults).toEqual({ mask: 'Current' });
    await isolated.happyDOM.close();
  });
  it('uses native result links, unique heading references and focus-based navigation', async () => {
    const isolated = new Window({ url: 'https://example.test/' });
    isolated.eval(`${readFileSync(resolve('assets/search-form.js'), 'utf8')}\n${readFileSync(resolve('assets/predictive-search.js'), 'utf8')}`);
    const prototype = isolated.customElements.get('predictive-search').prototype;
    const host = isolated.document.createElement('div');
    host.innerHTML = '<input id="SearchA" type="search"><div id="SearchA-results"></div>';
    isolated.document.body.append(host);
    Object.assign(host, {
      input: host.querySelector('input'), predictiveSearchResults: host.querySelector('div'),
      setLiveRegionResults: vi.fn(), open: vi.fn(), close: vi.fn(),
      switchOption: prototype.switchOption,
    });
    prototype.renderSearchResults.call(host, '<h2 id="products">Products</h2><ul aria-labelledby="products"><li data-search-result><a href="/first">First</a></li><li data-search-result><a href="/second">Second</a></li></ul>');
    expect(host.querySelector('h2').id).toBe('SearchA-products');
    expect(host.querySelector('ul').getAttribute('aria-labelledby')).toBe('SearchA-products');
    const links = [...host.querySelectorAll('a')];
    for (const link of links) Object.defineProperty(link, 'offsetParent', { value: host });
    host.input.focus();
    const preventDefault = vi.fn();
    prototype.onKeydown.call(host, { code: 'ArrowDown', preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(isolated.document.activeElement).toBe(links[0]);
    host.switchOption('down');
    expect(isolated.document.activeElement).toBe(links[1]);
    host.switchOption('up');
    expect(isolated.document.activeElement).toBe(links[0]);
    host.switchOption('up');
    expect(isolated.document.activeElement).toBe(host.input);
    host.switchOption('down');
    prototype.onKeyup.call(host, { code: 'Escape' });
    expect(isolated.document.activeElement).toBe(host.input);
    expect(host.close).toHaveBeenCalledOnce();
    host.predictiveSearchResults.inert = true;
    host.switchOption('down');
    expect(isolated.document.activeElement).toBe(host.input);
    await isolated.happyDOM.close();
  });
  it('retains the header search layout while exiting and clears it on reopen', async () => {
    const isolated = new Window();
    isolated.removeTrapFocus = vi.fn();
    isolated.trapFocus = vi.fn();
    isolated.eval(readFileSync(resolve('assets/details-modal.js'), 'utf8'));
    const prototype = isolated.customElements.get('details-modal').prototype;
    const host = isolated.document.createElement('div');
    host.innerHTML = '<details open><summary>Search</summary><div class="search-modal"><div tabindex="-1"><div class="search-panel" idle><input type="search"></div></div></div></details>';
    isolated.document.body.append(host);
    host.detailsContainer = host.querySelector('details');
    host.summaryToggle = host.querySelector('summary');
    host.isOpen = prototype.isOpen;
    host.onBodyClick = vi.fn();
    prototype.close.call(host);
    expect(host.querySelector('.search-panel').dataset.closingContent).toBe('idle');
    expect(host.querySelector('.search-modal').inert).toBe(true);
    expect(host.summaryToggle.getAttribute('aria-expanded')).toBe('false');
    prototype.open.call(host, { target: host.summaryToggle });
    expect(host.querySelector('.search-panel').hasAttribute('data-closing-content')).toBe(false);
    expect(host.querySelector('.search-modal').inert).toBe(false);
    expect(host.detailsContainer.open).toBe(true);
    prototype.close.call(host);
    await isolated.happyDOM.close();
  });
  it('renders shared native checkboxes and grouped radios with labels and form values', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const form = document.createElement('form');
    form.innerHTML = [
      { id: 'stock', name: 'filter', value: 'stock', label: 'In stock', count: 12, checked: true, action: 'consent-category' },
      { id: 'unavailable', name: 'filter', value: 'locked', label: 'Unavailable', disabled: true },
      { id: 'foil', type: 'radio', name: 'weapon', value: 'foil', label: 'Foil', checked: true, required: true },
      { id: 'epee', type: 'radio', name: 'weapon', value: 'epee', label: 'Epee', described_by: 'weapon-hint' },
    ].map(parameters => engine.renderFileSync('ui-checkbox-field', parameters)).join('');
    document.body.append(form);
    const checkbox = form.querySelector('#stock');
    expect(checkbox.type).toBe('checkbox');
    expect(checkbox.labels[0].textContent.trim()).toBe('In stock');
    expect(checkbox.dataset.action).toBe('consent-category');
    expect(checkbox.dataset.value).toBe('stock');
    expect(form.querySelector('.ui-checkbox-field__count').textContent).toBe('(12)');
    expect(new FormData(form).get('filter')).toBe('stock');
    checkbox.labels[0].click();
    expect(checkbox.checked).toBe(false);
    const disabled = form.querySelector('#unavailable');
    disabled.labels[0].click();
    expect(disabled.checked).toBe(false);
    form.querySelector('#epee').labels[0].click();
    expect(form.querySelector('#foil').checked).toBe(false);
    expect(form.querySelector('#epee').checked).toBe(true);
    expect(new FormData(form).get('weapon')).toBe('epee');
    expect(form.querySelector('#epee').getAttribute('aria-describedby')).toBe('weapon-hint');
    expect(form.querySelector('#foil').required).toBe(true);
    expect(form.querySelector('.ui-checkbox-field--filter')).toBeNull();
    const filter = document.createElement('div');
    for (const type of ['checkbox', 'radio']) {
      filter.innerHTML = engine.renderFileSync('ui-checkbox-field', { id: 'filter', label: 'In stock', checked: true, variant: 'filter', type });
      expect(filter.querySelector('.ui-checkbox-field--filter input').checked).toBe(true);
      expect(filter.querySelector('input').type).toBe(type);
    }
  });
  it('clears mobile-menu expanded states after pointer dismissal', () => {
    const details = document.createElement('details');
    details.open = true;
    details.innerHTML = '<summary aria-expanded="true">Menu</summary><details open><summary aria-expanded="true">Clothing</summary></details>';
    document.body.append(details);
    const instance = { mainDetailsToggle: details, dataset: { breakpoint: 'tablet' }, closeAnimation: target => target.removeAttribute('open') };
    customElements.get('menu-drawer').prototype.closeMenuDrawer.call(instance, new MouseEvent('click'), details.querySelector('summary'));
    expect(details.open).toBe(false);
    expect([...details.querySelectorAll('summary')].map(summary => summary.getAttribute('aria-expanded'))).toEqual(['false', 'false']);
  });
  it('reuses the same choice renderer for radio options and multi-select buttons', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const container = document.createElement('div');
    container.innerHTML = engine.renderFileSync('ui-choice', { id: 'size', name: 'size', value: '44', label: '44', checked: true });
    expect(container.querySelector('input').checked).toBe(true);
    expect(container.querySelector('label').classList.contains('ui-choice')).toBe(true);
    container.innerHTML = engine.renderFileSync('ui-choice', { type: 'button', label: '44', checked: true, additional_props: 'data-size-option="size-44"' });
    expect(container.querySelector('.ui-choice').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('button').dataset.sizeOption).toBe('size-44');
    container.innerHTML = engine.renderFileSync('ui-segmented-control', { name: 'units', options: ['cm', 'in'], selected: 'cm', input_attributes: 'data-chart-unit' });
    const radios = [...container.querySelectorAll('input')];
    expect(radios.map(input => [input.type, input.name, input.value, input.checked])).toEqual([['radio', 'units', 'cm', true], ['radio', 'units', 'in', false]]);
  });
  it('renders renamed Color and Size filters with shared native multi-select variants', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const option = (param, label, active, count = 2, swatch) => ({ param_name: param, label, value: label, active, count, swatch, url_to_add: `/collections/all?${param}=${encodeURIComponent(label)}`, url_to_remove: '/collections/all' });
    const form = document.createElement('form');
    form.innerHTML = engine.renderFileSync('collection-facet-filters', { section_id: 'test', results: { filters: [
      { label: 'Measurements', type: 'list', values: [option('filter.v.option.size', '44', true), option('filter.v.option.size', '46', true), option('filter.v.option.size', 'XL', false, 0)] },
      { label: 'Colours', type: 'list', param_name: 'filter.v.option.colour', values: [option('filter.v.option.colour', 'Blue', true), option('filter.v.option.colour', 'White / Silver', false), option('filter.v.option.colour', 'Supplier special', false), option('filter.v.option.colour', 'Red', false, 0), option('filter.v.option.colour', 'Brand blue', false, 2, { color: { rgb: '20, 40, 60' } })] },
      { label: 'Fit', type: 'list', values: [option('filter.p.m.custom.gender', 'Kids', false)] },
    ] } });
    document.body.append(form);
    const sizes = [...form.querySelectorAll('.collection-filter-group--choice input')];
    expect(sizes.map(input => [input.type, input.checked, input.disabled])).toEqual([['checkbox', true, false], ['checkbox', true, false]]);
    expect(form.querySelector('input[value="XL"]')).toBeNull();
    expect(sizes.every(input => input.nextElementSibling.classList.contains('ui-choice'))).toBe(true);
    expect(new FormData(form).getAll('filter.v.option.size')).toEqual(['44', '46']);
    expect(sizes[0].dataset.filterUrl).toBe('/collections/all');
    const colors = [...form.querySelectorAll('.collection-filter-group--swatch input')];
    expect(colors.every(input => input.type === 'checkbox')).toBe(true);
    expect(colors[0].nextElementSibling.querySelector('.swatch').getAttribute('style')).toContain('--swatch--background: blue;');
    expect(colors[1].nextElementSibling.querySelector('.swatch').getAttribute('style')).toContain('linear-gradient(135deg, white 50%, silver 50%)');
    expect(form.querySelector('input[value="Supplier special"]')).toBeNull();
    expect(form.querySelector('input[value="Red"]')).toBeNull();
    expect(colors[2].nextElementSibling.querySelector('.swatch').getAttribute('style')).toContain('rgb(20, 40, 60)');
    expect(form.querySelectorAll('.swatch--unavailable')).toHaveLength(0);
    expect(form.querySelectorAll('.ui-checkbox-field')).toHaveLength(1);
    expect(new Set([...form.querySelectorAll('input')].map(input => input.id)).size).toBe(6);
  });
  it('omits unsupported colors and empty color groups but keeps active unsupported colors removable', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const container = document.createElement('div');
    const values = ['Black/Gunmetal', 'White/Pure Gold', 'White/Vivid Coral'].map(label => ({
      label, value: label, param_name: 'filter.v.option.color', active: false, count: 2,
      url_to_remove: '/collections/clothing',
    }));
    const results = { filters: [{ label: 'Color', type: 'list', values }] };
    container.innerHTML = engine.renderFileSync('collection-facet-filters', { section_id: 'colors', results });
    expect(container.querySelector('.collection-filter-group')).toBeNull();
    values[0].active = true;
    values[0].count = 0;
    container.innerHTML = engine.renderFileSync('collection-facet-filters', { section_id: 'colors', results });
    expect(container.querySelectorAll('.collection-filter-group')).toHaveLength(1);
    expect(container.querySelectorAll('input')).toHaveLength(1);
    const selected = container.querySelector('input');
    expect(selected.checked).toBe(true);
    expect(selected.disabled).toBe(false);
    expect(selected.value).toBe('Black/Gunmetal');
    expect(selected.dataset.filterUrl).toBe('/collections/clothing');
    expect(selected.nextElementSibling.textContent.trim()).toBe('Black/Gunmetal');
  });
  it('hides irrelevant filter values and empty groups while retaining active zero-count selections', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const container = document.createElement('div');
    container.innerHTML = engine.renderFileSync('collection-facet-filters', { section_id: 'visible', results: { filters: [
      { label: 'Brand', type: 'list', values: [
        { param_name: 'filter.p.vendor', label: 'Selected brand', value: 'Selected brand', active: true, count: 0, url_to_remove: '/collections/all' },
        { param_name: 'filter.p.vendor', label: 'No matches', value: 'No matches', active: false, count: 0 },
      ] },
      { label: 'Empty group', type: 'list', values: [{ param_name: 'filter.v.option.color', label: 'Red', value: 'Red', active: false, count: 0 }] },
      { label: 'No values', type: 'list', values: [] },
    ] } });
    expect(container.querySelectorAll('.collection-filter-group')).toHaveLength(1);
    expect(container.querySelectorAll('input')).toHaveLength(1);
    const selected = container.querySelector('input');
    expect(selected.checked).toBe(true);
    expect(selected.disabled).toBe(false);
    expect(selected.dataset.filterUrl).toBe('/collections/all');
    expect(container.querySelector('details').open).toBe(true);
    expect(container.querySelector('summary h3').textContent).toBe('BRAND');
  });
  it('prioritizes native swatch artwork and never treats arbitrary color labels as CSS', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    engine.registerFilter('image_url', image => image.url);
    const swatch = { image: { url: '/pattern.png', presentation: { focal_point: '25% 50%' } }, color: { rgb: '0, 0, 255' } };
    const html = engine.renderFileSync('swatch', { swatch, color_name: 'Red' });
    expect(html).toContain('url(/pattern.png)');
    expect(html).toContain('--swatch-focal-point: 25% 50%');
    expect(html).not.toContain('rgb(0, 0, 255)');
    expect(engine.renderFileSync('swatch-background', { color_name: 'Clear' })).toContain('repeating-conic-gradient');
    for (const color_name of ['Jet Black', 'White/Pure Gold', 'url(https://example.test/image)', 'red; color: transparent', 'red/blue/green']) {
      expect(engine.renderFileSync('swatch-background', { color_name }).trim()).toBe('');
    }
  });
  it.each(['swatch-input__input', 'ui-choice__input', 'ui-checkbox'])('preserves breadcrumb context on %s filter navigation and leaves disabled links inert', async inputClass => {
    const isolated = new Window({ url: 'https://example.test/collections/clothing?breadcrumb_current=Clothing' });
    isolated.document.body.innerHTML = `<nav class="collection-curated-filters"><input class="${inputClass}" type="checkbox" data-filter-url="/collections/clothing?filter.v.option.color=White"></nav><li class="collection-filter-option"><a role="link" aria-disabled="true" tabindex="-1">Unavailable</a></li>`;
    const navigate = vi.spyOn(isolated.location, 'assign').mockImplementation(() => {});
    isolated.eval(readFileSync(resolve('assets/collection-breadcrumbs.js'), 'utf8'));
    isolated.document.querySelector('input').dispatchEvent(new isolated.Event('change', { bubbles: true }));
    expect(navigate).toHaveBeenCalledWith('/collections/clothing?filter.v.option.color=White&breadcrumb_current=Clothing');
    expect(isolated.document.querySelector('a').hasAttribute('href')).toBe(false);
    await isolated.happyDOM.close();
  });
  it('clears collection filters without Dawn AJAX and preserves sorting and breadcrumb context', async () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const isolated = new Window({ url: 'https://example.test/collections/masks?filter.v.availability=1&sort_by=price-ascending&page=2&breadcrumb_current=Masks' });
    isolated.document.body.innerHTML = engine.renderFileSync('collection-filter-header', { heading_id: 'filters', heading: 'Filters', clear_label: 'Clear all', clear_url: '/collections/masks' });
    isolated.eval(readFileSync(resolve('assets/collection-breadcrumbs.js'), 'utf8'));
    expect(isolated.document.querySelector('facet-remove')).toBeNull();
    expect(isolated.document.querySelector('a').getAttribute('href')).toBe('/collections/masks?breadcrumb_current=Masks&sort_by=price-ascending');
    await isolated.happyDOM.close();
  });
  it('applies collection price changes and sorting without losing active filters', async () => {
    const isolated = new Window({ url: 'https://example.test/collections/masks?filter.v.availability=1&sort_by=price-ascending&page=2&breadcrumb_current=Masks' });
    isolated.document.body.innerHTML = '<nav class="collection-curated-filters"><price-range><input name="filter.v.price.gte" value="20" data-min="0" data-max="200"><input name="filter.v.price.lte" data-min="0" data-max="200"></price-range></nav><form><select name="sort_by"><option value="price-descending">High to low</option></select></form>';
    const navigate = vi.spyOn(isolated.location, 'assign').mockImplementation(() => {});
    isolated.eval(readFileSync(resolve('assets/collection-breadcrumbs.js'), 'utf8'));
    isolated.document.querySelector('input').dispatchEvent(new isolated.Event('change', { bubbles: true }));
    expect(navigate).toHaveBeenLastCalledWith('/collections/masks?filter.v.availability=1&sort_by=price-ascending&breadcrumb_current=Masks&filter.v.price.gte=20');
    isolated.document.querySelector('price-range').remove();
    isolated.eval(readFileSync(resolve('assets/facets.js'), 'utf8'));
    isolated.customElements.get('facet-filters-form').prototype.onSubmitHandler.call({}, { preventDefault() {}, target: isolated.document.querySelector('select') });
    expect(navigate).toHaveBeenLastCalledWith('/collections/masks?filter.v.availability=1&sort_by=price-descending&breadcrumb_current=Masks');
    await isolated.happyDOM.close();
  });
  it('preserves textbox and select labels, values and native validation states', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = engine.renderFileSync('ui-text-field', { id: 'email', name: 'email', label: 'Email', type: 'email', value: 'a"<b', required: true, invalid: true, described_by: 'email-error' });
    const input = container.querySelector('input');
    expect(input.value).toBe('a"<b');
    expect(input.labels[0].textContent).toBe('Email');
    expect(input.required).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    for (const state of ['disabled', 'readonly']) {
      container.innerHTML = engine.renderFileSync('ui-text-field', { id: 'locked', name: 'locked', label: 'Reference', [state]: true });
      expect(container.querySelector('input').hasAttribute(state)).toBe(true);
    }
    container.innerHTML = engine.renderFileSync('ui-select', { id: 'topic', name: 'topic', label: 'Topic', required: true, options: '<option value="advice" selected>Advice</option><option disabled>Unavailable</option>' });
    const select = container.querySelector('select');
    expect(select.labels[0].textContent).toBe('Topic');
    expect(select.value).toBe('advice');
    expect(select.required).toBe(true);
    expect(select.options[1].disabled).toBe(true);
    expect(container.querySelector('.fc-icon').getAttribute('aria-hidden')).toBe('true');
  });
  it('keeps the price controller bounds and form values on shared text fields', async () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    engine.registerFilter('t', key => ({ 'products.facets.from': 'From', 'products.facets.to': 'To' })[key]);
    engine.registerFilter('money_without_currency', amount => (amount / 100).toFixed(2));
    const filter = { label: 'Price', range_max: 25000, min_value: { param_name: 'filter.v.price.gte', value: 0 }, max_value: { param_name: 'filter.v.price.lte', value: 15000 } };
    const isolated = new Window();
    isolated.document.body.innerHTML = `<form>${engine.renderFileSync('price-facet', { filter, id_prefix: 'Filter-' }, { globals: { cart: { currency: { symbol: '$' } } } })}</form>`;
    isolated.eval(readFileSync(resolve('assets/facets.js'), 'utf8'));
    const prototype = isolated.customElements.get('price-range').prototype;
    const controller = { querySelectorAll: selector => isolated.document.querySelectorAll(selector) };
    controller.adjustToValidValues = input => prototype.adjustToValidValues.call(controller, input);
    controller.setMinAndMaxValues = () => prototype.setMinAndMaxValues.call(controller);
    controller.setMinAndMaxValues();
    const [minimum, maximum] = isolated.document.querySelectorAll('input');
    expect(minimum.value).toBe('0.00');
    expect(maximum.value).toBe('150.00');
    expect(minimum.labels[0].textContent).toBe('From ($)');
    expect(maximum.labels[0].textContent).toBe('To ($)');
    expect(minimum.dataset.max).toBe('150.00');
    minimum.value = '200';
    prototype.onRangeChange.call(controller, { currentTarget: minimum });
    expect(minimum.value).toBe('150');
    maximum.value = '400';
    prototype.onRangeChange.call(controller, { currentTarget: maximum });
    expect(maximum.value).toBe('250');
    const data = new isolated.FormData(isolated.document.querySelector('form'));
    expect(data.get('filter.v.price.gte')).toBe('150');
    expect(data.get('filter.v.price.lte')).toBe('250');
    await isolated.happyDOM.close();
  });
  it('uses one dropdown controller for selection, disabled options and native form events', async () => {
    const dropdown = document.createElement('ui-select');
    dropdown.innerHTML = '<label id="sort-label" for="sort">Sort by</label><select id="sort" name="sort_by"><option value="manual" selected>Featured</option><option disabled>Unavailable</option><option value="price-ascending">Price, low to high</option></select><button data-select-trigger></button><span data-select-current></span><div data-select-menu hidden></div><template data-select-check><svg></svg></template><p id="sort-validation" data-select-validation hidden></p>';
    const form = document.createElement('form');
    form.append(dropdown);
    document.body.append(form);
    const trigger = dropdown.querySelector('button');
    const select = dropdown.querySelector('select');
    const onChange = vi.fn();
    const onInput = vi.fn();
    select.addEventListener('change', onChange);
    select.addEventListener('input', onInput);
    trigger.focus();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(trigger.getAttribute('aria-activedescendant')).toBe('sort-option-2');
    expect(select.value).toBe('manual');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(select.value).toBe('price-ascending');
    expect(new FormData(form).get('sort_by')).toBe('price-ascending');
    expect(onInput).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
    expect(dropdown.querySelector('[data-select-current]').textContent).toBe('Price, low to high');
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    dropdown.querySelector('[data-select-index="1"]').click();
    expect(select.value).toBe('price-ascending');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(trigger.getAttribute('aria-activedescendant')).toBe('sort-option-0');
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(select.value).toBe('price-ascending');
    expect(dropdown.querySelector('[data-select-menu]').hidden).toBe(true);
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    expect(trigger.getAttribute('aria-activedescendant')).toBe('sort-option-0');
    document.body.click();
    expect(dropdown.querySelector('[data-select-menu]').hidden).toBe(true);
    trigger.click();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    form.dispatchEvent(new Event('reset'));
    select.selectedIndex = 0;
    await vi.waitFor(() => expect(dropdown.querySelector('[data-select-current]').textContent).toBe('Featured'));
    select.disabled = true;
    await vi.waitFor(() => expect(trigger.disabled).toBe(true));
    select.disabled = false;
    await vi.waitFor(() => expect(trigger.disabled).toBe(false));
    const extra = document.createElement('option');
    extra.value = 'newest';
    extra.textContent = 'Newest';
    select.append(extra);
    await vi.waitFor(() => expect(dropdown.querySelectorAll('[role="option"]')).toHaveLength(4));
    select.required = true;
    select.selectedIndex = -1;
    select.dispatchEvent(new Event('invalid', { cancelable: true }));
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBe('sort-validation');
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    dropdown.querySelector('[data-select-index="0"]').click();
    expect(trigger.getAttribute('aria-invalid')).toBe('false');
    expect(dropdown.querySelector('[data-select-validation]').hidden).toBe(true);
    const parentEscape = vi.fn();
    form.addEventListener('keyup', parentEscape);
    trigger.click();
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    trigger.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    expect(parentEscape).not.toHaveBeenCalled();
    dropdown.remove();
    form.append(dropdown);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });
  it('opens and dismisses localization without a header or mobile drawer', () => {
    const host = document.createElement('div');
    host.innerHTML = '<button aria-expanded="false">Country</button><div hidden><a href="#">United States</a></div>';
    document.body.append(host);
    const prototype = customElements.get('localization-form').prototype;
    const instance = { elements: { button: host.querySelector('button'), panel: host.querySelector('div') }, hasAttribute: () => false };
    instance.hidePanel = () => prototype.hidePanel.call(instance);
    prototype.openSelector.call(instance);
    expect(instance.elements.panel.hidden).toBe(false);
    prototype.onContainerKeyUp.call(instance, new KeyboardEvent('keyup', { code: 'Escape' }));
    expect(instance.elements.button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(instance.elements.button);
  });
  it('gives disabled and busy actions native semantics and removes disabled link destinations', async () => {
    const isolated = new Window();
    const template = isolated.document.createElement('template');
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    template.innerHTML = [
      { label: 'Unavailable', disabled: true },
      { label: 'Unavailable link', url: '#cards', disabled: true },
      { label: 'Saving', busy: true },
    ].map(parameters => engine.renderFileSync('ui-button', parameters)).join('');
    const controls = [...template.content.querySelectorAll('.ui-button')];
    const disabled = controls.find(element => element.textContent.trim() === 'Unavailable');
    expect(disabled.disabled).toBe(true);
    const link = controls.find(element => element.textContent.trim() === 'Unavailable link');
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
    const busy = controls.find(element => element.textContent.trim() === 'Saving');
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute('aria-busy')).toBe('true');
    await isolated.happyDOM.close();
  });
  it('disables native quantity buttons at boundaries and preserves locked quantities', () => {
    const parent = document.createElement('div');
    parent.innerHTML = '<button class="quantity__button" name="minus"></button><input type="number" value="1" min="1" max="5"><button class="quantity__button" name="plus"></button>';
    const input = parent.querySelector('input');
    const instance = { input, querySelector: selector => parent.querySelector(selector) };
    const validate = customElements.get('quantity-input').prototype.validateQtyRules;
    validate.call(instance);
    expect(parent.querySelector('[name="minus"]').disabled).toBe(true);
    expect(parent.querySelector('[name="plus"]').disabled).toBe(false);
    input.value = '5';
    validate.call(instance);
    expect(parent.querySelector('[name="plus"]').disabled).toBe(true);
    input.removeAttribute('max');
    validate.call(instance);
    expect(parent.querySelector('[name="plus"]').disabled).toBe(false);
    input.disabled = true;
    input.value = '3';
    validate.call(instance);
    expect(parent.querySelector('[name="minus"]').disabled).toBe(true);
    expect(parent.querySelector('[name="plus"]').disabled).toBe(true);
  });
  it('disables unavailable values in pills, swatches and select options', () => {
    const engine = new Liquid({ root: resolve('snippets'), extname: '.liquid' });
    engine.registerFilter('t', key => key);
    const value = new String('XL');
    Object.assign(value, { available: false, id: 'unavailable', selected: false, swatch: { color: { rgb: '255,255,255' } } });
    for (const picker_type of ['button', 'swatch', 'dropdown']) {
      const html = engine.renderFileSync('product-variant-options', { option: { name: 'Size', position: 1, values: [value] }, picker_type }, { globals: { section: { id: 'disabled-options' } } });
      const container = document.createElement('div');
      container.innerHTML = html;
      expect(container.querySelector('input, option').disabled).toBe(true);
    }
  });
  it('prevents repeat consent writes while busy and keeps failed choices visible', async () => {
    let callback;
    window.Shopify = { customerPrivacy: {
      currentVisitorConsent: () => ({ analytics: '', marketing: '', preferences: '' }),
      shouldShowBanner: () => true,
      setTrackingConsent: vi.fn((_value, done) => { callback = done; }),
    } };
    const consent = document.createElement('cookie-consent');
    consent.innerHTML = '<div data-consent-banner hidden></div><dialog data-consent-dialog></dialog><input data-action="consent-category" data-value="analytics" type="checkbox"><button data-action="consent-save">Save</button><p data-consent-error hidden>Error</p>';
    document.body.append(consent);
    await consent.setup();
    consent.applySelection();
    consent.applySelection();
    expect(window.Shopify.customerPrivacy.setTrackingConsent).toHaveBeenCalledOnce();
    expect(consent.getAttribute('aria-busy')).toBe('true');
    expect(consent.querySelector('button').disabled).toBe(true);
    callback({ error: 'Failed' });
    expect(consent.querySelector('[data-consent-banner]').hidden).toBe(false);
    expect(consent.querySelector('[data-consent-error]').hidden).toBe(false);
    expect(consent.querySelector('button').disabled).toBe(false);
  });
  it('cancels a closing menu before reopening and synchronizes ARIA on immediate close', async () => {
    const prototype = customElements.get('header-menu').prototype;
    const details = document.createElement('details');
    details.innerHTML = '<summary>Menu</summary><div>Panel</div>';
    details.open = true;
    let complete;
    const cancel = vi.fn();
    const content = details.querySelector('div');
    content.animate = () => ({ finished: new Promise(resolve => { complete = resolve; }), cancel });
    const instance = { mainDetailsToggle: details, content, querySelector: selector => details.querySelector(selector) };
    prototype.close.call(instance);
    prototype.open.call(instance);
    expect(cancel).toHaveBeenCalledOnce();
    complete();
    await Promise.resolve();
    expect(details.open).toBe(true);
    prototype.close.call(instance, true);
    expect(details.open).toBe(false);
    expect(details.querySelector('summary').getAttribute('aria-expanded')).toBe('false');
  });
  it('makes the outgoing menu inert while cross-fading to a sibling', async () => {
    const prototype = customElements.get('header-menu').prototype;
    const previous = document.createElement('details');
    previous.innerHTML = '<summary>Weapons</summary><div>Weapons panel</div>';
    previous.open = true;
    const content = previous.querySelector('div');
    let complete;
    let timing;
    content.animate = (_frames, options) => {
      timing = options;
      return { finished: new Promise(resolve => { complete = resolve; }), cancel() {} };
    };
    const previousMenu = { mainDetailsToggle: previous, content, querySelector: selector => previous.querySelector(selector) };
    previousMenu.close = (...args) => prototype.close.call(previousMenu, ...args);
    vi.spyOn(previous, 'closest').mockReturnValue(previousMenu);
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([previous]);
    const next = document.createElement('details');
    next.innerHTML = '<summary>Masks</summary><div>Masks panel</div>';
    prototype.open.call({ mainDetailsToggle: next, content: next.querySelector('div'), querySelector: selector => next.querySelector(selector) });
    expect(previous.querySelector('summary').getAttribute('aria-expanded')).toBe('false');
    expect(content.inert).toBe(true);
    expect(content.getAttribute('aria-hidden')).toBe('true');
    expect(next.hasAttribute('data-menu-switch')).toBe(true);
    expect(timing.duration).toBe(140);
    complete();
    await Promise.resolve();
    expect(previous.open).toBe(false);
    expect(next.open).toBe(true);
  });
});