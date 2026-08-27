/**
 * Drives both homepage carousels.
 *
 * The hero cross-fades one full-bleed slide at a time. The testimonial rail translates a
 * track of cards; the number of visible cards comes from layout, so the page count adapts
 * across breakpoints. Transforms are used rather than scrolling because mandatory scroll
 * snapping cancels in-flight programmatic smooth scrolls.
 */
class FcCarousel extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-carousel-track]');
    this.slides = Array.from(this.querySelectorAll('[data-carousel-slide]'));
    this.dots = Array.from(this.querySelectorAll('[data-carousel-dot]'));
    if (!this.track || this.slides.length === 0) return;

    this.isFade = this.classList.contains('fc-home__hero');
    this.index = 0;
    this.autoplayDelay = Number(this.dataset.autoplay) || 0;

    this.querySelector('[data-carousel-prev]')?.addEventListener('click', () => this.step(-1));
    this.querySelector('[data-carousel-next]')?.addEventListener('click', () => this.step(1));
    this.dots.forEach((dot, i) => dot.addEventListener('click', () => this.goTo(i)));

    this.addEventListener('keydown', this.onKeydown);

    if (!this.isFade) {
      this.resizeObserver = new ResizeObserver(() => this.render());
      this.resizeObserver.observe(this);
    }

    if (this.autoplayDelay > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.addEventListener('mouseenter', this.pause);
      this.addEventListener('mouseleave', this.play);
      this.addEventListener('focusin', this.pause);
      this.addEventListener('focusout', this.play);
      this.play();
    }

    this.render();
  }

  disconnectedCallback() {
    this.pause();
    this.resizeObserver?.disconnect();
  }

  onKeydown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.step(1);
    }
  };

  // Keep the dots honest when the rail is dragged or flicked directly.
  gap() {
    return parseFloat(getComputedStyle(this.track).columnGap) || 0;
  }

  slideStride() {
    return this.slides[0].getBoundingClientRect().width + this.gap();
  }

  viewportWidth() {
    return (this.track.parentElement || this).clientWidth;
  }

  slidesPerPage() {
    if (this.isFade) return 1;
    const stride = this.slideStride();
    if (!stride) return 1;
    return Math.max(1, Math.round((this.viewportWidth() + this.gap()) / stride));
  }

  pageCount() {
    return Math.max(1, Math.ceil(this.slides.length / this.slidesPerPage()));
  }

  step(direction) {
    this.goTo(this.index + direction);
  }

  goTo(index) {
    const pages = this.pageCount();
    this.index = ((index % pages) + pages) % pages;
    this.render();
    this.restart();
  }

  render() {
    const pages = this.pageCount();
    if (this.index >= pages) this.index = pages - 1;

    if (this.isFade) {
      this.slides.forEach((slide, i) => {
        const active = i === this.index;
        slide.classList.toggle('is-active', active);
        slide.toggleAttribute('aria-hidden', !active);
      });
    } else {
      const stride = this.slideStride();
      const content = this.slides.length * stride - this.gap();
      const maxOffset = Math.max(0, content - this.viewportWidth());
      const offset = Math.min(this.index * this.slidesPerPage() * stride, maxOffset);
      this.track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    }

    this.syncDots();
  }

  syncDots() {
    const pages = this.pageCount();
    const activeClass = this.isFade ? 'fc-home__dot--active' : 'fc-home__qdot--active';
    this.dots.forEach((dot, i) => {
      const active = i === this.index;
      dot.classList.toggle(activeClass, active);
      dot.setAttribute('aria-selected', String(active));
      dot.hidden = i >= pages;
    });
  }

  play = () => {
    if (this.autoplayDelay <= 0) return;
    this.pause();
    this.timer = setInterval(() => this.step(1), this.autoplayDelay);
  };

  pause = () => {
    clearInterval(this.timer);
    this.timer = null;
  };

  restart() {
    if (this.timer) this.play();
  }
}

customElements.define('fc-carousel', FcCarousel);
