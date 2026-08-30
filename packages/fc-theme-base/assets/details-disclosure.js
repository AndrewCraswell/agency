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
    this.header = document.querySelector('.header-wrapper');

    // Pointer users expect the panel on hover; click and keyboard still drive the
    // same <details>, and coarse pointers keep tap-to-open.
    this.hoverQuery = window.matchMedia('(min-width: 990px) and (hover: hover)');
    this.addEventListener('pointerenter', this.onPointerEnter);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.querySelector('summary').addEventListener('click', this.onSummaryClick);

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
    if (!this.hoverQuery.matches || !this.mainDetailsToggle.open) return;
    event.preventDefault();
  };

  open() {
    if (this.mainDetailsToggle.open) return;
    document.querySelectorAll('header-menu details[open]').forEach((details) => {
      if (details !== this.mainDetailsToggle) details.removeAttribute('open');
    });
    this.mainDetailsToggle.setAttribute('open', '');
    this.querySelector('summary').setAttribute('aria-expanded', true);
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
