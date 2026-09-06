import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../assets/policy-page.js';

let media;
let breakpointListener;

function mountPolicy(content) {
  const template = document.createElement('template');
  template.innerHTML = `
    <policy-page data-section-id="test-section">
      <nav class="policy-page__contents" hidden>
        <details class="policy-page__disclosure">
          <summary>On this page</summary>
          <ol class="policy-page__contents-list"></ol>
        </details>
      </nav>
      <article class="policy-page__article">${content}</article>
    </policy-page>`;
  const component = template.content.firstElementChild;
  document.body.append(component);
  return component;
}

beforeEach(() => {
  media = {
    matches: false,
    addEventListener: vi.fn((event, listener) => {
      breakpointListener = listener;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('policy contents', () => {
  it('uses main headings, preserves existing anchors, and assigns unique missing IDs', () => {
    const component = mountPolicy('<h2 id="shipping">Shipping</h2><h3>Detail</h3><h2>Returns</h2><h2>Returns</h2>');
    const links = [...component.querySelectorAll('.policy-page__contents a')];
    expect(links.map((link) => link.textContent)).toEqual(['Shipping', 'Returns', 'Returns']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#shipping',
      '#Policy-test-section-2',
      '#Policy-test-section-3',
    ]);
    expect(component.querySelector('.policy-page__contents').hidden).toBe(false);
    expect(component.querySelector('h2').tabIndex).toBe(-1);
    component.connectedCallback();
    expect(component.querySelectorAll('.policy-page__contents a')).toHaveLength(3);
  });

  it('hides empty contents while leaving the article readable', () => {
    const component = mountPolicy('<p>Complete policy text.</p>');
    expect(component.querySelector('.policy-page__contents').hidden).toBe(true);
    expect(component.querySelector('article').textContent).toBe('Complete policy text.');
    expect(component.querySelector('article').hidden).toBe(false);
  });

  it('closes mobile contents and focuses the selected heading', () => {
    const component = mountPolicy('<h2 id="returns">Returns</h2>');
    const disclosure = component.querySelector('details');
    expect(disclosure.open).toBe(false);
    disclosure.open = true;
    component.querySelector('.policy-page__contents a').click();
    expect(disclosure.open).toBe(false);
    expect(document.activeElement).toBe(component.querySelector('h2'));
  });

  it('keeps desktop contents open and responds to breakpoint changes', () => {
    media.matches = true;
    const component = mountPolicy('<h2>Shipping</h2>');
    const disclosure = component.querySelector('details');
    expect(disclosure.open).toBe(true);
    component.querySelector('.policy-page__contents a').click();
    expect(disclosure.open).toBe(true);
    media.matches = false;
    breakpointListener();
    expect(disclosure.open).toBe(false);
  });

  it('cleans up and reconnects without duplicate links or listeners', () => {
    const component = mountPolicy('<h2>Shipping</h2>');
    const originalListener = breakpointListener;
    component.remove();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', originalListener);
    document.body.append(component);
    expect(component.querySelectorAll('.policy-page__contents a')).toHaveLength(1);
    expect(media.addEventListener).toHaveBeenCalledTimes(2);
  });
});

describe('policy tables', () => {
  it('adds mobile labels without losing content or table semantics', () => {
    const component = mountPolicy(`
      <table>
        <thead><tr><th>Category</th><th>Recipients</th></tr></thead>
        <tbody><tr><td>Contact information</td><td><a href="/pages/privacy-policy">Partners</a></td></tr></tbody>
      </table>`);
    const table = component.querySelector('table');
    expect(table.classList.contains('policy-page__table--stacked')).toBe(true);
    expect(table.getAttribute('role')).toBe('table');
    expect(table.querySelectorAll('th[scope="col"][role="columnheader"]')).toHaveLength(2);
    expect(table.querySelectorAll('td[role="cell"]')).toHaveLength(2);
    expect([...table.querySelectorAll('.policy-page__table-label')].map((label) => label.textContent)).toEqual([
      'Category',
      'Recipients',
    ]);
    expect(table.querySelectorAll('.policy-page__table-label[aria-hidden="true"]')).toHaveLength(2);
    expect(table.querySelector('a').textContent).toBe('Partners');
    expect(table.querySelector('a').getAttribute('href')).toBe('/pages/privacy-policy');
    component.prepareTables();
    expect(component.querySelectorAll('.policy-page__table-scroll')).toHaveLength(1);
    expect(table.querySelectorAll('.policy-page__table-label')).toHaveLength(2);
  });

  it.each([
    '<tbody><tr><td>No headers</td></tr></tbody>',
    '<thead><tr><th>Empty table</th></tr></thead>',
    '<thead><tr><th>Category</th><th>Recipients</th></tr></thead><tbody><tr><td>Incomplete row</td></tr></tbody>',
    '<thead><tr><th>Category</th></tr></thead><tbody><tr><td colspan="2">Spanning cell</td></tr></tbody>',
  ])('keeps unsupported table structures readable and scrollable: %s', (markup) => {
    const component = mountPolicy(`<table>${markup}</table>`);
    expect(component.querySelectorAll('.policy-page__table-scroll table')).toHaveLength(1);
    expect(component.querySelectorAll('.policy-page__table--stacked')).toHaveLength(0);
    expect(component.querySelectorAll('.policy-page__table-label')).toHaveLength(0);
  });
});