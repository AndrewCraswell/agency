const breadcrumbParameterNames = ['breadcrumb_parent', 'breadcrumb_parent_url', 'breadcrumb_current'];

function copyBreadcrumbContext(target) {
  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(target.href, window.location.origin);

  for (const parameterName of breadcrumbParameterNames) {
    const value = currentUrl.searchParams.get(parameterName);
    if (value !== null) targetUrl.searchParams.set(parameterName, value);
  }

  target.href = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function addBreadcrumbInputs(form) {
  const parameters = new URLSearchParams(window.location.search);

  for (const parameterName of breadcrumbParameterNames) {
    const value = parameters.get(parameterName);
    if (value === null || form.elements.namedItem(parameterName)) continue;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = parameterName;
    input.value = value;
    form.append(input);
  }
}

for (const breadcrumbs of document.querySelectorAll('[data-contextual-breadcrumbs]')) {
  const parameters = new URLSearchParams(window.location.search);
  const parentLabel = parameters.get('breadcrumb_parent');
  const parentUrl = parameters.get('breadcrumb_parent_url');
  const currentLabel = parameters.get('breadcrumb_current');
  const current = breadcrumbs.querySelector('[data-breadcrumb-current]');

  if (currentLabel !== null && current !== null) current.textContent = currentLabel;

  if (parentLabel !== null && parentUrl !== null && current !== null) {
    const separator = current.previousElementSibling?.cloneNode(true);
    const parent = document.createElement('a');
    let safeParentUrl;
    try {
      safeParentUrl = new URL(parentUrl, window.location.origin);
    } catch {
      safeParentUrl = new URL('/', window.location.origin);
    }
    parent.href = safeParentUrl.origin === window.location.origin ? `${safeParentUrl.pathname}${safeParentUrl.search}` : '/';
    parent.textContent = parentLabel;
    current.before(parent);
    if (separator !== undefined && separator !== null) current.before(separator);
  }
}

const desktopForm = document.querySelector('#FacetFiltersForm') ?? document.querySelector('#FacetSortForm');
if (desktopForm !== null) addBreadcrumbInputs(desktopForm);

const mobileForm = document.querySelector('#FacetFiltersFormMobile');
if (mobileForm !== null) addBreadcrumbInputs(mobileForm);

for (const link of document.querySelectorAll('.collection-filter-option a[href], .ui-pagination a[href]')) {
  copyBreadcrumbContext(link);
}

for (const link of document.querySelectorAll('[data-clear-collection-filters]')) {
  copyBreadcrumbContext(link);
  const destination = new URL(link.href, window.location.origin);
  const sort = new URLSearchParams(window.location.search).get('sort_by');
  if (sort) destination.searchParams.set('sort_by', sort);
  link.href = `${destination.pathname}${destination.search}`;
}

document.addEventListener('change', event => {
  const input = event.target;
  if (input.matches('.collection-curated-filters price-range input')) {
    const destination = new URL(window.location.href);
    for (const field of input.closest('price-range').querySelectorAll('input')) {
      destination.searchParams.delete(field.name);
      if (field.value.trim()) destination.searchParams.set(field.name, field.value);
    }
    destination.searchParams.delete('page');
    window.location.assign(`${destination.pathname}${destination.search}`);
    return;
  }
  if (!input.matches('.collection-curated-filters input[data-filter-url]') || input.disabled) return;
  const destination = { href: input.dataset.filterUrl };
  copyBreadcrumbContext(destination);
  window.location.assign(destination.href);
});