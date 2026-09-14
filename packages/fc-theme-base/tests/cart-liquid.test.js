import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Liquid } from 'liquidjs';
import { describe, expect, it } from 'vitest';

const root = resolve('snippets');
const engine = new Liquid({ root, extname: '.liquid' });
engine.registerTag('doc', {
  parse(_token, tokens) {
    const stream = this.liquid.parser.parseStream(tokens);
    stream.on('token', token => { if (token.name === 'enddoc') stream.stop(); });
    stream.start();
  },
  render() { return ''; },
});
engine.registerFilter('t', key => key);
engine.registerFilter('image_url', image => image.src);
engine.registerFilter('image_tag', url => `<img src="${url}">`);
engine.registerFilter('money', amount => `$${(amount / 100).toFixed(2)}`);

describe('shared cart markup', () => {
  it('renders identical image-led rows with view-specific quantity and error targets', async () => {
    const cart = { items: [{
      index: 0, key: 'variant:key', title: 'Jacket - 44', quantity: 2,
      url: '/products/jacket?variant=10', url_to_remove: '/cart/change?id=10&quantity=0',
      product: { title: 'Mens jacket', has_only_default_variant: false },
      variant: { id: 10, quantity_rule: { min: 1, increment: 1 } },
      image: { src: '/jacket.png' }, options_with_values: [{ name: 'Size', value: '44' }],
      final_line_price: 12000, original_line_price: 14000, properties: [],
      instructions: { can_update_quantity: false, can_remove: false },
    }] };
    for (const [context, prefix] of [['page', 'Quantity-'], ['drawer', 'Drawer-quantity-']]) {
      const html = await engine.renderFile('cart-lines', { context }, { globals: { cart } });
      document.body.innerHTML = html;
      const row = document.querySelector('.fc-cart-line');
      expect(row.querySelector('.fc-cart-line__information').textContent).toContain('$120.00');
      expect(row.querySelector('.fc-cart-line__price s').textContent).toBe('$140.00');
      expect(row.querySelector('.fc-cart-line__options').textContent).toContain('44');
      expect(row.querySelector('input').id).toBe(`${prefix}1`);
      expect(row.querySelector('input').dataset.quantityLineKey).toBe('variant:key');
      expect(row.querySelector('input').disabled).toBe(true);
      expect(row.querySelector('cart-remove-button')).toBeNull();
      expect(row.querySelector('.fc-cart-line__product').nextElementSibling.classList.contains('fc-cart-line__commands')).toBe(true);
    }
  });
  it('renders native bundle contents without child quantity or remove controls', async () => {
    const html = await engine.renderFile('cart-item-contents', { context: 'page', item: {
      key: 'bundle:key', item_components: [{ quantity: 4, product: { title: 'Club & socks', has_only_default_variant: false }, variant: { title: 'XL' }, image: { src: '/socks.png' } }],
    } });
    document.body.innerHTML = html;
    expect(document.querySelector('details').id).toBe('CartContents-page-bundle-key');
    expect(document.querySelector('li').textContent).toContain('4 × Club & socks');
    expect(document.querySelector('input, button, cart-remove-button')).toBeNull();
    expect(await engine.renderFile('cart-item-contents', { item: {}, context: 'drawer' })).not.toContain('<details');
  });
  it('escapes saved notes and associates each view with its checkout form', async () => {
    const cart = { note: '</textarea><script>bad()</script>' };
    const html = await engine.renderFile('cart-note-editor', { context: 'drawer', form_id: 'CartDrawer-Form' }, { globals: { cart } });
    document.body.innerHTML = html;
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('textarea').value).toBe(cart.note);
    expect(document.querySelector('textarea').getAttribute('form')).toBe('CartDrawer-Form');
    expect(document.querySelector('textarea').classList.contains('ui-text-field__input')).toBe(true);
    expect(document.querySelector('[data-save-note]').classList.contains('ui-button')).toBe(true);
    expect(document.querySelector('[data-note-status]').getAttribute('role')).toBe('status');
  });
  it('reuses the shared field and button without losing discount hooks', async () => {
    engine.registerFilter('inline_asset_content', () => '<svg></svg>');
    document.body.innerHTML = await engine.renderFile('cart-discount', { context: 'page' });
    expect(document.querySelector('#CartDiscount-page').classList.contains('ui-text-field__input')).toBe(true);
    expect(document.querySelector('#CartDiscount-page').getAttribute('aria-describedby')).toBe('CartDiscountStatus-page');
    expect(document.querySelector('[data-apply-discount]').classList.contains('ui-button')).toBe(true);
    expect(document.querySelector('[data-discount-status]').getAttribute('role')).toBe('status');
  });
  it('uses Shopify merchandise subtotal and never invents a shipping price', async () => {
    const html = await engine.renderFile('cart-subtotal', {}, { globals: { cart: { items_subtotal_price: 3790 } } });
    expect(html).toContain('$37.90');
    expect(html).toContain('sections.cart.calculated_at_checkout');
  });
  it('includes the same bundle, discount and note components in both cart views', async () => {
    const drawer = await readFile(resolve(root, 'cart-drawer.liquid'), 'utf8');
    const page = await readFile(resolve('sections/main-cart-items.liquid'), 'utf8');
    const footer = await readFile(resolve('sections/main-cart-footer.liquid'), 'utf8');
    const lines = await readFile(resolve(root, 'cart-lines.liquid'), 'utf8');
    for (const source of [drawer, page]) expect(source).toContain("render 'cart-lines'");
    expect(lines).toContain("render 'cart-item-contents'");
    for (const source of [drawer, footer]) {
      expect(source).toContain("render 'cart-note-editor'");
      expect(source).toContain("render 'cart-discount'");
      expect(source).toContain("render 'cart-subtotal'");
    }
  });
});