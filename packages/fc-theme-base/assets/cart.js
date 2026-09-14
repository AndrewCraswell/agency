class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends window.StandardEvents.createViewEventElement(HTMLElement) {
  constructor() {
    super();
    this.addEventListener('change', event => {
      if (!event.target.matches('input[data-index]')) return;
      clearTimeout(this.quantityTimer);
      CartItems.pendingQuantities.add(this);
      CartItems.updateCheckoutState();
      this.quantityTimer = setTimeout(() => {
        CartItems.pendingQuantities.delete(this);
        this.onChange(event);
        CartItems.updateCheckoutState();
      }, ON_CHANGE_DEBOUNCE_TIMER);
    });
  }

  cartUpdateUnsubscriber = undefined;

  static pendingCartDataPromise = null;
  static mutationCount = 0;
  static mutationQueue = Promise.resolve();
  static pendingQuantities = new Set();

  static updateCheckoutState() {
    const blocked = CartItems.mutationCount > 0 || CartItems.pendingQuantities.size > 0 || !!document.querySelector('cart-note[data-unsaved]');
    document.querySelectorAll('button[name="checkout"]').forEach(button => {
      button.disabled = blocked || !!button.closest('.is-empty');
    });
    document.documentElement.toggleAttribute('data-cart-busy', CartItems.mutationCount > 0);
  }

  static mutate(operation) {
    CartItems.mutationCount += 1;
    CartItems.updateCheckoutState();
    const result = CartItems.mutationQueue.then(operation);
    CartItems.mutationQueue = result.catch(() => {});
    return result.finally(() => {
      CartItems.mutationCount -= 1;
      CartItems.updateCheckoutState();
    });
  }

  get lineItemStatusElement() {
    return this.querySelector('[data-cart-loading]') || this.querySelector('#shopping-cart-line-item-status') || this.querySelector('#CartDrawer-LineItemStatus');
  }

  connectedCallback() {
    // The factory base class auto-dispatches cart:view from the
    // `view-event-payload` attribute (Liquid filter output). The drawer
    // sets `view-event-trigger="manual"` to skip auto-dispatch.
    super.connectedCallback();

    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') return;
      return this.onCartUpdate();
    });
  }

  // Fetches the full cart shape (used to resolve the cart:lines-update event
  // promise after /cart/add.js, which only returns the added line — not the
  // post-mutation cart aggregates). De-duplicated across concurrent callers.
  static fetchCartData() {
    if (!CartItems.pendingCartDataPromise) {
      const pendingCartDataPromise = fetch(`${routes.cart_url}.json`)
        .then((response) => response.json())
        .catch(() => null)
        .finally(() => {
          if (CartItems.pendingCartDataPromise === pendingCartDataPromise) CartItems.pendingCartDataPromise = null;
        });

      CartItems.pendingCartDataPromise = pendingCartDataPromise;
    }
    return CartItems.pendingCartDataPromise;
  }

  disconnectedCallback() {
    clearTimeout(this.quantityTimer);
    CartItems.pendingQuantities.delete(this);
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`) || this.querySelector(`#Drawer-quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (!Number.isFinite(inputValue)) {
      this.resetQuantityInput(index);
      return;
    }
    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    if (!event.target.matches('input[data-index]')) return;
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const drawer = document.querySelector('cart-drawer');
          const target = drawer.querySelector('.drawer__inner');
          const source = html.querySelector('.drawer__inner');
          const focusedId = target.contains(document.activeElement) ? document.activeElement.id : null;
          CartItems.preserveControls(target, source);
          target.innerHTML = source.innerHTML;
          drawer.classList.toggle('is-empty', html.querySelector('cart-drawer').classList.contains('is-empty'));
          if (drawer.classList.contains('active')) {
            const focus = focusedId && target.querySelector(`#${CSS.escape(focusedId)}`);
            trapFocus(target, focus || target.querySelector('.drawer__close'));
          }
          CartItems.updateCheckoutState();
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      const sections = this.getSectionsToRender();
      return fetch(`${routes.cart_url}?sections=${sections.map(section => section.section).join(',')}`)
        .then((response) => response.json())
        .then((html) => {
          sections.forEach(section => {
            const target = document.getElementById(section.id)?.querySelector(section.selector);
            if (target && html[section.section]) {
              const source = new DOMParser().parseFromString(html[section.section], 'text/html').querySelector(section.selector);
              CartItems.preserveControls(target, source);
              target.innerHTML = source.innerHTML;
            }
          });
          const cartHtml = new DOMParser().parseFromString(html[sections[0].section], 'text/html');
          const count = cartHtml.querySelector('[data-cart-count]');
          if (count) this.querySelector('[data-cart-count]').textContent = count.textContent;
          const empty = cartHtml.querySelector('cart-items').classList.contains('is-empty');
          this.classList.toggle('is-empty', empty);
          document.getElementById('main-cart-footer')?.classList.toggle('is-empty', empty);
          CartItems.updateCheckoutState();
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  static preserveControls(target, source) {
    target.querySelectorAll('details[open][id]').forEach(details => {
      source.querySelector(`#${CSS.escape(details.id)}`)?.setAttribute('open', '');
    });
    target.querySelectorAll('cart-note[data-unsaved]').forEach(note => {
      const replacement = source.querySelector(`textarea[id="${note.querySelector('textarea').id}"]`);
      if (replacement) {
        replacement.value = note.querySelector('textarea').value;
        replacement.textContent = replacement.value;
        replacement.closest('cart-note').setAttribute('data-unsaved', '');
      }
    });
    target.querySelectorAll('cart-discount').forEach(control => {
      const input = control.querySelector('input');
      const replacement = source.querySelector(`input[id="${input.id}"]`);
      if (replacement) {
        replacement.value = input.value;
        replacement.setAttribute('value', input.value);
      }
    });
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, event, name, variantId) {
    if (CartItems.mutationCount > 0) {
      this.resetQuantityInput(line);
      return;
    }
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';
    const cartPerformanceUpdateMarker = CartPerformance.createStartingMarker(`${eventTarget}:user-action`);

      const errorRegion = this.closest('cart-drawer')?.querySelector('#CartDrawer-CartErrors') || document.getElementById('cart-errors');
      if (errorRegion) errorRegion.textContent = '';
    this.enableLoading(line);

    const action = quantity === 0 ? 'remove' : 'update';
    const quantityInput = this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
    const lineVariantId = variantId || quantityInput?.dataset.quantityVariantId;
    const lineKey = quantityInput?.dataset.quantityLineKey;
    const linesUpdateDeferred = this.createCartLinesUpdateEvent(action, lineVariantId, quantity, lineKey);

    // Cache sections before the fetch so we read dataset.id while elements still exist in the DOM
    const sectionsToRender = this.getSectionsToRender();

    const body = JSON.stringify({
      id: lineKey,
      quantity,
      sections: sectionsToRender.map((section) => section.section),
      sections_url: window.location.pathname,
    });

    return CartItems.mutate(() => fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        if (parsedState.errors) {
          this.dispatchCartErrorEvent(parsedState.errors, 'INVALID');
          linesUpdateDeferred?.reject(new Error(parsedState.errors));
        } else {
          this.resolveCartLinesUpdate(linesUpdateDeferred, parsedState);
        }

        CartPerformance.measure(`${eventTarget}:paint-updated-sections`, () => {
          const quantityElement =
            this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
          const items = this.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = this.closest('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          sectionsToRender.forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) ||
              document.getElementById(section.id);
            const source = new DOMParser().parseFromString(parsedState.sections[section.section], 'text/html').querySelector(section.selector);
            CartItems.preserveControls(elementToReplace, source);
            elementToReplace.innerHTML = source.innerHTML;
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const pageSection = sectionsToRender.find(section => section.id === 'main-cart-items');
          if (pageSection) {
            const count = new DOMParser().parseFromString(parsedState.sections[pageSection.section], 'text/html').querySelector('[data-cart-count]');
            if (count) this.querySelector('[data-cart-count]').textContent = count.textContent;
          }

          const lineItem =
            this.querySelector(`#CartItem-${line}`) || document.querySelector(`cart-drawer-items #CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper?.querySelector('.drawer__inner-empty')) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (cartDrawerWrapper?.querySelector('.cart-item')) {
            trapFocus(cartDrawerWrapper, cartDrawerWrapper.querySelector('.cart-item__name'));
          } else if (!cartDrawerWrapper) {
            const focusTarget = this.querySelector('.cart-item__name') || this.querySelector('.cart__warnings a');
            focusTarget?.focus();
          }
        });

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
        const viewName = this.tagName;
        return Promise.all([...document.querySelectorAll('cart-items, cart-drawer-items')]
          .filter(view => view.tagName !== viewName)
          .map(view => view.onCartUpdate()));
      })
      .catch((e) => {
        const input = this.querySelector(`#Quantity-${line}`) || this.querySelector(`#Drawer-quantity-${line}`);
        if (input) input.value = input.getAttribute('value');
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = this.closest('cart-drawer')?.querySelector('#CartDrawer-CartErrors') || document.getElementById('cart-errors');
        if (errors) errors.textContent = window.cartStrings.error;
        this.dispatchCartErrorEvent(window.cartStrings.error, 'SERVICE_UNAVAILABLE');
        linesUpdateDeferred?.reject(e);
      })
      .finally(() => {
        this.disableLoading(line);
        CartPerformance.measureFromMarker(`${eventTarget}:user-action`, cartPerformanceUpdateMarker);
      }));
  }

  createCartLinesUpdateEvent(action, variantId, quantity, lineKey) {
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent || !variantId) return null;
    // No AJAX line key on the row — likely cached HTML rendered before this
    // attribute landed. Skip dispatch rather than emit an event with id: ''.
    if (!lineKey) return null;

    const deferred = CartLinesUpdateEvent.createPromise();
    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action,
        context: 'cart',
        lines: [{ id: lineKey, quantity }],
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  resolveCartLinesUpdate(deferred, parsedState) {
    if (!deferred) return;
    const { CartLinesUpdateEvent } = window.StandardEvents || {};
    if (!CartLinesUpdateEvent) return;

    deferred.resolve({ cart: CartLinesUpdateEvent.createCartFromAjaxResponse(parsedState) });
  }

  dispatchCartErrorEvent(message, code) {
    const { CartErrorEvent } = window.StandardEvents || {};
    if (!CartErrorEvent) return;
    this.dispatchEvent(new CartErrorEvent({ error: message, code }));
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      this.querySelector(`#Line-item-error-${line}`) || this.querySelector(`#CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement?.setAttribute('aria-hidden', true);

    const cartStatus =
      this.querySelector('#cart-live-region-text') || this.querySelector('#CartDrawer-LiveRegionText');
    cartStatus?.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus?.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = this.querySelector('#main-cart-items') || this.querySelector('#CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement?.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = this.querySelector('#main-cart-items') || this.querySelector('#CartDrawer-CartItems');
    mainCartItems?.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener('input', () => {
          this.setAttribute('data-unsaved', '');
          this.status(this.dataset.dirty);
          CartItems.updateCheckoutState();
        });
        this.addEventListener('click', event => {
          if (event.target.closest('[data-save-note]')) this.save();
        });
      }

      status(message, error = false) {
        const status = this.querySelector('[data-note-status]');
        if (!status) return;
        status.textContent = message;
        status.toggleAttribute('data-error', error);
      }

      async save() {
        if (this.saving) return;
        this.saving = true;
        const textarea = this.querySelector('textarea');
        const newNote = textarea.value;
        const button = this.querySelector('[data-save-note]');
        button.disabled = true;
        const deferred = this.dispatchNoteUpdateEvent(newNote);
        try {
          await CartItems.mutate(async () => {
            const response = await fetch(routes.cart_update_url, { ...fetchConfig(), body: JSON.stringify({ note: newNote }) });
            const cart = await response.json();
            if (!response.ok || cart.errors || (cart.note || '') !== newNote) throw new Error(this.dataset.error);
            document.querySelectorAll('cart-note').forEach(note => {
              const input = note.querySelector('textarea');
              if (note !== this && note.hasAttribute('data-unsaved')) return;
              if (note === this && input.value !== newNote) return;
              input.value = newNote;
              note.removeAttribute('data-unsaved');
              note.status(note.dataset.saved);
            });
            const { CartNoteUpdateEvent } = window.StandardEvents || {};
            deferred?.resolve({ cart: CartNoteUpdateEvent.createCartFromAjaxResponse(cart) });
          });
        } catch (error) {
          this.status(this.dataset.error, true);
          deferred?.reject(error);
        } finally {
          this.saving = false;
          button.disabled = false;
          CartItems.updateCheckoutState();
        }
      }

      dispatchNoteUpdateEvent(newNote) {
        const { CartNoteUpdateEvent } = window.StandardEvents || {};
        if (!CartNoteUpdateEvent) return null;

        const context = this.closest('dialog') || this.closest('cart-drawer') ? 'dialog' : 'cart';
        const deferred = CartNoteUpdateEvent.createPromise();

        this.dispatchEvent(
          new CartNoteUpdateEvent({
            context,
            note: newNote,
            promise: deferred.promise,
          })
        );

        return deferred;
      }
    }
  );
}
