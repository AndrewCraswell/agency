import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chartFixtures, createSizingLiquid, sizingContext, themeRoot } from './helpers/sizing-liquid.mjs';

const engine = createSizingLiquid();
const mime = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.ttf': 'font/ttf' };
const shell = (content, title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Sizing fixture preview</title>
  <link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/component-ui.css">
  <style>@font-face{font-family:Archivo;src:url('/printables/fonts/Archivo-Semibold.ttf')}@font-face{font-family:Inter;src:url('/printables/fonts/Inter-Regular.ttf')}
  :root{--font-body-family:Inter,sans-serif;--font-heading-family:Archivo,sans-serif;--font-body-weight:400;--font-body-scale:1;--font-heading-scale:1;--color-foreground:16,16,18;--color-background:255,255,255}
  html{font-size:62.5%;box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}body{margin:0;background:#fff;color:#101012;font-family:Inter,sans-serif;font-size:1.6rem}
  .fixture-header{display:flex;align-items:center;gap:24px;min-height:96px;padding:16px 32px;border-bottom:1px solid #e3e3e0}.fixture-header img{width:48px;height:48px;object-fit:contain}.fixture-header a{color:inherit;text-decoration:none}.fixture-header strong{font-family:Archivo,sans-serif}.fixture-product{padding:32px;max-width:800px;margin:auto}.fixture-product h1{font-family:Archivo,sans-serif;font-size:32px}.fixture-product input[name=quantity]{font:inherit;width:80px;padding:8px}.fixture-product>img{width:160px;max-width:100%}
  </style></head><body><header class="fixture-header"><a href="/pages/size-charts"><img src="/assets/fencing-club-logo.png" alt="Fencing Club"></a><a href="/pages/size-charts"><strong>Size charts</strong></a></header><main>${content}</main></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/content/media/') || url.pathname.startsWith('/printables/fonts/')) {
      const path = resolve(themeRoot, `.${decodeURIComponent(url.pathname)}`);
      if (!path.startsWith(`${resolve(themeRoot)}${sep}`)) throw new Error('Invalid fixture asset path');
      response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
      response.end(await readFile(path));
      return;
    }
    const charts = chartFixtures();
    const context = sizingContext(charts);
    let title = 'Size charts';
    let content;
    if (url.pathname === '/pages/size-charts' || url.pathname === '/') {
      content = await engine.renderTemplate('page.size-charts', context);
    } else if (url.pathname.startsWith('/pages/size-charts/')) {
      const chart = charts.find((entry) => entry.system.url === url.pathname);
      if (!chart) { response.writeHead(404); response.end('Chart not found'); return; }
      title = chart.title.value;
      content = await engine.renderTemplate('metaobject/size_chart', { ...context, chart, metaobject: chart });
    } else if (url.pathname === '/products/sizing-fixture') {
      const chart = charts.find((entry) => entry.system.handle === url.searchParams.get('chart')) ?? charts[0];
      const product = { title: 'Sizing acceptance product', metafields: { custom: { size_chart: { value: chart } } } };
      const flyout = await engine.renderFile('size-chart-flyout', { ...context, product, section_id: 'fixture-product', block: { id: 'chart', settings: { label: 'Size chart' } } });
      content = `<section class="fixture-product"><h1>Sizing acceptance product</h1><img src="/content/media/body.png" alt="Fencing clothing"><p><label>Quantity <input name="quantity" type="number" value="2" min="1"></label></p>${flyout}</section>`;
    } else { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(shell(content, title));
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end(error.message);
  }
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`Sizing fixture preview: http://127.0.0.1:${server.address().port}/pages/size-charts\n`);
});