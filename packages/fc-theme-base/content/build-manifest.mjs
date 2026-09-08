import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export function buildSizingManifest(source) {
  const resources = [];
  const reference = (key, field = 'id') => ({ $ref: key, field });
  const field = (key, name, type = 'single_line_text_field', required = false) => ({ key, name, type, required });
  const referenceField = (key, name, target, isList = false) => ({
    ...field(key, name, isList ? 'list.metaobject_reference' : 'metaobject_reference', true),
    validations: [{ name: 'metaobject_definition_id', value: reference(target) }],
  });
  const definition = (key, type, name, fields, capabilities) => resources.push({
    key, kind: 'metaobject-definition', data: { type, name, displayNameKey: 'title', access: { storefront: 'PUBLIC_READ' },
      fieldDefinitions: fields, ...(capabilities ? { capabilities } : {}) },
  });
  const measurementFields = new Map();
  for (const chart of source.charts) for (const [key, label] of [...chart.measurements, ...(chart.imperialMeasurements ?? [])]) measurementFields.set(key, label);
  definition('definition.guide', 'measurement_guide', 'Measuring guide', [
    field('title', 'Title', 'single_line_text_field', true), field('image', 'Illustration', 'file_reference', true),
    field('alt_text', 'Alternative text', 'single_line_text_field', true), field('instructions', 'Instructions', 'multi_line_text_field', true),
  ]);
  definition('definition.size', 'size_chart_entry', 'Size entry', [
    field('title', 'Entry name', 'single_line_text_field', true), field('size_label', 'Size', 'single_line_text_field', true),
    ...[...measurementFields].map(([key, label]) => field(key, label)),
  ]);
  definition('definition.chart', 'size_chart', 'Size chart', [
    field('title', 'Title', 'single_line_text_field', true), field('category', 'Category', 'single_line_text_field', true),
    field('navigation_label', 'Navigation label'),
    field('measurement_keys', 'Measurement field keys', 'list.single_line_text_field', true),
    field('measurement_labels', 'Measurement labels', 'list.single_line_text_field', true),
    field('imperial_keys', 'Imperial field keys', 'list.single_line_text_field'),
    field('imperial_labels', 'Imperial labels', 'list.single_line_text_field'),
    referenceField('entries', 'Sizes in display order', 'definition.size', true),
    referenceField('guide', 'Measuring guide', 'definition.guide'),
    field('fit_heading', 'Fit heading'), field('fit_advice', 'Fit advice', 'multi_line_text_field'),
    field('source_url', 'Source URL', 'url'), field('source_date', 'Source date', 'date'),
  ], { publishable: { enabled: true }, translatable: { enabled: true }, renderable: { enabled: true, data: { metaTitleKey: 'title' } },
    onlineStore: { enabled: true, data: { urlHandle: 'size-charts' } } });
  definition('definition.group', 'size_chart_group', 'Size chart group', [
    field('title', 'Heading', 'single_line_text_field', true),
    { ...field('selection', 'Chart selection', 'single_line_text_field', true), validations: [{ name: 'choices', value: JSON.stringify(['category', 'manual']) }] },
    field('category', 'Category to match'),
    { ...referenceField('charts', 'Charts in display order', 'definition.chart', true), required: false },
  ]);
  resources.push({ key: 'definition.product-chart', kind: 'product-metafield-definition', data: {
    namespace: 'custom', key: 'size_chart', name: 'Size chart', type: 'metaobject_reference', ownerType: 'PRODUCT',
    validations: [{ name: 'metaobject_definition_id', value: reference('definition.chart') }],
  } });
  for (const guide of source.guides) {
    resources.push({ key: `image.${guide.key}`, kind: 'file', data: { filename: `fc-measuring-${guide.key}.png`, path: guide.image, alt: guide.alt } });
    resources.push({ key: `guide.${guide.key}`, kind: 'metaobject', dependsOn: ['definition.guide'], data: {
      type: 'measurement_guide', handle: guide.key, fields: {
        title: guide.title, image: reference(`image.${guide.key}`), alt_text: guide.alt, instructions: guide.instructions,
      },
    } });
  }
  for (const chart of source.charts) {
    const entries = [];
    const sizes = new Set();
    for (const row of chart.rows) {
      if (row.length !== chart.measurements.length + 1 || sizes.has(row[0])) throw new Error(`Invalid size row in ${chart.handle}.`);
      sizes.add(row[0]);
      const label = row[0];
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
      const key = `size.${chart.handle}.${slug}`;
      const fields = { title: `${chart.title} - ${label}`, size_label: label };
      for (const [index, [measurement]] of chart.measurements.entries()) fields[measurement] = row[index + 1];
      const imperial = chart.imperialRows?.find((entry) => entry[0] === label);
      if (chart.imperialRows && (!imperial || imperial.length !== chart.imperialMeasurements.length + 1)) throw new Error(`Invalid imperial row in ${chart.handle}.`);
      if (imperial) for (const [index, [measurement]] of chart.imperialMeasurements.entries()) fields[measurement] = imperial[index + 1];
      resources.push({ key, kind: 'metaobject', dependsOn: ['definition.size'], data: { type: 'size_chart_entry', handle: `${chart.handle}-${slug}`, fields } });
      entries.push(reference(key));
    }
    const advice = source.advice[chart.advice];
    if (!advice || !source.guides.some((guide) => guide.key === chart.guide)) throw new Error(`Unknown guide or fit advice for ${chart.handle}.`);
    resources.push({ key: `chart.${chart.handle}`, kind: 'metaobject', dependsOn: ['definition.chart'], data: {
      type: 'size_chart', handle: chart.handle, status: 'DRAFT', fields: {
        title: chart.title, category: chart.group,
        ...(chart.navigationLabel ? { navigation_label: chart.navigationLabel } : {}),
        measurement_keys: chart.measurements.map(([key]) => key), measurement_labels: chart.measurements.map(([, label]) => label),
        ...(chart.imperialMeasurements ? { imperial_keys: chart.imperialMeasurements.map(([key]) => key), imperial_labels: chart.imperialMeasurements.map(([, label]) => label) } : {}),
        entries, guide: reference(`guide.${chart.guide}`), fit_heading: advice.heading, fit_advice: advice.text,
        source_url: source.sourceUrl, source_date: source.capturedAt,
      },
    } });
  }
  for (const group of source.groups) {
    resources.push({ key: `group.${group.handle}`, kind: 'metaobject', dependsOn: ['definition.group'], data: {
      type: 'size_chart_group', handle: group.handle, fields: {
        title: group.title, selection: 'category', category: group.category,
      },
    } });
  }
  resources.push({ key: 'page.size-charts', kind: 'page', data: { handle: 'size-charts', title: 'Size charts', body: '', templateSuffix: 'size-charts', isPublished: false } });
  resources.push({ key: 'menu.size-charts', kind: 'menu', data: {
    handle: 'size-charts', title: 'Size charts', items: source.groups.map((group) => ({
      title: group.title, type: 'PAGE', resourceId: reference('page.size-charts'),
      items: source.charts.filter((chart) => chart.group === group.category).map((chart) => ({ title: chart.navigationLabel ?? chart.title, type: 'HTTP', url: reference(`chart.${chart.handle}`, 'url') })),
    })),
  } });
  return { name: 'fencing-club-sizing', resources };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = JSON.parse(await readFile(new URL('./sizing-source.json', import.meta.url), 'utf8'));
  await writeFile(new URL('./manifest.json', import.meta.url), `${JSON.stringify(buildSizingManifest(source), null, 2)}\n`);
}