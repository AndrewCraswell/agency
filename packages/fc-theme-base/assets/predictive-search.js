const RECENT_SEARCHES_KEY = 'fc:recent-searches';
const RECENT_SEARCHES_LIMIT = 5;
const RECENT_SEARCH_ICON =
  '<svg class="fc-icon fc-icon--history" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';

class PredictiveSearch extends SearchForm {
  constructor() {
    super();
    this.cachedResults = {};
    this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
    this.idleResults = this.querySelector('[data-predictive-search-idle]');
    this.details = this.closest('details');
    this.allPredictiveSearchInstances = document.querySelectorAll('predictive-search');
    this.isOpen = false;
    this.abortController = new AbortController();
    this.searchTerm = '';
    this.predictiveSearchResults.inert = true;
    if (this.idleResults) this.idleResults.inert = true;

    this.setupEventListeners();
    this.updatePanelGeometry();
  }

  setupEventListeners() {
    this.input.form.addEventListener('submit', this.onFormSubmit.bind(this));
    this.input.addEventListener('input', () => { this.dismissed = false; });

    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('keyup', this.onKeyup.bind(this));
    this.addEventListener('keydown', this.onKeydown.bind(this));
    this.details?.addEventListener('toggle', this.onDetailsToggle.bind(this));

    this.idleResults
      ?.querySelector('[data-clear-recent-searches]')
      ?.addEventListener('click', this.onClearRecentSearches.bind(this));

    window.addEventListener('resize', this.updatePanelGeometry.bind(this));
  }

  getQuery() {
    return this.input.value.trim();
  }

  onChange() {
    if (this.dismissed) return;
    super.onChange();
    const newSearchTerm = this.getQuery();
    if (!this.searchTerm || !newSearchTerm.startsWith(this.searchTerm)) {
      // Remove the results when they are no longer relevant for the new search term
      // so they don't show up when the dropdown opens again
      this.querySelector('[data-search-results-groups]')?.remove();
    }

    // Update the term asap, don't wait for the predictive search query to finish loading
    this.updateSearchForTerm(this.searchTerm, newSearchTerm);

    this.searchTerm = newSearchTerm;

    if (!this.searchTerm.length) {
      this.close(true);
      this.openIdle();
      return;
    }

    this.closeIdle();
    this.getSearchResults(this.searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length) {
      event.preventDefault();
      return;
    }

    this.saveRecentSearch(this.getQuery());
  }

  onFormReset(event) {
    super.onFormReset(event);
    this.searchTerm = '';
    this.abortController.abort();
    this.abortController = new AbortController();
    this.closeResults(true);
    this.openIdle();
  }

  onClearRecentSearches() {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Storage is unavailable, so there is nothing cached to clear.
    }
    this.renderRecentSearches();
    this.input.focus();
  }

  getRecentSearches() {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY));
      if (!Array.isArray(stored)) return [];
      return stored.filter((term) => typeof term === 'string' && term.length).slice(0, RECENT_SEARCHES_LIMIT);
    } catch {
      return [];
    }
  }

  saveRecentSearch(term) {
    const trimmed = term.trim();
    if (!trimmed.length) return;

    const remaining = this.getRecentSearches().filter((stored) => stored.toLowerCase() !== trimmed.toLowerCase());

    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([trimmed, ...remaining].slice(0, RECENT_SEARCHES_LIMIT)));
    } catch {
      // Storage is unavailable, so recent searches simply are not remembered.
    }
  }

  renderRecentSearches() {
    const group = this.idleResults?.querySelector('[data-recent-searches]');
    const list = this.idleResults?.querySelector('[data-recent-searches-list]');
    if (!group || !list) return;

    const terms = this.getRecentSearches();
    list.textContent = '';

    terms.forEach((term) => {
      const icon = document.createElement('span');
      icon.className = 'predictive-search__item-icon';
      icon.innerHTML = RECENT_SEARCH_ICON;

      const title = document.createElement('span');
      title.className = 'predictive-search__item-title';
      title.textContent = term;

      const link = document.createElement('a');
      link.className = 'predictive-search__item';
      link.href = `${routes.search_url}?q=${encodeURIComponent(term)}&options%5Bprefix%5D=last`;
      link.append(icon, title);

      const item = document.createElement('li');
      item.className = 'predictive-search__list-item';
      item.setAttribute('data-search-result', '');
      item.append(link);

      list.append(item);
    });

    group.hidden = terms.length === 0;
    this.idleResults.classList.toggle('predictive-search--idle-no-recent', terms.length === 0);
  }

  openIdle() {
    if (!this.idleResults) return;

    this.dismissed = false;
    this.renderRecentSearches();
    this.updatePanelGeometry();
    this.idleResults.inert = false;
    this.setAttribute('idle', true);
    this.input.setAttribute('aria-controls', this.idleResults.id);
    if (this.input.getAttribute('role') === 'combobox') this.input.setAttribute('aria-expanded', 'true');
  }

  closeIdle() {
    if (this.idleResults) this.idleResults.inert = true;
    this.removeAttribute('idle');
  }

  onFocus() {
    this.dismissed = false;
    const currentSearchTerm = this.getQuery();

    if (!currentSearchTerm.length) {
      this.openIdle();
      return;
    }

    this.closeIdle();

    if (this.searchTerm !== currentSearchTerm) {
      // Search term was changed from other search input, treat it as a user change
      this.onChange();
    } else if (this.getAttribute('results') === 'true') {
      this.open();
    } else {
      this.getSearchResults(this.searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.contains(document.activeElement)) return;

      if (this.details?.open) {
        if (!this.getQuery().length) this.openIdle();
        return;
      }

      this.close();
    });
  }

  onDetailsToggle() {
    if (!this.details.open) {
      this.close();
      return;
    }

    if (!this.getQuery().length) this.openIdle();
  }

  onKeyup(event) {
    if (event.code === 'Escape') {
      const focusInPanel = this.predictiveSearchResults.contains(document.activeElement) || this.idleResults?.contains(document.activeElement);
      if (!this.details?.open && focusInPanel) {
        this.input.focus({ preventScroll: true });
      }
      this.close();
    }
  }

  onKeydown(event) {
    // Prevent the cursor from moving in the input when using the up and down arrow keys
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault();
      this.switchOption(event.code === 'ArrowUp' ? 'up' : 'down');
    }
  }

  updateSearchForTerm(previousTerm, newTerm) {
    const searchForTextElement = this.querySelector('.predictive-search__view-all-label');
    const currentButtonText = searchForTextElement?.innerText;
    if (currentButtonText) {
      if (previousTerm && currentButtonText.split(previousTerm).length > 2) {
        // The new term matches part of the button text and not just the search term, do not replace to avoid mistakes
        return;
      }
      const newButtonText = currentButtonText.replace(previousTerm, newTerm);
      searchForTextElement.innerText = newButtonText;
    }
  }

  switchOption(direction) {
    let panel = this.predictiveSearchResults;
    if (this.hasAttribute('idle')) panel = this.idleResults;
    if (!panel || panel.inert) return;
    const links = [...panel.querySelectorAll('[data-search-result]')]
      .map(element => element.querySelector('a[href]'))
      .filter(link => link && link.offsetParent !== null);
    if (!links.length) return;
    const focusedResult = document.activeElement.closest('[data-search-result]');
    const currentIndex = links.findIndex(link => link.closest('[data-search-result]') === focusedResult);
    if (direction === 'up' && currentIndex <= 0) {
      this.input.focus({ preventScroll: true });
      return;
    }
    let nextIndex = currentIndex + 1;
    if (direction === 'up') nextIndex = currentIndex - 1;
    if (nextIndex >= links.length) nextIndex = 0;
    links[nextIndex].focus();
  }

  getSearchResults(searchTerm) {
    this.abortController.abort();
    this.abortController = new AbortController();
    const request = this.abortController;
    const queryKey = searchTerm.replace(' ', '-').toLowerCase();
    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      const searchDeferred = this.dispatchSearchUpdateEvent(searchTerm);
      searchDeferred?.resolve({ totalCount: this.getTotalResultCount() });
      return;
    }

    const searchDeferred = this.dispatchSearchUpdateEvent(searchTerm);

    // The panel renders a fixed number of entries per group, so ask for the largest
    // group's worth of each type and let the section trim the rest.
    const params = new URLSearchParams({
      q: searchTerm,
      'resources[type]': 'query,collection,product,article,page',
      'resources[limit]': '4',
      'resources[limit_scope]': 'each',
      section_id: 'predictive-search',
    });

    return fetch(`${routes.predictive_search_url}?${params}`, {
      signal: request.signal,
    })
      .then((response) => {
        if (request.signal.aborted) return;
        if (!response.ok) {
          var error = new Error(response.status);
          this.close();
          throw error;
        }

        return response.text();
      })
      .then((text) => {
        if (request.signal.aborted) return;
        const resultsMarkup = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('#shopify-section-predictive-search').innerHTML;
        // Save bandwidth keeping the cache in all instances synced
        this.allPredictiveSearchInstances.forEach((predictiveSearchInstance) => {
          predictiveSearchInstance.cachedResults[queryKey] = resultsMarkup;
        });
        this.renderSearchResults(resultsMarkup);

        searchDeferred?.resolve({ totalCount: this.getTotalResultCount() });
      })
      .catch((error) => {
        if (request.signal.aborted || error?.code === 20) {
          // Code 20 means the call was aborted
          searchDeferred?.reject(error);
          return;
        }
        searchDeferred?.reject(error);
        this.close();
        throw error;
      });
  }

  getTotalResultCount() {
    return parseInt(this.predictiveSearchResults.querySelector('[data-total-results]')?.dataset.totalResults) || 0;
  }

  dispatchSearchUpdateEvent(query) {
    const { SearchUpdateEvent } = window.StandardEvents || {};
    if (!SearchUpdateEvent) return null;

    const deferred = SearchUpdateEvent.createPromise();
    this.dispatchEvent(
      new SearchUpdateEvent({
        search: { query },
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  setLiveRegionLoadingState() {
    this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
    this.loadingText = this.loadingText || this.getAttribute('data-loading-text');

    this.setLiveRegionText(this.loadingText);
    this.predictiveSearchResults.inert = false;
    this.setAttribute('loading', true);
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute('aria-hidden', 'false');
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute('aria-hidden', 'true');
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup;
    for (const element of this.predictiveSearchResults.querySelectorAll('[id]')) {
      element.id = `${this.input.id}-${element.id}`;
    }
    for (const element of this.predictiveSearchResults.querySelectorAll('[aria-labelledby]')) {
      const labels = element.getAttribute('aria-labelledby').split(/\s+/);
      element.setAttribute('aria-labelledby', labels.map(id => `${this.input.id}-${id}`).join(' '));
    }
    this.setAttribute('results', true);

    this.setLiveRegionResults();
    this.open();
  }

  setLiveRegionResults() {
    this.removeAttribute('loading');
    this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent);
  }

  updatePanelGeometry() {
    // The header panel is fixed and full-bleed, so it needs the header's own bottom edge.
    const headerBottom = Math.max(document.querySelector('.section-header')?.getBoundingClientRect().bottom ?? 0, 0);
    const style = document.documentElement.style;
    style.setProperty('--predictive-search-top', `${headerBottom}px`);
    style.setProperty('--predictive-search-max', `${window.innerHeight - headerBottom}px`);
  }

  open() {
    this.updatePanelGeometry();
    this.closeIdle();
    this.predictiveSearchResults.inert = false;
    this.setAttribute('open', true);
    this.input.setAttribute('aria-controls', this.predictiveSearchResults.id);
    if (this.input.getAttribute('role') === 'combobox') this.input.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
  }

  close(clearSearchTerm = false) {
    this.dismissed = true;
    this.closeResults(clearSearchTerm);
    this.closeIdle();
    this.isOpen = false;
  }

  closeResults(clearSearchTerm = false) {
    this.abortController.abort();
    this.predictiveSearchResults.inert = true;
    if (clearSearchTerm) {
      this.input.value = '';
      this.removeAttribute('results');
    }
    this.removeAttribute('loading');
    this.removeAttribute('open');
    if (this.input.getAttribute('role') === 'combobox') this.input.setAttribute('aria-expanded', 'false');
  }
}

customElements.define('predictive-search', PredictiveSearch);
