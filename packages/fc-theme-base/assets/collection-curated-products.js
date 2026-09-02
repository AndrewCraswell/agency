class CuratedCollectionProducts extends HTMLElement {
  connectedCallback() {
    if (!this.hasAttribute('data-curated')) return;

    this.select = this.querySelector('#SortBy');
    this.grid = this.querySelector('.collection-product-grid');
    if (!this.select || !this.grid) return;

    this.select.addEventListener('change', () => this.sortCards());
    this.sortCards();
  }

  sortCards() {
    const cards = [...this.grid.children];
    const sortBy = this.select.value;

    if (sortBy === 'title-ascending' || sortBy === 'title-descending') {
      const direction = sortBy === 'title-ascending' ? 1 : -1;
      cards.sort((left, right) => direction * left.dataset.title.localeCompare(right.dataset.title));
    } else if (sortBy === 'price-ascending' || sortBy === 'price-descending') {
      const direction = sortBy === 'price-ascending' ? 1 : -1;
      cards.sort((left, right) => direction * (Number(left.dataset.price) - Number(right.dataset.price)));
    } else {
      cards.sort((left, right) => Number(left.dataset.position) - Number(right.dataset.position));
    }

    this.grid.append(...cards);
  }
}

if (!customElements.get('curated-collection-products')) {
  customElements.define('curated-collection-products', CuratedCollectionProducts);
}