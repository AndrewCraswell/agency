import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildSizingManifest } from './build-manifest.mjs';

export function buildMigrationManifest(sizing, navigation, assignments, pages, collections = [], journal) {
  const { resources } = buildSizingManifest(sizing);
  for (const [key, name, type] of [
    ['weapon', 'Weapon', 'list.single_line_text_field'],
    ['gender', 'Gender', 'single_line_text_field'],
    ['skill_level', 'Skill Level', 'single_line_text_field'],
    ['protection_rating', 'Safety Level', 'single_line_text_field'],
    ['fie_status', 'FIE Rating', 'single_line_text_field'],
  ]) {
    resources.push({ key: `definition.${key}`, kind: 'product-metafield-definition', data: {
      namespace: 'custom', key, name, type, ownerType: 'PRODUCT', access: { storefront: 'PUBLIC_READ' },
    } });
  }
  for (const collection of collections) resources.push({ key: `collection.${collection.handle}`, kind: 'collection', data: collection });
  if (journal) resources.push({ key: `blog.${journal.handle}`, kind: 'blog', data: journal });
  const addLinks = (items) => items.map((item) => {
    const path = item.url.split('/');
    const kind = { collections: 'collection', pages: 'page', blogs: 'blog' }[path[1]];
    const key = `${kind}.${path[2]}`;
    const known = resources.some((resource) => resource.key === key) || pages.some((page) => `page.${page.handle}` === key);
    const link = known ? { type: kind.toUpperCase(), resourceId: { $ref: key } } : { type: 'HTTP', url: item.url };
    return { title: item.title, ...link, ...(item.items ? { items: addLinks(item.items) } : {}) };
  });
  for (const menu of navigation.menus) resources.push({ key: `menu.${menu.handle}`, kind: 'menu', data: { handle: menu.handle, title: menu.title, items: addLinks(menu.items) } });
  for (const [productHandle, chartHandle] of Object.entries(assignments)) {
    if (!sizing.charts.some((chart) => chart.handle === chartHandle)) throw new Error(`Unknown chart: ${chartHandle}`);
    resources.push({ key: `assignment.${productHandle}`, kind: 'product-chart-assignment', data: {
      productHandle, namespace: 'custom', key: 'size_chart', value: { $ref: `chart.${chartHandle}` },
    } });
  }
  for (const page of pages) resources.push({ key: `page.${page.handle}`, kind: 'page', data: page });
  return { name: 'fencing-club-migration', resources };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
  const manifest = buildMigrationManifest(await read('./sizing-source.json'), await read('./navigation-source.json'), await read('./chart-assignments.json'), await read('./pages-source.json'), (await read('./collections-source.json')).collections.nodes, await read('./journal-source.json'));
  await writeFile(new URL('./migration-manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
}