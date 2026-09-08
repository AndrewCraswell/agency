import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSizingLiquid, themeRoot } from './helpers/sizing-liquid.mjs';

const engine = createSizingLiquid();
async function renderDrawer(options) {
  const template = document.createElement('template');
  template.innerHTML = await engine.renderFile('ui-drawer', {
    id: 'HelpDrawer', title: 'Help', close_label: 'Close help', content: '<p>Content</p>', ...options,
  });
  return template.content;
}

describe('shared drawer Liquid', () => {
  it('keeps the empty decorative backdrop visible alongside Dawn styles', async () => {
    const styles = document.createElement('style');
    styles.textContent = (await Promise.all(['base.css', 'component-drawer.css'].map((file) => readFile(resolve(themeRoot, 'assets', file), 'utf8')))).join('\n');
    const host = document.createElement('div');
    const fragment = await renderDrawer();
    fragment.querySelectorAll('link, script').forEach((element) => element.remove());
    host.append(fragment);
    document.head.append(styles);
    document.body.append(host);
    try {
      expect(getComputedStyle(host.querySelector('[data-drawer-backdrop]')).display).toBe('block');
    } finally {
      host.remove();
      styles.remove();
    }
  });

  it('renders an accessible shell with caller content and optional footer, independent of sizing', async () => {
    const fragment = await renderDrawer({
      trigger: '<button type="button" data-drawer-open aria-controls="HelpDrawer">Help</button>',
      footer: '<button type="button">Apply</button>', description: 'More information', size: 'wide', side: 'start',
    });
    const dialog = fragment.querySelector('dialog');
    expect(dialog.open).toBe(false);
    expect(dialog.id).toBe('HelpDrawer');
    expect(dialog.getAttribute('aria-labelledby')).toBe('HelpDrawer-Title');
    expect(dialog.classList.contains('ui-drawer--wide')).toBe(true);
    expect(dialog.classList.contains('ui-drawer--start')).toBe(true);
    expect(fragment.querySelector('[data-drawer-close]').getAttribute('aria-label')).toBe('Close help');
    expect(fragment.querySelector('.ui-drawer__body').textContent).toBe('Content');
    expect(fragment.querySelector('.ui-drawer__footer').textContent).toBe('Apply');
    expect(fragment.querySelector('.ui-drawer__description').textContent).toBe('More information');
    expect(fragment.querySelector('[data-drawer-backdrop]').getAttribute('aria-hidden')).toBe('true');
  });

  it('omits optional regions and escapes plain text without escaping caller HTML', async () => {
    const fragment = await renderDrawer({ title: '<Help>', close_label: 'Close "help"' });
    expect(fragment.querySelector('.ui-drawer__footer')).toBeNull();
    expect(fragment.querySelector('.ui-drawer__description')).toBeNull();
    expect(fragment.querySelector('.ui-drawer__title').textContent).toBe('<Help>');
    expect(fragment.querySelector('[data-drawer-close]').getAttribute('aria-label')).toBe('Close "help"');
    expect(fragment.querySelector('.ui-drawer__body p')).not.toBeNull();
  });
});