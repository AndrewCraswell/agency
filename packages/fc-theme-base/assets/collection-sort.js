class CollectionSort extends HTMLElement {
  connectedCallback() {
    this.details = this.querySelector('details');
    this.input = this.querySelector('input[name="sort_by"]');
    this.currentLabel = this.querySelector('[data-sort-current]');
    this.optionButtons = [...this.querySelectorAll('[data-sort-value]')];

    if (!this.details || !this.input || !this.currentLabel) return;

    this.onOptionClick = this.onOptionClick.bind(this);
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);

    for (const button of this.optionButtons) button.addEventListener('click', this.onOptionClick);
    document.addEventListener('click', this.onDocumentClick);
    this.addEventListener('keydown', this.onKeyDown);
  }

  disconnectedCallback() {
    for (const button of this.optionButtons ?? []) button.removeEventListener('click', this.onOptionClick);
    document.removeEventListener('click', this.onDocumentClick);
    this.removeEventListener('keydown', this.onKeyDown);
  }

  onOptionClick(event) {
    const button = event.currentTarget;
    this.input.value = button.dataset.sortValue;
    this.currentLabel.textContent = button.textContent.trim();

    for (const optionButton of this.optionButtons) {
      optionButton.setAttribute('aria-selected', String(optionButton === button));
    }

    this.details.removeAttribute('open');
    this.input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  onDocumentClick(event) {
    if (!this.contains(event.target)) this.details.removeAttribute('open');
  }

  onKeyDown(event) {
    if (event.key !== 'Escape') return;
    this.details.removeAttribute('open');
    this.querySelector('summary')?.focus();
  }
}

if (!customElements.get('collection-sort')) {
  customElements.define('collection-sort', CollectionSort);
}