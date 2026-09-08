import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../assets/ui-drawer.js';

let motion;
function mountDrawer(parent = document.body) {
  const template = document.createElement('template');
  template.innerHTML = '<ui-drawer><a data-drawer-open href="/pages/help" aria-haspopup="dialog" aria-expanded="false">Help</a><dialog><div data-drawer-backdrop></div><div data-drawer-panel><button data-drawer-close>Close help</button><input aria-label="Notes"></div></dialog></ui-drawer>';
  const drawer = template.content.firstElementChild;
  const dialog = drawer.querySelector('dialog');
  dialog.showModal = vi.fn(() => { dialog.open = true; });
  dialog.close = vi.fn(() => { dialog.open = false; dialog.dispatchEvent(new Event('close')); });
  parent.append(drawer);
  return { drawer, dialog, trigger: drawer.querySelector('[data-drawer-open]'), panel: drawer.querySelector('[data-drawer-panel]'), backdrop: drawer.querySelector('[data-drawer-backdrop]') };
}

function mockAnimations(drawer) {
  const pending = [];
  for (const element of [drawer.panel, drawer.backdrop]) {
    element.animate = vi.fn((frames, options) => {
      let resolve;
      let reject;
      const finished = new Promise((accept, decline) => { resolve = accept; reject = decline; });
      const animation = { finished, cancel: vi.fn(() => reject(new Error('Canceled'))), finish: resolve };
      pending.push({ frames, options, animation });
      return animation;
    });
  }
  return pending;
}

beforeEach(() => {
  motion = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => motion));
  document.body.style.cssText = '';
});
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('shared drawer', () => {
  it('opens, focuses close and restores exact scroll styles and trigger focus', () => {
    document.body.style.setProperty('overflow', 'auto', 'important');
    document.body.style.paddingRight = '7px';
    const { drawer, dialog, trigger } = mountDrawer();
    drawer.connectedCallback();
    trigger.focus();
    trigger.click();
    trigger.click();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(drawer.querySelector('[data-drawer-close]'));
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    drawer.querySelector('[data-drawer-close]').click();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
    expect(document.body.style.paddingRight).toBe('7px');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    drawer.hide();
  });

  it('animates panel and backdrop, retaining modality and scroll lock through exit', async () => {
    const mounted = mountDrawer();
    const pending = mockAnimations(mounted.drawer);
    const opened = vi.fn();
    const closed = vi.fn();
    mounted.drawer.addEventListener('drawer:opened', opened);
    mounted.drawer.addEventListener('drawer:closed', closed);
    mounted.trigger.click();
    expect(mounted.drawer.dataset.state).toBe('opening');
    expect(pending[0].frames).toEqual([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]);
    expect(pending[1].frames).toEqual([{ opacity: '0' }, { opacity: '1' }]);
    expect(pending[0].options.duration).toBe(250);
    pending.forEach(({ animation }) => animation.finish());
    await vi.waitFor(() => expect(opened).toHaveBeenCalledOnce());
    mounted.drawer.hide();
    mounted.drawer.hide();
    expect(mounted.dialog.open).toBe(true);
    expect(mounted.drawer.dataset.state).toBe('closing');
    expect(document.body.style.overflow).toBe('hidden');
    pending.slice(2).forEach(({ animation }) => animation.finish());
    await vi.waitFor(() => expect(closed).toHaveBeenCalledOnce());
    expect(mounted.dialog.open).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('cancels interrupted animations without letting a stale close win', async () => {
    const { drawer, dialog, trigger } = mountDrawer();
    const pending = mockAnimations(drawer);
    trigger.click();
    drawer.hide();
    drawer.show();
    await Promise.resolve();
    pending.forEach(({ animation }) => animation.finish());
    await vi.waitFor(() => expect(drawer.dataset.state).toBe('open'));
    expect(dialog.open).toBe(true);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(pending.slice(0, 4).every(({ animation }) => animation.cancel.mock.calls.length === 1)).toBe(true);
    drawer.remove();
    expect(document.body.style.overflow).toBe('');
  });

  it('disables motion on request, including while a close is running', () => {
    const { drawer, trigger, dialog } = mountDrawer();
    const pending = mockAnimations(drawer);
    motion.matches = true;
    trigger.click();
    expect(pending).toHaveLength(0);
    expect(drawer.dataset.state).toBe('open');
    motion.matches = false;
    drawer.hide();
    expect(dialog.open).toBe(true);
    motion.matches = true;
    motion.addEventListener.mock.calls[0][1]();
    expect(dialog.open).toBe(false);
    drawer.remove();
    expect(motion.removeEventListener).toHaveBeenCalled();
  });

  it('supports Escape, native cancel, and backdrop taps but not drags from the panel', () => {
    const { drawer, dialog, trigger, backdrop, panel } = mountDrawer();
    trigger.click();
    panel.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    backdrop.click();
    expect(dialog.open).toBe(true);
    backdrop.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    backdrop.click();
    expect(dialog.open).toBe(false);
    trigger.click();
    const cancel = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog.open).toBe(false);
    trigger.click();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(dialog.open).toBe(true);
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialog.open).toBe(false);
    expect(drawer.dataset.state).toBe('closed');
  });

  it('keeps nested drawers independently modal without unlocking the parent', () => {
    const parent = mountDrawer();
    const child = mountDrawer(parent.panel);
    parent.trigger.click();
    child.trigger.focus();
    child.trigger.click();
    child.drawer.querySelector('[data-drawer-close]').click();
    expect(child.dialog.open).toBe(false);
    expect(parent.dialog.open).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(child.trigger);
    child.trigger.click();
    parent.drawer.remove();
    expect(document.body.style.overflow).toBe('');
  });

  it('preserves fallback and modified-click navigation and handles failed dialog opening', () => {
    const { drawer, dialog, trigger } = mountDrawer();
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    trigger.dispatchEvent(modified);
    expect(modified.defaultPrevented).toBe(false);
    expect(dialog.showModal).not.toHaveBeenCalled();
    dialog.showModal = undefined;
    const fallback = new MouseEvent('click', { bubbles: true, cancelable: true });
    trigger.dispatchEvent(fallback);
    expect(fallback.defaultPrevented).toBe(false);
    dialog.showModal = () => { throw new Error('Unavailable'); };
    expect(drawer.show()).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('cleans up native closes and reconnects without duplicate listeners', () => {
    const { drawer, dialog, trigger } = mountDrawer();
    const closed = vi.fn();
    drawer.addEventListener('drawer:closed', closed);
    trigger.click();
    dialog.close();
    expect(document.body.style.overflow).toBe('');
    expect(closed).toHaveBeenCalledOnce();
    drawer.remove();
    document.body.append(drawer);
    trigger.click();
    expect(dialog.showModal).toHaveBeenCalledTimes(2);
    dialog.dispatchEvent(new Event('close'));
    expect(document.body.style.overflow).toBe('hidden');
    drawer.hide();
  });
});