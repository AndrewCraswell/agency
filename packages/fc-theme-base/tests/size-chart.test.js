import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../assets/size-chart.js';
import '../assets/ui-drawer.js';

function mountChart({ page = true, imperial = true, linkId = '' } = {}) {
  const template = document.createElement('template');
  template.innerHTML = `<size-chart data-update-url="${page}" data-has-imperial="${imperial}" data-chart-url="/pages/size-charts/mens-jackets" data-full-chart-link-id="${linkId}">
    <div data-chart-controls hidden>${['44', '46', '48'].map((size) => `<button data-size-option="${size}" aria-pressed="false">${size}</button>`).join('')}
      <input data-chart-unit type="radio" name="unit" value="cm"><input data-chart-unit type="radio" name="unit" value="in"></div>
    <div data-chart-table-region><table><tbody><tr>${['44', '46', '48'].map((size) => `<td data-size-column="${size}"><span data-value-unit="cm">84 - 88</span><span data-value-unit="in" hidden>33 - 35</span></td>`).join('')}</tr></tbody></table></div>
    <p data-chart-empty hidden>No sizes selected</p><details data-chart-help open><summary>How to measure</summary></details>
    </size-chart>`;
  const element = template.content.firstElementChild;
  document.body.append(element);
  return element;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/pages/size-charts/mens-jackets');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('shared size chart', () => {
  it('opens help for printing and restores the prior disclosure state', () => {
    const chart = mountChart();
    const help = chart.querySelector('[data-chart-help]');
    expect(help.open).toBe(false);
    window.dispatchEvent(new Event('beforeprint'));
    expect(help.open).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    expect(help.open).toBe(false);
  });
  it('starts with two columns and toggles presentation without removing the source data', () => {
    const chart = mountChart();
    expect(chart.querySelectorAll('[data-size-column]:not([hidden])')).toHaveLength(2);
    chart.querySelector('[data-size-option="48"]').click();
    expect(chart.querySelectorAll('[data-size-column]:not([hidden])')).toHaveLength(3);
    expect(chart.querySelector('[data-size-option="48"]').getAttribute('aria-pressed')).toBe('true');
    expect(new URL(window.location.href).searchParams.getAll('size')).toEqual(['44', '46', '48']);
    expect(chart.querySelectorAll('[data-size-column]')).toHaveLength(3);
  });

  it('loads shared selection/unit links and supports an intentionally empty selection', () => {
    window.history.replaceState({}, '', '?size=48&unit=in');
    const chart = mountChart();
    expect(chart.querySelector('[data-size-option="48"]').getAttribute('aria-pressed')).toBe('true');
    expect(chart.querySelector('[data-value-unit="in"]').hidden).toBe(false);
    chart.querySelector('[data-size-option="48"]').click();
    expect(chart.querySelector('[data-chart-empty]').hidden).toBe(false);
    expect(chart.querySelector('[data-chart-table-region]').hidden).toBe(true);
    chart.remove();
    const reloaded = mountChart();
    expect(reloaded.querySelector('[data-chart-empty]').hidden).toBe(false);
  });

  it('rejects unsupported URL values and responds to browser navigation', () => {
    window.history.replaceState({}, '', '?size=unknown&unit=unknown');
    const chart = mountChart({ imperial: false });
    expect(chart.selected.size).toBe(2);
    expect(chart.unit).toBe('cm');
    window.history.replaceState({}, '', '?size=48&unit=in');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect([...chart.selected]).toEqual(['48']);
    expect(chart.unit).toBe('cm');
  });

  it('keeps flyout state off the product URL and writes it into the full-chart link', () => {
    window.history.replaceState({}, '', '/products/jacket?variant=123');
    const footer = document.createElement('footer');
    footer.innerHTML = '<a id="FullChartLink-first" href="/pages/size-charts/mens-jackets">View full chart</a><a id="FullChartLink-second" href="/pages/size-charts/mens-jackets">View full chart</a>';
    document.body.append(footer);
    const chart = mountChart({ page: false, linkId: 'FullChartLink-first' });
    const otherChart = mountChart({ page: false, linkId: 'FullChartLink-second' });
    const otherHref = document.getElementById('FullChartLink-second').href;
    chart.querySelector('[data-size-option="48"]').click();
    const unit = chart.querySelector('[value="in"]');
    unit.checked = true;
    unit.dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.location.pathname).toBe('/products/jacket');
    expect(window.location.search).toBe('?variant=123');
    const link = new URL(document.getElementById('FullChartLink-first').href);
    expect(link.pathname).toBe('/pages/size-charts/mens-jackets');
    expect(link.searchParams.get('unit')).toBe('in');
    expect(link.searchParams.getAll('size')).toEqual(['44', '46', '48']);
    expect(document.getElementById('FullChartLink-second').href).toBe(otherHref);
    expect(otherChart.unit).toBe('cm');
    for (const button of chart.buttons) button.click();
    expect(new URL(document.getElementById('FullChartLink-first').href).searchParams.getAll('size')).toEqual(['']);
  });

  it('reconnects without duplicate handlers and keeps desktop help open', () => {
    window.matchMedia.mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const chart = mountChart();
    chart.connectedCallback();
    expect(chart.querySelector('[data-chart-help]').open).toBe(true);
    chart.remove();
    document.body.append(chart);
    chart.querySelector('[data-size-option="48"]').click();
    expect(chart.selected.has('48')).toBe(true);
  });
});

describe('responsive chart navigation', () => {
  it('responds to desktop changes and cleans up its listener', () => {
    let listener;
    const media = { matches: false, addEventListener: vi.fn((_event, callback) => { listener = callback; }), removeEventListener: vi.fn() };
    window.matchMedia.mockReturnValue(media);
    const template = document.createElement('template');
    template.innerHTML = '<size-chart-navigation><details data-size-navigation open><summary>Browse size charts</summary></details></size-chart-navigation>';
    document.body.append(template.content);
    const navigation = document.querySelector('size-chart-navigation');
    navigation.connectedCallback();
    expect(navigation.querySelector('details').open).toBe(false);
    media.matches = true;
    listener();
    expect(navigation.querySelector('details').open).toBe(true);
    navigation.remove();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', listener);
  });
});

describe('product size-chart dialog', () => {
  it('retains chart selections and product state when the shared drawer closes and reopens', () => {
    window.history.replaceState({}, '', '/products/jacket?variant=123');
    const template = document.createElement('template');
    template.innerHTML = '<input name="quantity" value="2"><ui-drawer><a href="/pages/size-charts/mens-jackets" data-drawer-open>Size chart</a><dialog><div data-drawer-backdrop></div><div data-drawer-panel><button data-drawer-close>Close size chart</button></div></dialog></ui-drawer>';
    document.body.append(template.content);
    const drawer = document.querySelector('ui-drawer');
    const dialog = drawer.querySelector('dialog');
    dialog.showModal = vi.fn(() => { dialog.open = true; });
    dialog.close = vi.fn(() => { dialog.open = false; dialog.dispatchEvent(new Event('close')); });
    const chart = mountChart({ page: false });
    drawer.panel.append(chart);
    drawer.querySelector('[data-drawer-open]').click();
    chart.querySelector('[data-size-option="48"]').click();
    chart.querySelector('[value="in"]').dispatchEvent(new Event('change', { bubbles: true }));
    drawer.hide();
    drawer.show();
    expect([...chart.selected]).toEqual(['44', '46', '48']);
    expect(chart.unit).toBe('in');
    expect(window.location.search).toBe('?variant=123');
    expect(document.querySelector('[name="quantity"]').value).toBe('2');
  });
});