import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [destinationPath, sourcePath, catalogPath, journalPath] = process.argv.slice(2);
if (!destinationPath || !sourcePath || !catalogPath || !journalPath) throw new Error('Provide destination content, source content, source catalog, and journal captures.');
const read = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const destination = await read(destinationPath);
const source = await read(sourcePath);
const catalog = await read(catalogPath);
if (destination.errors || source.errors || catalog.shop.myshopifyDomain !== '8f3f5f-3.myshopify.com') throw new Error('Invalid content capture.');
const handles = ['contact', 'faq', 'shipping-policy', 'refund-policy', 'privacy-policy', 'terms-of-service'];
const pages = handles.map((handle) => {
  const page = destination.pages.nodes.find((item) => item.handle === handle);
  if (!page) throw new Error(`Missing approved page: ${handle}`);
  return { handle, title: page.title, body: page.body, templateSuffix: page.templateSuffix, isPublished: page.isPublished };
});
pages.push({ handle: 'about-us', title: 'About us', body: await readFile(new URL('./about.html', import.meta.url), 'utf8'), templateSuffix: '', isPublished: true });
await writeFile(new URL('./pages-source.json', import.meta.url), `${JSON.stringify(pages, null, 2)}\n`);
const collections = source.collections.nodes.map(({ handle, title, descriptionHtml, sortOrder, image }) => ({
  handle, title, descriptionHtml, sortOrder, image,
  productHandles: catalog.products.filter((product) => product.collections.nodes.some((collection) => collection.handle === handle)).map((product) => product.handle),
}));
const field = (product, key) => product.metafields.nodes.find((item) => item.namespace === 'custom' && item.key === key)?.value;
const weapons = (product) => JSON.parse(field(product, 'weapon') ?? '[]');
const addCollection = (handle, title, predicate) => collections.push({ handle, title, descriptionHtml: '', sortOrder: 'ALPHA_ASC', image: null, productHandles: catalog.products.filter(predicate).map((product) => product.handle) });
addCollection('jackets', 'Jackets', (product) => product.productType === 'Jackets');
addCollection('chest-protectors', 'Chest Protectors', (product) => product.productType === 'Chest Protectors');
addCollection('lames', 'Lames', (product) => ['mens-lames', 'womens-lames'].some((handle) => product.collections.nodes.some((collection) => collection.handle === handle)));
addCollection('kids-lames', 'Kids Lames', (product) => product.collections.nodes.some((collection) => collection.handle === 'kids') && product.productType === 'Lames');
for (const weapon of ['Foil', 'Epee', 'Saber']) addCollection(`${weapon.toLowerCase()}-body-cords`, `${weapon} Body Cords`, (product) => product.productType === 'Body Cord' && weapons(product).includes(weapon) && !product.handle.includes('mask'));
addCollection('foil-epee-gloves', 'Foil & Epee Gloves', (product) => product.productType === 'Gloves' && weapons(product).some((weapon) => weapon === 'Foil' || weapon === 'Epee'));
addCollection('saber-gloves', 'Saber Gloves', (product) => product.productType === 'Gloves' && weapons(product).includes('Saber'));
await writeFile(new URL('./collections-source.json', import.meta.url), `${JSON.stringify({ collections: { nodes: collections, pageInfo: { hasNextPage: false } } }, null, 2)}\n`);
const journals = await read(journalPath);
if (journals.errors || journals.blogs.pageInfo.hasNextPage) throw new Error('Incomplete journal capture.');
const journal = journals.blogs.nodes.find((blog) => blog.handle === 'journal');
if (!journal || journal.articles.pageInfo.hasNextPage) throw new Error('Missing or incomplete approved journal.');
const articleHandles = ['how-to-choose-your-first-foil', 'caring-for-your-fie-mask', 'footwork-drills-for-faster-lunges'];
const articles = articleHandles.map((handle) => {
  const article = journal.articles.nodes.find((item) => item.handle === handle);
  if (!article) throw new Error(`Missing approved article: ${handle}`);
  const { title, body, summary, tags, isPublished, publishedAt, author, image } = article;
  return { handle, title, body, summary, tags, isPublished, publishDate: publishedAt, author, image };
});
const blog = { handle: journal.handle, title: journal.title, articles };
await writeFile(new URL('./journal-source.json', import.meta.url), `${JSON.stringify(blog, null, 2)}\n`);