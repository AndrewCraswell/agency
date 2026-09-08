import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Liquid } from 'liquidjs';

export const themeRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const source = JSON.parse(await readFile(resolve(themeRoot, 'content/sizing-source.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(themeRoot, 'content/manifest.json'), 'utf8'));
const escape = (text) => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function chartFixtures() {
  const records = new Map();
  const resources = manifest.resources.filter((resource) => resource.kind === 'metaobject');
  for (const resource of resources) {
    records.set(resource.key, { system: {
      type: resource.data.type, handle: resource.data.handle,
      url: resource.data.type === 'size_chart' ? `/pages/size-charts/${resource.data.handle}` : undefined,
    } });
  }
  function resolve(value) {
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object' && value.$ref) {
      if (value.$ref.startsWith('image.')) return { src: `/content/media/${value.$ref.slice(6)}.png` };
      return records.get(value.$ref);
    }
    return value;
  }
  for (const resource of resources) {
    const record = records.get(resource.key);
    for (const [key, value] of Object.entries(resource.data.fields)) record[key] = { value: resolve(value) };
  }
  return source.charts.map((chart) => records.get(`chart.${chart.handle}`));
}

export function createSizingLiquid({ cache = false, fs } = {}) {
  const engine = new Liquid({ root: [`${themeRoot}/snippets`, `${themeRoot}/sections`], extname: '.liquid', cache, ...(fs ? { fs } : {}) });
  for (const name of ['doc', 'schema', 'stylesheet', 'javascript']) {
    engine.registerTag(name, {
      parse(_token, tokens) {
        this.content = '';
        const stream = this.liquid.parser.parseStream(tokens);
        stream.on('token', (token) => {
          if (token.name === `end${name}`) stream.stop();
          else this.content += token.getText();
        });
        stream.start();
      },
      render() { return name === 'stylesheet' ? `<style>${this.content}</style>` : ''; },
    });
  }
  engine.registerFilter('asset_url', (name) => `/assets/${name}`);
  engine.registerFilter('stylesheet_tag', (url) => `<link rel="stylesheet" href="${escape(url)}">`);
  engine.registerFilter('image_url', (image) => image.src);
  engine.registerFilter('image_tag', (url, ...attributes) => {
    const options = Object.fromEntries(attributes);
    return `<img src="${escape(url)}" alt="${escape(options.alt ?? '')}" class="${escape(options.class ?? '')}" loading="${options.loading ?? 'lazy'}">`;
  });
  return {
    async renderTemplate(name, context) {
      const template = JSON.parse(await readFile(resolve(themeRoot, 'templates', `${name}.json`), 'utf8'));
      const parts = [];
      for (const id of template.order) {
        const section = template.sections[id];
        if (section.disabled) continue;
        parts.push(await this.renderFile(section.type, {
          ...context,
          request: { ...context.request, page_type: name.startsWith('metaobject/') ? 'metaobject' : 'page' },
          section: { id, settings: section.settings },
        }));
      }
      return parts.join('\n');
    },
    renderFile(name, context) {
      const globals = Object.fromEntries(['settings', 'routes', 'pages', 'metaobjects', 'metaobject', 'page', 'product', 'request', 'section']
        .map((key) => [key, context[key]]));
      return engine.renderFile(name, context, { globals });
    },
  };
}

export function sizingContext(charts = chartFixtures()) {
  return {
    settings: { size_chart_catalog: charts, size_chart_default_unit: 'cm' },
    metaobjects: { size_chart: { values: charts } },
    pages: { 'size-charts': { title: 'Size charts', url: '/pages/size-charts' } },
    routes: { root_url: '/' }, request: { design_mode: false },
    page: { title: 'Size charts' }, section: { id: 'test-section' },
    instance_id: 'test-chart', chart: charts[0], metaobject: charts[0],
  };
}