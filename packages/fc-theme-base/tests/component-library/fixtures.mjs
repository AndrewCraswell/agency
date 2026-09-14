const image = (name, alt) => ({ src: `/assets/${name}`, alt, width: 800, height: 800, aspect_ratio: 1 });
const product = (id, title, type, filename, price) => ({ id, title, type, url: '#cards', price, available: true, featured_image: image(filename, title), variants: [{ id: id * 10 }, { id: id * 10 + 1 }], selected_or_first_available_variant: { id: id * 10, available: true } });
export const products = [
  product(801, 'Competition jacket', 'Jackets', 'collection-aero-competition-jacket.jpg', 6995),
  product(802, 'Fencing glove', 'Gloves', 'collection-grip-fencing-glove.jpg', 2495),
  product(803, 'Fencing socks', 'Footwear', 'collection-fencing-socks-2-pack.jpg', 1895),
];
export const articles = [
  { title: 'Choosing your first fencing kit', url: '#cards', published_at: '2026-08-10', excerpt: 'Compare the equipment you need for club training.', image: image('mega-sizing-guide.jpg', 'Fencing clothing') },
  { title: 'Taking care of your equipment', url: '#cards', published_at: '2026-08-17', excerpt: 'Prepare your bag and keep equipment ready for practice.', image: image('mega-bags-carry.jpg', 'Fencing bag') },
  { title: 'Finding the right fit', url: '#cards', published_at: '2026-08-24', excerpt: 'Measure before choosing your next uniform.', image: image('collection-knicker-pants-350n.jpg', 'Fencing pants') },
];
const block = (id, settings) => ({ id, settings });
const section = (id, settings, blocks = []) => ({ id: `lab-${id}`, settings, blocks });
export const sections = {
  products: section('products', { eyebrow: 'FIXTURE CATALOG', heading: 'Featured products', link_label: 'View all', show_add: true, add_label: 'Choose options' }, products.map(product => block(`product-${product.id}`, { product }))),
  categories: section('categories', { heading: 'Shop by category', show_count: true, link_label: 'Shop' }, products.map(product => block(`category-${product.id}`, { collection: { title: product.type, url: '#cards', featured_image: product.featured_image, all_products_count: 12 } }))),
  picks: section('picks', { heading: 'Featured picks' }, [
    block('kit', { title: 'Training equipment', description: 'Prepare for your next club session.', image: image('mega-sizing-guide.jpg', 'Fencing clothing'), link_1_label: 'Clothing', link_1_url: '#cards', link_2_label: 'Footwear', link_2_url: '#cards' }),
    block('gloves', { title: 'Gloves', description: 'Compare fit and coverage.', image: products[1].featured_image, link_1_label: 'Browse gloves', link_1_url: '#cards' }),
    block('bags', { title: 'Equipment bags', description: 'Carry your training essentials.', image: image('mega-bags-wheel.jpg', 'Wheeled fencing bag'), link_1_label: 'Wheel bags', link_1_url: '#cards', link_2_label: 'Carry bags', link_2_url: '#cards' }),
  ]),
  story: section('story', { heading: 'Find equipment that fits your training', eyebrow: 'FIXTURE CONTENT', body: 'Choose equipment for your weapon, training level, and fit.', image: image('mega-sizing-guide.jpg', 'Fencing clothing') }, [
    block('help', { icon: 'badge-check', label: 'Equipment advice', detail: 'Product selection and sizing', link_label: 'Contact us', link_url: '#cards' }),
    block('shipping', { icon: 'truck', label: 'Shipping', detail: 'Review delivery information', link_label: 'Shipping policy', link_url: '#cards' }),
  ]),
  testimonials: section('testimonials', { heading: 'Fixture testimonials', eyebrow: 'SAMPLE COPY' }, [
    block('quote-1', { quote: 'This is sample text for checking the short testimonial layout.', name: 'Short-copy fixture', role: 'Not a customer endorsement', rating: 5 }),
    block('quote-2', { quote: 'This longer fixture exercises wrapping, spacing, navigation, and the way the carousel behaves when adjacent testimonials have different lengths.', name: 'Long-copy fixture', role: 'Not a customer endorsement', rating: 4 }),
    block('quote-3', { quote: 'A third example for the next and previous controls.', name: 'Third fixture', role: 'Not a customer endorsement', rating: 5 }),
  ]),
  journal: section('journal', { heading: 'From the Journal', blog: 'lab-journal', link_label: 'View all posts', read_label: 'Read more' }),
};
export const blogs = { 'lab-journal': { url: '#cards', articles_count: articles.length, articles } };

export const countries = [
  { iso_code: 'US', name: 'United States', currency: { iso_code: 'USD', symbol: '$' } },
  { iso_code: 'CA', name: 'Canada', currency: { iso_code: 'CAD', symbol: '$' } },
  { iso_code: 'DE', name: 'Germany', currency: { iso_code: 'EUR', symbol: '\u20ac' } },
  { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', symbol: '\u00a3' } },
];
export const languages = [
  { iso_code: 'en', endonym_name: 'English' },
  { iso_code: 'de', endonym_name: 'Deutsch' },
  { iso_code: 'fr', endonym_name: 'Fran\u00e7ais' },
];
export const localization = { country: countries[0], language: languages[0], available_countries: countries, available_languages: languages };
export const announcements = [
  section('announcement-single', { color_scheme: 'scheme-1', show_line_separator: true }, [
    block('information', { text: 'Equipment advice', message: 'Find the right size before ordering.', tone: 'announcement', link: '#selection', link_label: 'Size guides' }),
  ]),
  section('announcement-carousel', { color_scheme: 'scheme-1', auto_rotate: false, change_slides_speed: 5 }, [
    block('sizing', { text: 'Size guides', message: 'Compare your measurements.', tone: 'announcement', link: '#selection', link_label: 'View guides' }),
    block('event', { text: 'Event banner example', message: 'Event details appear here.', tone: 'event', link: '#cards', link_label: 'View details' }),
    block('sale', { text: 'Sale banner example', message: 'Offer details appear here.', tone: 'sale', link: '#cards', link_label: 'View details' }),
    block('vacation', { text: 'Vacation banner example', message: 'Service updates appear here.', tone: 'vacation', link: '#forms', link_label: 'Contact us' }),
  ]),
];
export const catalogProducts = [
  ...products,
  product(804, 'Training pants', 'Pants', 'collection-knicker-pants-350n.jpg', 5495),
  product(805, 'Competition fencing jacket', 'Jackets', 'collection-fie-800n-jacket.jpg', 14995),
  { ...product(806, 'Stretch fencing pants', 'Pants', 'collection-stretch-fencing-pants.jpg', 7995), available: false },
].map((item, index) => ({ ...item, color: index === 1 ? 'Black' : 'White', size: ['S', 'M', 'L'][index % 3], url: '#product-details' }));

export const commerce = {
  regular: { ...products[0], price_varies: false },
  sale: { ...products[1], compare_at_price: 3495, price_varies: false },
  soldOut: { ...products[2], available: false, price_varies: false },
  bundle: { key: 'lab:bundle', item_components: [{ quantity: 2, image: products[2].featured_image, product: { title: 'Fencing socks', has_only_default_variant: false }, variant: { title: 'M' } }] },
  swatches: [{ label: 'White', color: { rgb: '255, 255, 255' } }, { label: 'Black', color: { rgb: '16, 16, 18' } }, { label: 'Unavailable', color: { rgb: '180, 180, 185' } }],
};

const galleryImages = [products[0].featured_image, image('collection-fie-800n-jacket.jpg', 'Competition fencing jacket')];
const galleryMedia = galleryImages.map((preview, index) => ({ id: 910 + index, media_type: 'image', aspect_ratio: 1, preview_image: preview, src: preview.src, alt: preview.alt }));
export const gallery = {
  section: section('media', { gallery_layout: 'thumbnail_slider', mobile_thumbnails: 'show', media_size: 'medium', image_zoom: 'modal', media_fit: 'contain', color_scheme: 'scheme-1' }),
  product: { ...products[0], media: galleryMedia, selected_or_first_available_variant: { featured_media: galleryMedia[0] } },
};
export const policy = {
  section: section('policy', { home_label: 'Home', breadcrumb_label: 'Breadcrumb', contents_label: 'On this page', top_label: 'Back to top' }),
  page: { title: 'Policy layout example', content: '<h2>Overview</h2><p>Sample content for checking a readable policy layout. This is not a store policy.</p><h2>Delivery information</h2><p>Delivery terms belong to the store policy.</p><h2>Data categories</h2><table><thead><tr><th scope="col">Category</th><th scope="col">Purpose</th></tr></thead><tbody><tr><td>Order information</td><td>Example table content for layout review</td></tr><tr><td>Contact information</td><td>Example of a longer description that wraps on small screens</td></tr></tbody></table>' },
};

export function catalogFixture(parameters = new URLSearchParams()) {
  const params = new URLSearchParams(parameters);
  const url = updated => `/lab/catalog?${updated}`;
  const toggle = (key, value) => {
    const updated = new URLSearchParams(params);
    const values = updated.getAll(key);
    updated.delete(key);
    for (const entry of values) if (entry !== value) updated.append(key, entry);
    if (!values.includes(value)) updated.append(key, value);
    updated.delete('page');
    return url(updated);
  };
  const groups = [
    { label: 'Category', key: 'type', values: ['Jackets', 'Gloves', 'Footwear', 'Pants', 'Masks'] },
    { label: 'Availability', key: 'stock', values: ['In stock', 'Out of stock'] },
    { label: 'Color', key: 'color', param_name: 'filter.v.option.color', values: ['White', 'Black'] },
    { label: 'Size', key: 'size', param_name: 'filter.v.option.size', values: ['S', 'M', 'L', 'XL'] },
  ];
  const matches = (item, ignoredKey) => groups.every(group => {
    const selected = params.getAll(group.key);
    if (group.key === ignoredKey || !selected.length) return true;
    let value = item[group.key];
    if (group.key === 'stock') value = item.available ? 'In stock' : 'Out of stock';
    return selected.includes(value);
  });
  const filters = groups.map(group => ({
    label: group.label, type: 'list', presentation: group.presentation,
    values: group.values.map(label => ({
      label, value: label, param_name: group.param_name || group.key, active: params.getAll(group.key).includes(label),
      count: catalogProducts.filter(item => {
        let value = item[group.key];
        if (group.key === 'stock') value = item.available ? 'In stock' : 'Out of stock';
        return value === label && matches(item, group.key);
      }).length,
      url_to_add: toggle(group.key, label), url_to_remove: toggle(group.key, label),
    })),
  }));
  const minimum = Math.max(0, Math.min(250, Number(params.get('min')) || 0));
  let maximum = 250;
  if (params.get('max')) maximum = Math.max(minimum, Math.min(250, Number(params.get('max')) || 0));
  filters.push({ label: 'Price', type: 'price_range', range_max: 25000, min_value: { param_name: 'min', value: minimum * 100 || null }, max_value: { param_name: 'max', value: params.get('max') ? maximum * 100 : null } });
  const sort_options = [
    { value: 'manual', name: 'Featured' },
    { value: 'price-ascending', name: 'Price, low to high' },
    { value: 'price-descending', name: 'Price, high to low' },
    { value: 'title-ascending', name: 'Name, A to Z' },
  ];
  const sort_by = sort_options.find(option => option.value === params.get('sort_by'))?.value || 'manual';
  const matched = catalogProducts.filter(item => matches(item) && item.price >= minimum * 100 && item.price <= maximum * 100);
  if (sort_by === 'price-ascending') matched.sort((left, right) => left.price - right.price);
  if (sort_by === 'price-descending') matched.sort((left, right) => right.price - left.price);
  if (sort_by === 'title-ascending') matched.sort((left, right) => left.title.localeCompare(right.title));
  const pageCount = Math.max(1, Math.ceil(matched.length / 3));
  const currentPage = Math.max(1, Math.min(pageCount, Math.floor(Number(params.get('page')) || 1)));
  const pageUrl = page => { const updated = new URLSearchParams(params); updated.set('page', page); return url(updated); };
  return {
    products: matched.slice((currentPage - 1) * 3, currentPage * 3), products_count: matched.length, all_products_count: catalogProducts.length,
    filters, sort_options, sort_by, default_sort_by: 'manual',
    paginate: { pages: pageCount, current_page: currentPage, previous: currentPage > 1 ? { url: pageUrl(currentPage - 1) } : null, next: currentPage < pageCount ? { url: pageUrl(currentPage + 1) } : null, parts: Array.from({ length: pageCount }, (_, index) => ({ title: index + 1, is_link: index + 1 !== currentPage, url: pageUrl(index + 1) })) },
  };
}