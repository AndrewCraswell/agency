class UISelect extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.select = this.querySelector('select');
    this.trigger = this.querySelector('[data-select-trigger]');
    this.menu = this.querySelector('[data-select-menu]');
    if (!this.select || !this.trigger || !this.menu) return;
    this.initialized = true;
    this.current = this.querySelector('[data-select-current]');
    this.validation = this.querySelector('[data-select-validation]');
    this.label = this.querySelector('label');
    this.onTriggerClick = () => { if (this.menu.hidden) this.open(); else this.close(); };
    this.onKeyDown = event => this.handleKeyDown(event);
    this.onKeyUp = event => {
      if (event.key === 'Escape' && this.dismissedByEscape) {
        event.stopPropagation();
        this.dismissedByEscape = false;
      }
    };
    this.onOptionClick = event => {
      const option = event.target.closest('[data-select-index]');
      if (option && this.menu.contains(option)) this.choose(Number(option.dataset.selectIndex));
    };
    this.onMenuMouseDown = event => event.preventDefault();
    this.onOutsideClick = event => { if (!this.contains(event.target)) this.close(); };
    this.onFocusOut = event => { if (!this.contains(event.relatedTarget)) this.close(); };
    this.onLabelClick = event => { event.preventDefault(); this.trigger.focus(); };
    this.onChange = () => { this.validation.hidden = true; this.sync(); };
    this.onInvalid = event => {
      event.preventDefault();
      this.validation.textContent = this.select.validationMessage;
      this.validation.hidden = false;
      this.close();
      this.sync();
      this.trigger.focus();
    };
    this.onReset = () => { clearTimeout(this.resetTimer); this.resetTimer = setTimeout(() => { this.validation.hidden = true; this.close(); this.sync(); }); };
    this.onResize = () => { if (!this.menu.hidden) this.positionMenu(); };
    this.trigger.addEventListener('click', this.onTriggerClick);
    this.trigger.addEventListener('keydown', this.onKeyDown);
    this.trigger.addEventListener('keyup', this.onKeyUp);
    this.menu.addEventListener('click', this.onOptionClick);
    this.menu.addEventListener('mousedown', this.onMenuMouseDown);
    this.addEventListener('focusout', this.onFocusOut);
    this.label.addEventListener('click', this.onLabelClick);
    this.select.addEventListener('input', this.onChange);
    this.select.addEventListener('change', this.onChange);
    this.select.addEventListener('invalid', this.onInvalid);
    this.form = this.select.form;
    this.form?.addEventListener('reset', this.onReset);
    document.addEventListener('click', this.onOutsideClick);
    window.addEventListener('resize', this.onResize);
    this.observer = new MutationObserver(() => this.sync());
    this.observer.observe(this.select, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['selected', 'disabled', 'label', 'value', 'required', 'aria-invalid', 'aria-describedby', 'hidden'] });
    this.select.tabIndex = -1;
    this.select.setAttribute('aria-hidden', 'true');
    this.setAttribute('data-enhanced', '');
    this.trigger.hidden = false;
    this.sync();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this.trigger.removeEventListener('click', this.onTriggerClick);
    this.trigger.removeEventListener('keydown', this.onKeyDown);
    this.trigger.removeEventListener('keyup', this.onKeyUp);
    this.menu.removeEventListener('click', this.onOptionClick);
    this.menu.removeEventListener('mousedown', this.onMenuMouseDown);
    this.removeEventListener('focusout', this.onFocusOut);
    this.label.removeEventListener('click', this.onLabelClick);
    this.select.removeEventListener('input', this.onChange);
    this.select.removeEventListener('change', this.onChange);
    this.select.removeEventListener('invalid', this.onInvalid);
    this.form?.removeEventListener('reset', this.onReset);
    document.removeEventListener('click', this.onOutsideClick);
    window.removeEventListener('resize', this.onResize);
    this.observer.disconnect();
    clearTimeout(this.resetTimer);
    this.close();
    this.initialized = false;
  }

  sync() {
    this.options = [...this.select.options];
    this.current.textContent = this.optionLabel(this.options[this.select.selectedIndex]);
    this.trigger.disabled = this.select.matches(':disabled');
    this.classList.toggle('ui-field--disabled', this.trigger.disabled);
    this.trigger.setAttribute('aria-required', String(this.select.required));
    this.trigger.setAttribute('aria-invalid', String(this.select.getAttribute('aria-invalid') === 'true' || !this.validation.hidden));
    const descriptions = [this.select.getAttribute('aria-describedby')];
    if (!this.validation.hidden) descriptions.push(this.validation.id);
    const description = descriptions.filter(Boolean).join(' ');
    if (description) this.trigger.setAttribute('aria-describedby', description);
    else this.trigger.removeAttribute('aria-describedby');
    this.menu.replaceChildren();
    this.rows = this.options.map((option, index) => {
      const row = document.createElement('div');
      row.className = 'ui-select__option';
      row.id = `${this.select.id}-option-${index}`;
      row.dataset.selectIndex = index;
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(option.selected));
      row.setAttribute('aria-disabled', String(this.isDisabled(index)));
      row.hidden = option.hidden || option.parentElement.hidden;
      const label = document.createElement('span');
      label.textContent = this.optionLabel(option);
      const check = document.createElement('span');
      check.className = 'ui-select__check';
      check.setAttribute('aria-hidden', 'true');
      check.append(this.querySelector('[data-select-check]').content.cloneNode(true));
      row.append(label, check);
      this.menu.append(row);
      return row;
    });
    if (this.trigger.disabled) this.close();
    else if (!this.menu.hidden) this.activate(this.select.selectedIndex);
  }

  optionLabel(option) {
    return option?.getAttribute('label') || option?.textContent.trim().replace(/\s+/g, ' ') || '';
  }

  isDisabled(index) {
    const option = this.options[index];
    return !option || option.disabled || option.parentElement.disabled || option.hidden || option.parentElement.hidden;
  }

  open() {
    if (this.trigger.disabled) return;
    this.menu.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.positionMenu();
    let index = this.select.selectedIndex;
    if (this.isDisabled(index)) index = this.options.findIndex((_option, position) => !this.isDisabled(position));
    this.activate(index);
  }

  close() {
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.trigger.removeAttribute('aria-activedescendant');
    this.removeAttribute('data-open-above');
    this.searchText = '';
  }

  positionMenu() {
    const bounds = this.trigger.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 16;
    const above = bounds.top - 16;
    const opensAbove = below < 200 && above > below;
    this.toggleAttribute('data-open-above', opensAbove);
    this.menu.style.maxHeight = `${Math.max(44, Math.min(320, opensAbove ? above : below))}px`;
  }

  activate(index) {
    if (index < 0 || this.isDisabled(index)) return;
    this.activeIndex = index;
    this.rows.forEach((row, position) => row.toggleAttribute('data-active', index === position));
    this.trigger.setAttribute('aria-activedescendant', this.rows[index].id);
    const row = this.rows[index];
    if (row.offsetTop < this.menu.scrollTop) this.menu.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > this.menu.scrollTop + this.menu.clientHeight) this.menu.scrollTop = row.offsetTop + row.offsetHeight - this.menu.clientHeight;
  }

  choose(index) {
    if (this.trigger.disabled || this.isDisabled(index)) return;
    const changed = this.select.selectedIndex !== index;
    this.select.selectedIndex = index;
    this.select.removeAttribute('aria-invalid');
    this.validation.hidden = true;
    this.close();
    this.sync();
    this.trigger.focus({ preventScroll: true });
    if (changed) {
      this.select.dispatchEvent(new Event('input', { bubbles: true }));
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  handleKeyDown(event) {
    if (event.key === 'Tab') { this.close(); return; }
    if (event.key === 'Escape') {
      this.dismissedByEscape = !this.menu.hidden;
      if (this.dismissedByEscape) { event.preventDefault(); event.stopPropagation(); this.close(); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.menu.hidden) this.open();
      else this.choose(this.activeIndex);
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const wasClosed = this.menu.hidden;
      if (wasClosed) this.open();
      const enabled = this.options.map((_option, index) => index).filter(index => !this.isDisabled(index));
      if (!enabled.length) return;
      let position = enabled.indexOf(this.activeIndex);
      if (event.key === 'Home') position = 0;
      else if (event.key === 'End') position = enabled.length - 1;
      else if (!wasClosed) position += event.key === 'ArrowDown' ? 1 : -1;
      this.activate(enabled[(position + enabled.length) % enabled.length]);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      let query = '';
      if (now - this.lastTyped < 700) query = this.searchText || '';
      if (this.menu.hidden) this.open();
      query += event.key.toLocaleLowerCase();
      this.searchText = query;
      this.lastTyped = now;
      const index = this.options.findIndex((option, position) => !this.isDisabled(position) && this.optionLabel(option).toLocaleLowerCase().startsWith(query));
      if (index >= 0) this.activate(index);
    }
  }
}

if (!customElements.get('ui-select')) customElements.define('ui-select', UISelect);