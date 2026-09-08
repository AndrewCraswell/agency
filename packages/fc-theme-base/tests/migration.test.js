import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMigrationManifest } from '../content/build-migration.mjs';

const read = async (name) => JSON.parse(await readFile(resolve('content', name), 'utf8'));

describe('Fencing Club migration package', () => {
  it('packages approved menus and explicit chart assignments without store IDs', async () => {
    const manifest = buildMigrationManifest(await read('sizing-source.json'), await read('navigation-source.json'), await read('chart-assignments.json'), []);
    expect(manifest.resources.filter((resource) => resource.kind === 'menu')).toHaveLength(6);
    expect(manifest.resources.filter((resource) => resource.kind === 'product-chart-assignment')).toHaveLength(26);
    expect(JSON.stringify(manifest)).not.toContain('gid://shopify/');
    expect(JSON.stringify(manifest)).not.toContain('/collections/sabre');
    expect(JSON.stringify(manifest)).not.toContain('/apps/track');
  });

  it('rejects an assignment to a missing chart', () => {
    expect(() => buildMigrationManifest({ charts: [], guides: [], groups: [] }, { menus: [] }, { jacket: 'missing' }, [])).toThrow('Unknown chart');
  });

  it('resolves packaged collection and page links through stable resource keys', async () => {
    const navigation = { menus: [{ handle: 'main-menu', title: 'Main menu', items: [{ title: 'Jackets', url: '/collections/jackets' }, { title: 'Contact', url: '/pages/contact' }] }] };
    const manifest = buildMigrationManifest(await read('sizing-source.json'), navigation, {}, [{ handle: 'contact', title: 'Contact', body: '', templateSuffix: 'contact', isPublished: true }], [{ handle: 'jackets', title: 'Jackets', descriptionHtml: '', sortOrder: 'ALPHA_ASC', productHandles: [], image: null }]);
    expect(manifest.resources.find((resource) => resource.key === 'menu.main-menu').data.items).toEqual([
      { title: 'Jackets', type: 'COLLECTION', resourceId: { $ref: 'collection.jackets' } },
      { title: 'Contact', type: 'PAGE', resourceId: { $ref: 'page.contact' } },
    ]);
  });
});