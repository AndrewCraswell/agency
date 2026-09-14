import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(async () => {
  window.StandardEvents = { createViewEventElement: () => class extends HTMLElement { connectedCallback() {} } };
  vi.stubGlobal('debounce', handler => handler);
  vi.stubGlobal('ON_CHANGE_DEBOUNCE_TIMER', 0);
  vi.stubGlobal('PUB_SUB_EVENTS', { cartUpdate: 'cart-update' });
  vi.stubGlobal('subscribe', () => () => {});
  await import('../assets/cart.js');
  await import('../assets/cart-controls.js');
  customElements.define('cart-drawer-items', class extends customElements.get('cart-items') {});
});
beforeEach(() => {
  document.body.innerHTML = '<cart-items><div id="main-cart-items"></div><p id="shopping-cart-line-item-status"></p></cart-items><cart-drawer><cart-drawer-items><div id="CartDrawer-CartItems"><input id="Drawer-quantity-1" value="2" data-index="1"></div><p id="CartDrawer-LineItemStatus"></p></cart-drawer-items></cart-drawer>';
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('cart controller view ownership', () => {
  it('loads only the drawer items when the page cart is also mounted', () => {
    const drawer = document.querySelector('cart-drawer-items');
    drawer.enableLoading(1);
    expect(document.querySelector('#CartDrawer-CartItems').classList.contains('cart__items--disabled')).toBe(true);
    expect(document.querySelector('#main-cart-items').classList.contains('cart__items--disabled')).toBe(false);
    drawer.disableLoading(1);
    expect(document.querySelector('#CartDrawer-CartItems').classList.contains('cart__items--disabled')).toBe(false);
  });
  it('restores a rejected drawer quantity using its own input', () => {
    const drawer = document.querySelector('cart-drawer-items');
    drawer.querySelector('input').value = '0';
    drawer.resetQuantityInput(1);
    expect(drawer.querySelector('input').value).toBe('2');
  });
  it('does not interpret note and disclosure changes as quantities', () => {
    const cart = document.querySelector('cart-items');
    const validate = vi.spyOn(cart, 'validateQuantity');
    cart.onChange({ target: document.createElement('textarea') });
    expect(validate).not.toHaveBeenCalled();
  });
  it('serializes mutations and blocks checkout until all requests finish', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button name="checkout">Check out</button>');
    const controller = customElements.get('cart-items');
    let finish;
    const order = [];
    const first = controller.mutate(() => new Promise(resolve => { order.push('first'); finish = resolve; }));
    const second = controller.mutate(() => { order.push('second'); });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    expect(document.querySelector('[name="checkout"]').disabled).toBe(true);
    expect(order).toEqual(['first']);
    finish();
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
    expect(document.querySelector('[name="checkout"]').disabled).toBe(false);
  });
  it('blocks checkout before the debounced quantity request starts', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button name="checkout">Check out</button>');
    const drawer = document.querySelector('cart-drawer-items');
    const change = vi.spyOn(drawer, 'onChange').mockImplementation(() => {});
    drawer.querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('[name="checkout"]').disabled).toBe(true);
    await vi.waitFor(() => expect(change).toHaveBeenCalledOnce());
    expect(document.querySelector('[name="checkout"]').disabled).toBe(false);
  });
  it('saves a note, synchronizes the other view and retains edits on failure', async () => {
    vi.stubGlobal('routes', { cart_update_url: '/cart/update.js' });
    vi.stubGlobal('fetchConfig', () => ({ method: 'POST' }));
    document.body.innerHTML = '<button name="checkout">Check out</button><cart-note data-saved="Saved" data-error="Failed" data-dirty="Unsaved"><textarea></textarea><button data-save-note>Save</button><p data-note-status></p></cart-note><cart-note data-saved="Saved"><textarea></textarea><p data-note-status></p></cart-note>';
    const note = document.querySelector('cart-note');
    const input = note.querySelector('textarea');
    input.value = 'Club order';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[name="checkout"]').disabled).toBe(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ note: 'Club order' }) }));
    await note.save();
    expect(document.querySelectorAll('textarea')[1].value).toBe('Club order');
    expect(note.hasAttribute('data-unsaved')).toBe(false);
    input.value = 'Changed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fetch.mockRejectedValue(new Error('Offline'));
    await note.save();
    expect(note.querySelector('[data-note-status]').textContent).toBe('Failed');
    expect(input.value).toBe('Changed');
    expect(document.querySelector('[name="checkout"]').disabled).toBe(true);
  });
  it('preserves expanded bundles and an unsaved note across section replacement', () => {
    const target = document.createElement('div');
    const source = document.createElement('div');
    const markup = '<details id="contents"><summary>Contents</summary></details><cart-note><textarea id="note"></textarea><p data-note-status></p></cart-note>';
    target.innerHTML = markup;
    source.innerHTML = markup;
    target.querySelector('details').open = true;
    target.querySelector('cart-note').setAttribute('data-unsaved', '');
    target.querySelector('textarea').value = 'Keep this';
    customElements.get('cart-items').preserveControls(target, source);
    expect(source.querySelector('details').open).toBe(true);
    expect(source.querySelector('textarea').value).toBe('Keep this');
    expect(source.querySelector('cart-note').hasAttribute('data-unsaved')).toBe(true);
  });
  it('applies and removes only the requested discount while keeping other codes', async () => {
    document.body.replaceChildren();
    vi.stubGlobal('routes', { cart_url: '/cart', cart_update_url: '/cart/update.js' });
    vi.stubGlobal('fetchConfig', () => ({ method: 'POST' }));
    let codes = [{ code: 'EXISTING', applicable: true }];
    const requests = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (options?.body) {
        const data = JSON.parse(options.body);
        requests.push(data);
        codes = data.discount.split(',').filter(Boolean).map(code => ({ code, applicable: true }));
      }
      return { ok: true, json: async () => ({ discount_codes: codes }) };
    }));
    document.body.innerHTML = '<cart-discount data-applied="Applied" data-removed="Removed" data-invalid="Invalid" data-error="Failed" data-remove-label="Remove"><details><input id="discount"><button data-apply-discount>Apply</button><p data-discount-status></p><ul data-discount-codes></ul></details></cart-discount>';
    const control = document.querySelector('cart-discount');
    await control.refresh();
    control.querySelector('input').value = 'CLUB';
    await control.update();
    expect(requests[0]).toEqual({ discount: 'EXISTING,CLUB' });
    expect(control.querySelector('[data-discount-status]').textContent).toBe('Applied');
    await control.update('CLUB');
    expect(requests[1]).toEqual({ discount: 'EXISTING' });
    expect(control.querySelector('[data-discount-status]').textContent).toBe('Removed');
  });
  it('shows invalid and network discount feedback without losing the entered code', async () => {
    document.body.replaceChildren();
    vi.stubGlobal('routes', { cart_url: '/cart', cart_update_url: '/cart/update.js' });
    vi.stubGlobal('fetchConfig', () => ({ method: 'POST' }));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ discount_codes: [] }) })));
    document.body.innerHTML = '<cart-discount data-invalid="Invalid" data-error="Failed"><details><input id="discount"><button data-apply-discount>Apply</button><p data-discount-status></p><ul data-discount-codes></ul></details></cart-discount>';
    const control = document.querySelector('cart-discount');
    control.querySelector('input').value = 'NOPE';
    await control.update();
    expect(control.querySelector('[data-discount-status]').textContent).toBe('Invalid');
    expect(control.querySelector('input').getAttribute('aria-invalid')).toBe('true');
    fetch.mockRejectedValue(new Error('Offline'));
    await control.update();
    expect(control.querySelector('[data-discount-status]').textContent).toBe('Failed');
    expect(control.querySelector('input').value).toBe('NOPE');
    expect(control.querySelector('button').disabled).toBe(false);
  });
});