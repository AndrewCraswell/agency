if (!customElements.get('ui-drawer')) {
  class Drawer extends HTMLElement {
    static owners = new Set();
    static bodyStyles;

    connectedCallback() {
      if (this.initialized) return;
      this.dialog = this.querySelector(':scope > dialog');
      this.panel = this.dialog?.querySelector('[data-drawer-panel]');
      this.backdrop = this.dialog?.querySelector('[data-drawer-backdrop]');
      if (!this.panel || !this.backdrop) return;
      this.initialized = true;
      this.dataset.state = 'closed';
      this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.onClick = (event) => {
        if (event.target.closest('ui-drawer') !== this) return;
        const opener = event.target.closest('[data-drawer-open]');
        if (opener) {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (this.show(opener)) event.preventDefault();
        } else if (event.target.closest('[data-drawer-close]')) {
          event.preventDefault();
          this.hide();
        } else if (event.target === this.backdrop && this.pointerStartedOnBackdrop) {
          this.hide();
        }
        this.pointerStartedOnBackdrop = false;
      };
      this.onPointerDown = (event) => { this.pointerStartedOnBackdrop = event.target === this.backdrop; };
      this.onCancel = (event) => {
        event.preventDefault();
        this.hide();
      };
      this.onKeyDown = (event) => {
        if (event.key !== 'Escape' || event.target.closest('ui-drawer') !== this) return;
        event.preventDefault();
        event.stopPropagation();
        this.hide();
      };
      this.onClose = () => { if (!this.dialog.open) this.release(); };
      this.onMotionChange = () => {
        if (this.motion.matches && this.transition) this.finish(this.transition);
      };
      this.addEventListener('click', this.onClick);
      this.dialog.addEventListener('pointerdown', this.onPointerDown);
      this.dialog.addEventListener('keydown', this.onKeyDown);
      this.dialog.addEventListener('cancel', this.onCancel);
      this.dialog.addEventListener('close', this.onClose);
      this.motion.addEventListener('change', this.onMotionChange);
    }

    disconnectedCallback() {
      if (!this.initialized) return;
      this.cancelTransition();
      if (this.dialog.open) this.dialog.close();
      this.release();
      this.removeEventListener('click', this.onClick);
      this.dialog.removeEventListener('pointerdown', this.onPointerDown);
      this.dialog.removeEventListener('keydown', this.onKeyDown);
      this.dialog.removeEventListener('cancel', this.onCancel);
      this.dialog.removeEventListener('close', this.onClose);
      this.motion.removeEventListener('change', this.onMotionChange);
      this.initialized = false;
    }

    show(opener = document.activeElement) {
      if (!this.initialized || typeof this.dialog.showModal !== 'function' || !this.isConnected) return false;
      if (this.dialog.open && this.dataset.state !== 'closing') return true;
      const wasOpen = this.dialog.open;
      if (!wasOpen) {
        this.opener = opener;
        this.lockScroll();
        try {
          this.dialog.showModal();
        } catch {
          this.release();
          return false;
        }
      }
      this.querySelectorAll('[data-drawer-open]').forEach((trigger) => {
        if (trigger.closest('ui-drawer') === this) trigger.setAttribute('aria-expanded', 'true');
      });
      this.animateTo(true, wasOpen);
      this.panel.querySelector('[data-drawer-close]').focus({ preventScroll: true });
      return true;
    }

    hide() {
      if (!this.dialog?.open || this.dataset.state === 'closing') return;
      this.animateTo(false, true);
    }

    animateTo(open, wasOpen) {
      const panelStyle = getComputedStyle(this.panel);
      const backdropStyle = getComputedStyle(this.backdrop);
      const hiddenTransform = `translateX(${panelStyle.getPropertyValue('--drawer-direction').trim() === '-1' ? '-100%' : '100%'})`;
      const fromTransform = wasOpen ? panelStyle.transform : hiddenTransform;
      const fromOpacity = wasOpen ? backdropStyle.opacity : '0';
      this.cancelTransition();
      this.dataset.state = open ? 'opening' : 'closing';
      const transition = { open, animations: [] };
      this.transition = transition;
      const duration = parseFloat(panelStyle.getPropertyValue('--drawer-duration')) || 250;
      if (this.motion.matches || typeof this.panel.animate !== 'function') {
        this.finish(transition);
        return;
      }
      const options = { duration, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' };
      transition.animations = [
        this.panel.animate([{ transform: fromTransform }, { transform: open ? 'translateX(0)' : hiddenTransform }], options),
        this.backdrop.animate([{ opacity: fromOpacity }, { opacity: open ? '1' : '0' }], options),
      ];
      Promise.all(transition.animations.map((animation) => animation.finished)).then(
        () => this.finish(transition),
        () => { if (this.transition === transition) this.finish(transition); },
      );
    }

    finish(transition) {
      if (this.transition !== transition) return;
      this.cancelTransition();
      if (transition.open) {
        this.dataset.state = 'open';
        this.dispatchEvent(new CustomEvent('drawer:opened', { bubbles: true }));
      } else {
        this.dialog.close();
        this.release();
      }
    }

    cancelTransition() {
      const previous = this.transition;
      this.transition = undefined;
      previous?.animations.forEach((animation) => animation.cancel());
    }

    lockScroll() {
      if (!Drawer.owners.size) {
        Drawer.bodyStyles = ['overflow', 'padding-right'].map((name) => ({
          name, value: document.body.style.getPropertyValue(name), priority: document.body.style.getPropertyPriority(name),
        }));
        const scrollbar = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbar > 0) {
          const padding = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
          document.body.style.setProperty('padding-right', `${padding + scrollbar}px`);
        }
        document.body.style.setProperty('overflow', 'hidden');
      }
      Drawer.owners.add(this);
    }

    release() {
      if (!Drawer.owners.has(this)) return;
      const wasTop = [...Drawer.owners].at(-1) === this;
      this.cancelTransition();
      Drawer.owners.delete(this);
      if (!Drawer.owners.size) {
        Drawer.bodyStyles.forEach(({ name, value, priority }) => {
          if (value) document.body.style.setProperty(name, value, priority);
          else document.body.style.removeProperty(name);
        });
        Drawer.bodyStyles = undefined;
      }
      this.dataset.state = 'closed';
      this.querySelectorAll('[data-drawer-open]').forEach((trigger) => {
        if (trigger.closest('ui-drawer') === this) trigger.setAttribute('aria-expanded', 'false');
      });
      if (wasTop && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('drawer:closed', { bubbles: true }));
    }
  }

  customElements.define('ui-drawer', Drawer);
}