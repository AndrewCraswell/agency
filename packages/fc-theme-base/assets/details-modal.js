class DetailsModal extends HTMLElement {
  constructor() {
    super();
    this.detailsContainer = this.querySelector('details');
    this.summaryToggle = this.querySelector('summary');

    this.detailsContainer.addEventListener('keyup', (event) => event.code.toUpperCase() === 'ESCAPE' && this.close());
    this.summaryToggle.addEventListener('click', this.onSummaryClick.bind(this));
    this.querySelector('button[type="button"]').addEventListener('click', this.close.bind(this));

    this.summaryToggle.setAttribute('role', 'button');
  }

  isOpen() {
    return this.detailsContainer.hasAttribute('open');
  }

  onSummaryClick(event) {
    event.preventDefault();
    event.target.closest('details').hasAttribute('open') ? this.close() : this.open(event);
  }

  onBodyClick(event) {
    if (!this.contains(event.target) || event.target.classList.contains('modal-overlay')) this.close(false);
  }

  open(event) {
    this.onBodyClickEvent = this.onBodyClickEvent || this.onBodyClick.bind(this);
    this.querySelector('.search-panel')?.removeAttribute('data-closing-content');
    event.target.closest('details').setAttribute('open', true);
    this.querySelector('.search-modal')?.removeAttribute('inert');
    this.summaryToggle.setAttribute('aria-expanded', 'true');
    document.body.addEventListener('click', this.onBodyClickEvent);
    document.body.classList.add('overflow-hidden');

    trapFocus(
      this.detailsContainer.querySelector('[tabindex="-1"]'),
      this.detailsContainer.querySelector('input:not([type="hidden"])')
    );
  }

  close(focusToggle = true) {
    const search = this.querySelector('.search-panel');
    if (search && this.isOpen()) {
      if (search.hasAttribute('idle')) search.dataset.closingContent = 'idle';
      else if (search.hasAttribute('open') || search.hasAttribute('loading')) search.dataset.closingContent = 'results';
    }
    removeTrapFocus(focusToggle ? this.summaryToggle : null);
    this.querySelector('.search-modal')?.setAttribute('inert', '');
    this.summaryToggle.setAttribute('aria-expanded', 'false');
    this.detailsContainer.removeAttribute('open');
    this.querySelector('predictive-search')?.close();
    document.body.removeEventListener('click', this.onBodyClickEvent);
    document.body.classList.remove('overflow-hidden');
  }
}

customElements.define('details-modal', DetailsModal);
