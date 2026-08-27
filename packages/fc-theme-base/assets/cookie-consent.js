class CookieConsent extends HTMLElement {
  static CATEGORIES = ['analytics', 'marketing', 'preferences'];

  connectedCallback() {
    this.banner = this.querySelector('[data-consent-banner]');
    this.dialog = this.querySelector('[data-consent-dialog]');
    this.inputs = Array.from(this.querySelectorAll('[data-action="consent-category"]'));

    this.bind('consent-accept', () => this.applyAll(true));
    this.bind('consent-decline', () => this.applyAll(false));
    this.bind('consent-save', () => this.applySelection());
    this.bind('consent-manage', () => this.openPreferences());
    this.bind('consent-close', () => this.dialog.close());

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-cookie-preferences]')) {
        event.preventDefault();
        this.openPreferences();
      }
    });

    this.setup();
  }

  bind(action, handler) {
    this.querySelectorAll(`[data-action="${action}"]`).forEach((element) =>
      element.addEventListener('click', handler)
    );
  }

  async setup() {
    try {
      this.api = await CookieConsent.loadApi();
    } catch {
      return;
    }

    this.syncInputs();

    // shouldShowBanner() only covers regulated regions, so also show whenever no decision
    // has been recorded yet — that is how the merchant's banner setting surfaces elsewhere.
    if (this.api.shouldShowBanner() || this.isUndecided()) this.showBanner();
  }

  static loadApi() {
    return new Promise((resolve, reject) => {
      if (window.Shopify?.customerPrivacy) {
        resolve(window.Shopify.customerPrivacy);
        return;
      }

      if (typeof window.Shopify?.loadFeatures !== 'function') {
        reject(new Error('Customer Privacy API unavailable'));
        return;
      }

      window.Shopify.loadFeatures([{ name: 'consent-tracking-api', version: '0.1' }], (error) => {
        if (error || !window.Shopify.customerPrivacy) reject(error || new Error('Customer Privacy API unavailable'));
        else resolve(window.Shopify.customerPrivacy);
      });
    });
  }

  isUndecided() {
    const consent = this.api.currentVisitorConsent();
    return CookieConsent.CATEGORIES.every((category) => !consent[category]);
  }

  // Optional categories stay unchecked until the visitor actively consents.
  syncInputs() {
    const consent = this.api.currentVisitorConsent();

    this.inputs.forEach((input) => {
      input.checked = consent[input.dataset.value] === 'yes';
    });
  }

  showBanner() {
    this.banner.hidden = false;
  }

  openPreferences() {
    if (this.api) this.syncInputs();
    this.dialog.showModal();
  }

  applyAll(granted) {
    this.inputs.forEach((input) => {
      input.checked = granted;
    });
    this.applySelection();
  }

  applySelection() {
    if (!this.api) return;

    const consent = {};
    this.inputs.forEach((input) => {
      consent[input.dataset.value] = input.checked;
    });

    // sale_of_data is deliberately not set here: Shopify enforces it independently of
    // consent and requires a customer-initiated opt-out flow, not a banner on page load.
    this.setError(false);
    this.api.setTrackingConsent(consent, (response) => {
      // A failed write must not dismiss the banner, or the choice is silently lost.
      if (response?.error) this.setError(true);
      else this.dismiss();
    });
  }

  setError(visible) {
    this.querySelectorAll('[data-consent-error]').forEach((element) => {
      element.hidden = !visible;
    });
  }

  dismiss() {
    if (this.dialog.open) this.dialog.close();
    this.banner.hidden = true;
  }
}

customElements.define('cookie-consent', CookieConsent);
