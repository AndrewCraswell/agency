class SizeChart extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.buttons = [...this.querySelectorAll('[data-size-option]')];
    this.keys = this.buttons.map((button) => button.dataset.sizeOption);
    this.hasImperial = this.dataset.hasImperial === 'true';
    this.onClick = (event) => {
      const button = event.target.closest('[data-size-option]');
      if (!button || !this.contains(button)) return;
      const key = button.dataset.sizeOption;
      if (this.selected.has(key)) this.selected.delete(key);
      else this.selected.add(key);
      this.render(true);
    };
    this.onChange = (event) => {
      if (!event.target.matches('[data-chart-unit]')) return;
      this.unit = this.hasImperial && event.target.value === 'in' ? 'in' : 'cm';
      this.render(true);
    };
    this.onPopState = () => this.readState();
    this.onBeforePrint = () => {
      const help = this.querySelector('[data-chart-help]');
      this.helpWasOpen = help?.open;
      if (help) help.open = true;
    };
    this.onAfterPrint = () => {
      const help = this.querySelector('[data-chart-help]');
      if (help) help.open = this.helpWasOpen ?? help.open;
    };
    this.addEventListener('click', this.onClick);
    this.addEventListener('change', this.onChange);
    if (this.dataset.updateUrl === 'true') window.addEventListener('popstate', this.onPopState);
    window.addEventListener('beforeprint', this.onBeforePrint);
    window.addEventListener('afterprint', this.onAfterPrint);
    this.querySelectorAll('[data-chart-controls]').forEach((controls) => controls.removeAttribute('hidden'));
    this.readState();
    this.classList.add('size-chart--enhanced');
    const help = this.querySelector('[data-chart-help]');
    if (help) help.open = window.matchMedia('(min-width: 1100px)').matches;
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('change', this.onChange);
    window.removeEventListener('popstate', this.onPopState);
    window.removeEventListener('beforeprint', this.onBeforePrint);
    window.removeEventListener('afterprint', this.onAfterPrint);
    this.initialized = false;
  }

  readState() {
    const url = new URL(window.location.href);
    const useUrl = this.dataset.updateUrl === 'true';
    const requested = useUrl ? url.searchParams.getAll('size') : [];
    const valid = requested.filter((key) => this.keys.includes(key));
    this.selected = new Set(this.keys.slice(0, 2));
    if (requested.length === 1 && requested[0] === '') this.selected.clear();
    else if (valid.length) this.selected = new Set(valid);
    const unit = useUrl ? url.searchParams.get('unit') ?? this.dataset.defaultUnit : this.dataset.defaultUnit;
    this.unit = this.hasImperial && unit === 'in' ? 'in' : 'cm';
    this.render(false);
  }

  render(updateUrl) {
    this.buttons.forEach((button) => button.setAttribute('aria-pressed', String(this.selected.has(button.dataset.sizeOption))));
    this.querySelectorAll('[data-size-column]').forEach((cell) => {
      cell.hidden = !this.selected.has(cell.dataset.sizeColumn);
    });
    this.querySelectorAll('[data-value-unit]').forEach((value) => {
      value.hidden = value.dataset.valueUnit !== this.unit;
    });
    this.querySelectorAll('[data-chart-unit]').forEach((radio) => { radio.checked = radio.value === this.unit; });
    const empty = this.selected.size === 0;
    this.querySelector('[data-chart-table-region]')?.toggleAttribute('hidden', empty);
    this.querySelector('[data-chart-empty]')?.toggleAttribute('hidden', !empty);
    const link = document.getElementById(this.dataset.fullChartLinkId);
    if (link) link.href = this.stateUrl(new URL(this.dataset.chartUrl, window.location.origin)).href;
    if (updateUrl && this.dataset.updateUrl === 'true') {
      window.history.replaceState(window.history.state, '', this.stateUrl(new URL(window.location.href)));
    }
  }

  stateUrl(url) {
    url.searchParams.set('unit', this.unit);
    url.searchParams.delete('size');
    const selected = this.keys.filter((key) => this.selected.has(key));
    if (!selected.length) url.searchParams.append('size', '');
    else selected.forEach((key) => url.searchParams.append('size', key));
    return url;
  }
}

class SizeChartNavigation extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.details = this.querySelector('[data-size-navigation]');
    this.desktop = window.matchMedia('(min-width: 1100px)');
    this.onBreakpoint = () => { if (this.details) this.details.open = this.desktop.matches; };
    this.desktop.addEventListener('change', this.onBreakpoint);
    this.onBreakpoint();
  }

  disconnectedCallback() {
    this.desktop?.removeEventListener('change', this.onBreakpoint);
    this.initialized = false;
  }
}

if (!customElements.get('size-chart')) customElements.define('size-chart', SizeChart);
if (!customElements.get('size-chart-navigation')) customElements.define('size-chart-navigation', SizeChartNavigation);
