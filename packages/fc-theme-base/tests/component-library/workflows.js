window.routes = { search_url: '/lab/search', predictive_search_url: '/lab/search' };
window.accessibilityStrings = { imageAvailable: 'Image [index] is available', shareSuccess: 'Link copied', playSlideshow: 'Play slideshow', pauseSlideshow: 'Pause slideshow' };
const navigation = document.querySelector('.lab-nav');
for (const [id, label] of [['mobile-navigation', 'Mobile menu'], ['media', 'Media'], ['sizing', 'Sizing'], ['reading', 'Reading'], ['utilities', 'Utilities']]) {
  const link = document.createElement('a');
  link.href = `#${id}`;
  link.textContent = label;
  navigation.insertBefore(link, navigation.lastElementChild);
}
const catalogRegion = document.querySelector('#catalog-region');
const catalogStatus = document.querySelector('#catalog-status');
let catalogParams = new URLSearchParams();
let catalogRequest;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function updateCatalog(parameters) {
  catalogRequest?.abort();
  const request = new AbortController();
  catalogRequest = request;
  catalogParams = new URLSearchParams(parameters);
  const focused = document.activeElement;
  const focusedId = focused.id;
  const focusedLabel = focused.textContent.trim();
  const focusWasInside = catalogRegion.contains(focused);
  const filtersOpen = catalogRegion.querySelector('details').open;
  catalogRegion.setAttribute('aria-busy', 'true');
  catalogStatus.textContent = 'Loading products';
  document.querySelector('#catalog-error').hidden = true;
  try {
    await delay(document.querySelector('#catalog-slow').checked ? 900 : 150);
    if (request.signal.aborted) return;
    if (document.querySelector('#catalog-fail').checked) throw new Error('Fixture load failure');
    const response = await fetch(`/lab/catalog?${catalogParams}`, { signal: request.signal });
    if (!response.ok) throw new Error('Unable to load catalog');
    const html = await response.text();
    if (request.signal.aborted) return;
    catalogRegion.innerHTML = html;
    catalogRegion.querySelector('details').open = matchMedia('(min-width: 750px)').matches || filtersOpen;
    catalogStatus.textContent = catalogRegion.querySelector('#ProductCount').textContent.trim();
    if (focusWasInside && (document.activeElement === focused || document.activeElement === document.body)) {
      const target = document.getElementById(focusedId) || [...catalogRegion.querySelectorAll('a, summary')].find(element => element.textContent.trim() === focusedLabel) || catalogRegion.querySelector('.ui-select__trigger');
      target?.focus({ preventScroll: true });
    }
  } catch (error) {
    if (request.signal.aborted) return;
    catalogRegion.querySelectorAll('input[data-filter-url]').forEach(input => { input.checked = input.defaultChecked; });
    document.querySelector('#catalog-error').hidden = false;
    catalogStatus.textContent = 'Products unchanged';
  } finally {
    if (catalogRequest === request) catalogRegion.removeAttribute('aria-busy');
  }
}

catalogRegion.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/lab/catalog')) return;
  event.preventDefault();
  updateCatalog(new URL(href, location.origin).searchParams);
});
catalogRegion.addEventListener('input', event => {
  if (event.target.name !== 'sort_by') return;
  catalogParams.set('sort_by', event.target.value);
  catalogParams.delete('page');
  updateCatalog(catalogParams);
});
catalogRegion.addEventListener('change', event => {
  if (event.target.matches('input[data-filter-url]')) {
    updateCatalog(new URL(event.target.dataset.filterUrl, location.origin).searchParams);
    return;
  }
  if (!['min', 'max'].includes(event.target.name)) return;
  for (const input of catalogRegion.querySelectorAll('price-range input')) {
    const normalized = input.value.replace(',', '.');
    if (!normalized.trim()) catalogParams.delete(input.name);
    else catalogParams.set(input.name, Math.max(0, Math.min(250, Number(normalized) || 0)));
  }
  catalogParams.delete('page');
  updateCatalog(catalogParams);
});
document.querySelector('#catalog-retry').addEventListener('click', () => updateCatalog(catalogParams));
const desktopFilters = matchMedia('(min-width: 750px)');
desktopFilters.addEventListener('change', () => { catalogRegion.querySelector('.lab-filter-disclosure').open = desktopFilters.matches; });
catalogRegion.querySelector('.lab-filter-disclosure').open = desktopFilters.matches;
document.querySelector('#navigation').addEventListener('click', async event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  if (url.pathname === '/lab/catalog') {
    const response = await fetch(url);
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const pagination = parsed.querySelector('.ui-pagination');
    if (pagination) {
      const previous = document.querySelector('#navigation .ui-pagination');
      previous.replaceWith(pagination);
      pagination.querySelector('[aria-current]')?.setAttribute('tabindex', '-1');
      pagination.querySelector('[aria-current]')?.focus();
    }
    document.querySelector('#navigation-status').textContent = `Page ${url.searchParams.get('page') || 1}`;
  } else {
    if (link.classList.contains('ui-pill')) {
      link.closest('[data-local-links]').querySelectorAll('.ui-pill').forEach(pill => {
        pill.classList.toggle('ui-pill--active', pill === link);
        if (pill === link) pill.setAttribute('aria-current', 'page');
        else pill.removeAttribute('aria-current');
      });
    }
    document.querySelector('#navigation-status').textContent = `${link.textContent.trim()} selected`;
  }
});

document.querySelectorAll('[data-localization-form]').forEach(form => {
  form.submit = () => {
    const controller = form.closest('localization-form');
    const input = controller.elements.input;
    const chosen = form.querySelector(`[data-value="${CSS.escape(input.value)}"]`);
    form.querySelectorAll('[data-value]').forEach(link => {
      if (link === chosen) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
      if (input.name === 'locale_code') link.firstElementChild.classList.toggle('visibility-hidden', link !== chosen);
    });
    const button = controller.elements.button;
    const spans = button.querySelectorAll(':scope > span');
    spans[1].textContent = chosen.lastElementChild.textContent.trim();
    if (input.name === 'country_code') spans[0].className = `currency-flag currency-flag--${input.value.toLowerCase()}`;
    controller.hidePanel();
    button.focus();
    document.querySelector('#localization-status').textContent = `${chosen.textContent.trim().replace(/\s+/g, ' ')} selected`;
  };
});

const search = document.querySelector('#search-components predictive-search');
search.updatePanelGeometry = () => {
  document.documentElement.style.setProperty('--predictive-search-top', '0px');
  document.documentElement.style.setProperty('--predictive-search-max', `${innerHeight}px`);
};
search.updatePanelGeometry();
window.addEventListener('resize', search.updatePanelGeometry);
let searchRequest;
let recentSearches = [];
search.getRecentSearches = () => recentSearches;
search.saveRecentSearch = term => { recentSearches = [term, ...recentSearches.filter(value => value !== term)].slice(0, 5); };
search.querySelector('[data-clear-recent-searches]')?.addEventListener('click', () => { recentSearches = []; search.renderRecentSearches(); });
search.getSearchResults = async term => {
  searchRequest?.abort();
  const request = new AbortController();
  searchRequest = request;
  search.setLiveRegionLoadingState();
  search.open();
  document.querySelector('#search-error').hidden = true;
  try {
    const mode = document.querySelector('#search-response').value;
    await delay(mode === 'slow' ? 1000 : 180);
    if (request.signal.aborted || search.getQuery() !== term || !search.isOpen) return;
    if (mode === 'error') throw new Error('Fixture search failure');
    const query = mode === 'empty' ? 'no-matching-fixture' : term;
    const response = await fetch(`/lab/search?q=${encodeURIComponent(query)}`, { signal: request.signal });
    if (!response.ok) throw new Error('Unable to search');
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    if (request.signal.aborted || search.getQuery() !== term || !search.isOpen) return;
    search.renderSearchResults(parsed.querySelector('#shopify-section-predictive-search').innerHTML);
  } catch (error) {
    if (request.signal.aborted) return;
    search.close();
    document.querySelector('#search-error').hidden = false;
  }
};
document.querySelector('#search-response').addEventListener('change', () => {
  if (search.getQuery()) { search.input.focus(); search.getSearchResults(search.getQuery()); }
});
document.querySelector('#search-retry').addEventListener('click', () => {
  search.input.focus();
  search.getSearchResults(search.getQuery());
});
search.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  search.saveRecentSearch(search.getQuery());
  document.querySelector('#search-fixture-status').textContent = `${link.textContent.trim().replace(/\s+/g, ' ')} selected`;
  search.close();
  search.input.focus();
  search.close();
});
search.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  document.querySelector('#search-fixture-status').textContent = `Search: ${search.getQuery()}`;
  search.close();
});

const contactForm = document.querySelector('#lab-contact-form');
contactForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (contactForm.getAttribute('aria-busy') === 'true') return;
  const email = contactForm.querySelector('[type="email"]');
  const error = document.querySelector('#lab-email-error');
  error.hidden = email.validity.valid;
  email.setAttribute('aria-invalid', String(!email.validity.valid));
  if (!email.validity.valid) { email.focus(); return; }
  const button = contactForm.querySelector('[type="submit"]');
  const status = document.querySelector('#lab-form-status');
  contactForm.setAttribute('aria-busy', 'true');
  button.disabled = true;
  status.textContent = 'Sending';
  await delay(600);
  status.textContent = document.querySelector('#form-fail').checked ? 'Unable to send. Try again.' : 'Local example complete. No message sent.';
  contactForm.removeAttribute('aria-busy');
  button.disabled = false;
});
document.querySelector('#product-details').addEventListener('change', () => {
  const color = document.querySelector('[name="lab-color"]:checked').value;
  document.querySelector('#product-details-status').textContent = `${color}, size ${document.querySelector('#LabVariantDropdown').value}`;
});
document.querySelector('#cart-components [data-save-note]').addEventListener('click', async event => {
  const button = event.currentTarget;
  const status = document.querySelector('#cart-components [data-note-status]');
  button.disabled = true;
  status.textContent = 'Saving';
  await delay(500);
  status.textContent = document.querySelector('#cart-detail-fail').checked ? 'Unable to save. Try again.' : 'Note saved in this example';
  button.disabled = false;
});
async function applyDiscount() {
  const button = document.querySelector('#cart-components [data-apply-discount]');
  if (button.disabled) return;
  const input = document.querySelector('#CartDiscount-lab');
  const status = document.querySelector('#cart-components [data-discount-status]');
  if (!input.value.trim()) { input.focus(); return; }
  button.disabled = true;
  status.textContent = 'Checking code';
  await delay(500);
  status.textContent = 'This example does not apply discounts.';
  input.setAttribute('aria-invalid', 'true');
  button.disabled = false;
  input.focus();
}
document.querySelector('#cart-components [data-apply-discount]').addEventListener('click', applyDiscount);
document.querySelector('#CartDiscount-lab').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); applyDiscount(); }
});
document.querySelectorAll('#announcements a').forEach(link => link.addEventListener('click', event => event.preventDefault()));
document.querySelector('#mobile-navigation').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  document.querySelector('#mobile-menu-status').textContent = `${link.textContent.trim()} selected`;
  const drawer = document.querySelector('#mobile-navigation header-drawer');
  drawer.closeMenuDrawer(event, drawer.querySelector('summary'));
});
document.querySelector('#utilities').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  document.querySelector('#utility-status').textContent = `${link.textContent.trim()} selected`;
});