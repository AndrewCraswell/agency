class PolicyPage extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.article = this.querySelector('.policy-page__article');
    this.contents = this.querySelector('.policy-page__contents');
    this.disclosure = this.querySelector('.policy-page__disclosure');
    this.desktop = window.matchMedia('(min-width: 1100px)');
    this.onBreakpointChange = () => {
      this.disclosure.open = this.desktop.matches;
    };

    const headings = this.article.querySelectorAll('h2');
    const list = this.querySelector('.policy-page__contents-list');
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `Policy-${this.dataset.sectionId}-${index + 1}`;
      heading.tabIndex = -1;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent.trim();
      link.addEventListener('click', () => {
        if (!this.desktop.matches) this.disclosure.open = false;
        heading.focus({ preventScroll: true });
      });
      item.append(link);
      list.append(item);
    });
    this.contents.hidden = headings.length === 0;
    this.onBreakpointChange();
    this.desktop.addEventListener('change', this.onBreakpointChange);
    this.prepareTables();
  }

  disconnectedCallback() {
    this.desktop?.removeEventListener('change', this.onBreakpointChange);
    this.initialized = false;
    this.querySelector('.policy-page__contents-list')?.replaceChildren();
  }

  prepareTables() {
    this.article.querySelectorAll('table').forEach((table) => {
      if (table.parentElement.classList.contains('policy-page__table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'policy-page__table-scroll';
      table.before(wrapper);
      wrapper.append(table);
      const headers = Array.from(table.querySelectorAll('thead th'));
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      if (!headers.length || !rows.length) return;
      if (rows.some((row) => row.cells.length !== headers.length)) return;
      if (table.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])')) return;

      table.classList.add('policy-page__table--stacked');
      table.setAttribute('role', 'table');
      table.querySelectorAll('tr').forEach((row) => row.setAttribute('role', 'row'));
      headers.forEach((header) => {
        header.scope = 'col';
        header.setAttribute('role', 'columnheader');
      });
      rows.forEach((row) => {
        Array.from(row.cells).forEach((cell, index) => {
          cell.setAttribute('role', 'cell');
          const label = document.createElement('span');
          label.className = 'policy-page__table-label';
          label.setAttribute('aria-hidden', 'true');
          label.textContent = headers[index].textContent.trim();
          cell.prepend(label);
        });
      });
    });
  }
}

if (!customElements.get('policy-page')) customElements.define('policy-page', PolicyPage);