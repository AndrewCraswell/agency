class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = this.closest('.header-wrapper');

    // Pointer users expect the panel on hover; click and keyboard still drive the
    // same <details>, and coarse pointers keep tap-to-open.
    this.hoverQuery = window.matchMedia('(min-width: 990px) and (hover: hover)');
    this.addEventListener('pointerenter', this.onPointerEnter);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.querySelector('summary').addEventListener('click', this.onSummaryClick);
    this.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
      this.querySelector('summary').focus();
    });
    this.addEventListener('keyup', event => {
      if (event.key === 'Escape') event.stopPropagation();
    }, true);

    if (!HeaderMenu.tracking) {
      HeaderMenu.tracking = true;
      document.addEventListener(
        'pointermove',
        (event) => {
          HeaderMenu.pointer = { x: event.clientX, y: event.clientY };
        },
        { passive: true }
      );
    }
  }

  onPointerEnter = (event) => {
    if (event.pointerType === 'touch' || !this.hoverQuery.matches) return;
    clearTimeout(this.closeTimer);
    this.open();
  };

  onPointerLeave = (event) => {
    if (event.pointerType === 'touch' || !this.hoverQuery.matches) return;
    this.scheduleClose();
  };

  // A fast diagonal move can skip straight over the boundary, so relatedTarget is not
  // dependable. Re-check where the pointer actually ended up before closing.
  scheduleClose() {
    clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      if (this.pointerIsNearby()) {
        this.scheduleClose();
        return;
      }
      this.close();
    }, 220);
  }

  pointerIsNearby() {
    const pointer = HeaderMenu.pointer;
    if (!pointer || !this.mainDetailsToggle.open) return false;

    const regions = [this.closest('.header__inline-menu'), this.querySelector('.mega-menu__content')];
    const slack = 12;

    return regions.some((region) => {
      if (!region) return false;
      const rect = region.getBoundingClientRect();
      return (
        pointer.x >= rect.left - slack &&
        pointer.x <= rect.right + slack &&
        pointer.y >= rect.top - slack &&
        pointer.y <= rect.bottom + slack
      );
    });
  }

  // Hover already opened it, so the click that follows would immediately close it.
  onSummaryClick = (event) => {
    event.preventDefault();
    if (this.mainDetailsToggle.open && !this.closingAnimation) {
      if (this.hoverQuery.matches && event.detail > 0) return;
      this.close();
    } else this.open();
  };

  open() {
    clearTimeout(this.closeTimer);
    if (this.closingAnimation) {
      this.closingAnimation.cancel();
      this.closingAnimation = null;
    }
    this.content.inert = false;
    this.content.removeAttribute('aria-hidden');
    this.mainDetailsToggle.removeAttribute('data-menu-exiting');
    this.querySelector('summary').setAttribute('aria-expanded', true);
    if (this.mainDetailsToggle.open) return;
    const siblings = [...document.querySelectorAll('header-menu details[open]')].filter(details => details !== this.mainDetailsToggle);
    this.mainDetailsToggle.toggleAttribute('data-menu-switch', siblings.length > 0);
    siblings.forEach((details) => {
      details.closest('header-menu').close(false, true);
    });
    this.mainDetailsToggle.setAttribute('open', '');
    this.querySelector('summary').setAttribute('aria-expanded', true);
  }

  close(immediate = false, switching = false) {
    clearTimeout(this.closeTimer);
    if (!this.mainDetailsToggle.open) return;
    this.mainDetailsToggle.setAttribute('data-menu-exiting', '');
    this.querySelector('summary').setAttribute('aria-expanded', false);
    this.content.inert = true;
    this.content.setAttribute('aria-hidden', 'true');
    const duration = getComputedStyle(this.content).getPropertyValue('--menu-exit-duration').trim();
    if (immediate || duration === '0ms' || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof this.content.animate !== 'function') {
      this.closingAnimation?.cancel();
      this.closingAnimation = null;
      super.close();
      return;
    }
    if (this.closingAnimation) return;
    const animation = this.content.animate([
      { opacity: getComputedStyle(this.content).opacity, transform: getComputedStyle(this.content).transform },
      { opacity: 0, transform: switching ? 'translateY(0)' : 'translateY(-8px)' },
    ], { duration: switching ? 140 : 160, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'both' });
    this.closingAnimation = animation;
    animation.finished.then(() => {
      if (this.closingAnimation !== animation) return;
      super.close();
      animation.cancel();
      this.closingAnimation = null;
    }, () => {});
  }

  onToggle() {
    this.querySelector('summary').setAttribute('aria-expanded', String(this.mainDetailsToggle.open && !this.mainDetailsToggle.hasAttribute('data-menu-exiting')));
    if (!this.header) return;
    this.header.preventHide = !!this.header.querySelector('header-menu details[open]:not([data-menu-exiting])');

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
