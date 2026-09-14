if (!customElements.get('cart-discount')) {
  class CartDiscount extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.addEventListener('click', event => {
        const remove = event.target.closest('[data-remove-code]');
        if (remove) this.update(remove.dataset.removeCode);
        else if (event.target.closest('[data-apply-discount]')) this.update();
      });
      this.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.matches('input')) {
          event.preventDefault();
          this.update();
        }
      });
      this.refresh();
    }

    async refresh() {
      try {
        const response = await fetch(`${routes.cart_url}.js`);
        if (response.ok) {
          const cart = await response.json();
          if (!this.busy) this.renderCodes(cart);
        }
      } catch { }
    }

    renderCodes(cart) {
      this.codes = (cart.discount_codes || []).filter(code => code.applicable).map(code => code.code);
      const list = this.querySelector('[data-discount-codes]');
      list.replaceChildren();
      for (const code of this.codes) {
        const row = document.createElement('li');
        const label = document.createElement('span');
        label.textContent = code;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ui-button ui-button--icon';
        remove.dataset.removeCode = code;
        const icon = this.querySelector('[data-remove-icon]');
        if (icon) remove.append(icon.content.cloneNode(true));
        else remove.textContent = this.dataset.removeLabel;
        remove.setAttribute('aria-label', `${this.dataset.removeLabel}: ${code}`);
        remove.title = `${this.dataset.removeLabel}: ${code}`;
        row.append(label, remove);
        list.append(row);
      }
    }

    async update(removeCode) {
      if (this.busy) return;
      const input = this.querySelector('input');
      const code = input.value.trim();
      if (!removeCode && !code) { input.focus(); return; }
      const status = this.querySelector('[data-discount-status]');
      const controller = customElements.get('cart-items');
      this.busy = true;
      this.querySelectorAll('button').forEach(button => { button.disabled = true; });
      status.textContent = '';
      status.removeAttribute('data-error');
      input.removeAttribute('aria-invalid');
      try {
        await controller.mutate(async () => {
          const snapshot = await fetch(`${routes.cart_url}.js`);
          if (!snapshot.ok) throw new Error(this.dataset.error);
          const current = await snapshot.json();
          const codes = (current.discount_codes || []).filter(entry => entry.applicable).map(entry => entry.code);
          let next = codes.filter(value => value.toLowerCase() !== removeCode?.toLowerCase());
          if (!removeCode && !next.some(value => value.toLowerCase() === code.toLowerCase())) next.push(code);
          const response = await fetch(routes.cart_update_url, { ...fetchConfig(), body: JSON.stringify({ discount: next.join(',') }) });
          const cart = await response.json();
          if (!response.ok || cart.errors) throw new Error(this.dataset.error);
          const applied = (cart.discount_codes || []).some(entry => entry.applicable && entry.code.toLowerCase() === code.toLowerCase());
          await Promise.all([...document.querySelectorAll('cart-items, cart-drawer-items')].map(view => view.onCartUpdate()));
          document.querySelectorAll('cart-discount').forEach(control => {
            control.renderCodes(cart);
            if (control.querySelector('input').id !== input.id) return;
            const message = control.querySelector('[data-discount-status]');
            const field = control.querySelector('input');
            control.querySelector('details').open = true;
            if (!removeCode && !applied) {
              message.textContent = control.dataset.invalid;
              message.setAttribute('data-error', '');
              field.setAttribute('aria-invalid', 'true');
            } else if (removeCode && (cart.discount_codes || []).some(entry => entry.applicable && entry.code.toLowerCase() === removeCode.toLowerCase())) {
              message.textContent = control.dataset.error;
              message.setAttribute('data-error', '');
            } else {
              field.value = '';
              message.textContent = removeCode ? control.dataset.removed : control.dataset.applied;
            }
            field.focus({ preventScroll: true });
          });
        });
      } catch {
        status.textContent = this.dataset.error;
        status.setAttribute('data-error', '');
      } finally {
        this.busy = false;
        this.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
  }
  customElements.define('cart-discount', CartDiscount);
}

if (!window.cartCheckoutGuard) {
  window.cartCheckoutGuard = true;
  document.addEventListener('submit', event => {
    if (!['cart', 'CartDrawer-Form'].includes(event.target.id)) return;
    const controller = customElements.get('cart-items');
    if (controller.mutationCount || controller.pendingQuantities.size || document.querySelector('cart-note[data-unsaved]')) {
      event.preventDefault();
      const note = document.querySelector('cart-note[data-unsaved]');
      if (note) {
        note.closest('details').open = true;
        note.querySelector('[data-save-note]').focus();
      }
    }
  });
}