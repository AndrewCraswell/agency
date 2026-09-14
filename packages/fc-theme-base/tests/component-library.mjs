import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { products, articles, sections, blogs, localization, announcements, catalogProducts, catalogFixture, commerce, gallery, policy } from './component-library/fixtures.mjs';
import { chartFixtures } from './helpers/sizing-liquid.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
const themeRoot = resolve(directory, '..');
const fixtures = resolve(directory, 'component-library');
const locale = JSON.parse(readFileSync(resolve(themeRoot, 'locales/en.default.json'), 'utf8'));
const navigation = JSON.parse(readFileSync(resolve(themeRoot, 'content/navigation-source.json'), 'utf8'));
const popularCategoriesMenu = 'component-lab-categories';
const linklists = { [popularCategoriesMenu]: { links: navigation.menus[0].items.slice(0, 5).map(item => ({ title: item.title, url: '#browsing' })) } };
const engine = new Liquid({ root: [fixtures, resolve(themeRoot, 'snippets'), resolve(themeRoot, 'sections')], extname: '.liquid', cache: process.env.NODE_ENV === 'test' });
engine.registerTag('doc', {
  parse(_token, tokens) {
    const stream = this.liquid.parser.parseStream(tokens);
    stream.on('token', token => { if (token.name === 'enddoc') stream.stop(); });
    stream.start();
  },
  render() { return ''; },
});
engine.registerTag('stylesheet', {
  parse(_token, tokens) {
    this.content = '';
    const stream = this.liquid.parser.parseStream(tokens);
    stream.on('token', token => {
      if (token.name === 'endstylesheet') stream.stop();
      else this.content += token.getText();
    });
    stream.start();
  },
  render() { return `<style>${this.content}</style>`; },
});
engine.registerFilter('asset_url', name => `/assets/${name}`);
engine.registerFilter('stylesheet_tag', url => `<link rel="stylesheet" href="${url}">`);
engine.registerFilter('inline_asset_content', name => {
  if (!/^[a-z0-9-]+\.svg$/.test(name)) throw new Error('Invalid icon');
  return readFileSync(resolve(themeRoot, 'assets', name), 'utf8');
});
engine.registerFilter('t', (key, ...options) => {
  let value = key.split('.').reduce((current, part) => current?.[part], locale);
  if (value && typeof value === 'object') value = Object.fromEntries(options).count === 1 ? value.one : value.other;
  if (typeof value !== 'string') return key;
  for (const [name, replacement] of options) value = value.replaceAll(`{{ ${name} }}`, String(replacement));
  return value;
});
engine.registerFilter('item_count_for_variant', () => 1);
engine.registerFilter('json', JSON.stringify);
engine.registerFilter('image_url', image => image.src);
const escapeAttribute = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
engine.registerFilter('image_tag', (url, ...attributes) => {
  const options = Object.fromEntries(attributes);
  const id = options.id ? ` id="${escapeAttribute(options.id)}"` : '';
  return `<img${id} src="${escapeAttribute(url)}" alt="${escapeAttribute(options.alt ?? '')}" class="${escapeAttribute(options.class ?? '')}" loading="${options.loading ?? 'lazy'}">`;
});
engine.registerFilter('money', amount => `$${(amount / 100).toFixed(2)}`);
engine.registerFilter('money_without_currency', amount => (amount / 100).toFixed(2));
engine.registerFilter('money_with_currency', amount => `$${(amount / 100).toFixed(2)} USD`);
engine.registerFilter('standard_event_data', () => '{}');
engine.registerFilter('money_without_trailing_zeros', amount => `$${(amount / 100).toFixed(2).replace(/\.00$/, '')}`);
engine.registerFilter('time_tag', value => {
  const label = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
  return `<time datetime="${escapeAttribute(value)}">${escapeAttribute(label)}</time>`;
});
engine.registerFilter('handle', value => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
engine.registerFilter('pluralize', (count, singular, plural) => count === 1 ? singular : plural);
engine.registerFilter('placeholder_svg_tag', () => '');
for (const name of ['schema', 'form']) {
  engine.registerTag(name, {
    parse(_token, tokens) {
      const stream = this.liquid.parser.parseStream(tokens);
      stream.on('token', token => { if (token.name === `end${name}`) stream.stop(); });
      stream.start();
    },
    render() { return ''; },
  });
}

function menuLink(item) {
  return {
    title: item.title,
    handle: item.title.toLowerCase().replaceAll('&', '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    url: '#menu', links: (item.items || []).map(menuLink),
  };
}

export async function renderLibrary() {
  const configuration = JSON.parse(readFileSync(resolve(themeRoot, 'config/settings_data.json'), 'utf8'));
  const schema = JSON.parse(readFileSync(resolve(themeRoot, 'config/settings_schema.json'), 'utf8'));
  const defaults = Object.fromEntries(schema.flatMap(group => (group.settings || []).filter(setting => setting.id && setting.default !== undefined).map(setting => [setting.id, setting.default])));
  const current = typeof configuration.current === 'string' ? configuration.presets[configuration.current] : configuration.current;
  const settings = { ...defaults, ...current, popular_categories_menu: popularCategoriesMenu, social_instagram_link: '#utilities', social_facebook_link: '#utilities', predictive_search_enabled: true, predictive_search_show_price: true, size_chart_index_page: { url: '#disclosures' }, type_body_font: { family: 'Inter', fallback_families: 'sans-serif', style: 'normal', weight: 400 }, type_header_font: { family: 'Archivo', fallback_families: 'sans-serif', style: 'normal', weight: 400 } };
  const section = { id: 'component-lab', settings: { menu: { links: navigation.menus[0].items.map(menuLink) }, menu_color_scheme: 'scheme-1', image_zoom: 'modal' } };
  const values = ['S', 'M', 'L', 'XL'].map((label, index) => {
    const value = new String(label);
    Object.assign(value, { id: index + 1, available: index !== 3, selected: index === 1, product_url: '#selection' });
    return value;
  });
  return engine.renderFileSync('page', {
    section, settings, products, articles, examples: sections, search_page: { title: 'Size guides', url: '#cards', content: 'Measure before selecting your equipment.' }, option: { name: 'Size', position: 1, values },
    variant: { id: 'lab-quantity', title: 'Practice glove', quantity_rule: { min: 1, max: 5, increment: 1 } },
    cart: { currency: { symbol: '$' } }, localization, announcements, commerce, gallery, policy, dropdown_section: { id: 'lab-dropdown' }, share_block: { id: 'lab-share', settings: { share_label: 'Share' } }, chart: chartFixtures()[0], catalog: catalogFixture(), routes: { root_url: '/', all_products_collection_url: '#cards', search_url: '/lab/search' },
  }, { globals: { section, settings, linklists, localization, cart: { currency: { symbol: '$' } }, routes: { root_url: '/', all_products_collection_url: '#cards', search_url: '/lab/search' }, pages: {}, collections: {}, blogs, shop: { privacy_policy: { url: '#privacy' } } } });
}

export function renderCatalog(parameters) {
  return engine.renderFileSync('catalog', { catalog: catalogFixture(parameters) }, { globals: { cart: { currency: { symbol: '$' } } } });
}

export function renderSearch(parameters) {
  const terms = parameters.get('q') || '';
  const matched = catalogProducts.filter(product => `${product.title} ${product.type}`.toLowerCase().includes(terms.toLowerCase()));
  const search = { performed: true, terms, resources: { queries: [], collections: [], products: matched, articles: [], pages: [] } };
  if (matched.length) {
    search.resources.queries = [{ text: terms, styled_text: escapeAttribute(terms), url: '#search-components' }];
    search.resources.collections = [{ title: matched[0].type, products_count: matched.length, url: '#browsing' }];
    search.resources.articles = [{ ...articles[0], url: '#cards' }];
    search.resources.pages = [{ title: 'Size guides', url: '#disclosures' }];
  }
  return `<div id="shopify-section-predictive-search">${engine.renderFileSync('predictive-search', { predictive_search: search }, { globals: { settings: { predictive_search_show_price: true, popular_categories_menu: popularCategoriesMenu }, linklists, routes: { search_url: '/lab/search' }, collections: {} } })}</div>`;
}

export function createLibraryServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      const pathname = url.pathname;
      if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
      let body;
      let type = 'text/html; charset=utf-8';
      if (pathname === '/') body = await renderLibrary();
      else if (pathname === '/lab/catalog') body = renderCatalog(url.searchParams);
      else if (pathname === '/lab/search') body = renderSearch(url.searchParams);
      else if (pathname === '/lab/country-flags.css') {
        type = 'text/css';
        body = engine.parseAndRenderSync(readFileSync(resolve(themeRoot, 'assets/country-flags.css.liquid'), 'utf8'));
      }
      else {
        const roots = { '/assets/': resolve(themeRoot, 'assets'), '/lab/': fixtures, '/fonts/': resolve(themeRoot, 'printables/fonts'), '/content/media/': resolve(themeRoot, 'content/media') };
        const prefix = Object.keys(roots).find(prefix => pathname.startsWith(prefix));
        if (!prefix) { response.writeHead(404); response.end('Not found'); return; }
        const root = await realpath(roots[prefix]);
        const candidate = resolve(root, decodeURIComponent(pathname.slice(prefix.length)));
        if (!candidate.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
        const path = await realpath(candidate);
        if (!path.startsWith(root + sep)) { response.writeHead(403); response.end(); return; }
        const types = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
        type = types[extname(path)];
        if (!type) { response.writeHead(404); response.end(); return; }
        body = await readFile(path);
      }
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Component rendering failed');
      if (error.code !== 'ENOENT') process.stderr.write(`${error.stack}\n`);
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.COMPONENT_LAB_PORT || 0);
  const server = createLibraryServer();
  server.listen(port, '127.0.0.1', () => process.stdout.write(`Component lab: http://127.0.0.1:${server.address().port}/\n`));
}