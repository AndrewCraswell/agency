const body = document.body;
const action = document.querySelector('[data-action="simulate-save"]');
const status = document.querySelector('#command-status');
let pending;
document.querySelector('#reduce-motion').addEventListener('change', event => {
  body.toggleAttribute('data-reduced-motion', event.target.checked);
  const drawer = document.querySelector('ui-drawer');
  if (event.target.checked && drawer?.transition) drawer.finish(drawer.transition);
});
document.querySelector('#disable-command').addEventListener('change', event => { action.disabled = event.target.checked || action.getAttribute('aria-busy') === 'true'; });
action.addEventListener('click', () => {
  clearTimeout(pending);
  action.disabled = true;
  action.setAttribute('aria-busy', 'true');
  status.textContent = 'Saving';
  pending = setTimeout(() => {
    action.removeAttribute('aria-busy');
    action.disabled = document.querySelector('#disable-command').checked;
    status.textContent = document.querySelector('#fail-command').checked ? 'Unable to save. Try again.' : 'Saved';
  }, 800);
});
document.querySelectorAll('[data-action="select-example"]').forEach(button => button.addEventListener('click', () => {
  status.textContent = `${button.getAttribute('aria-label') || button.textContent.trim()} activated`;
}));
document.querySelectorAll('.ui-button--icon').forEach(button => { button.title = button.getAttribute('aria-label'); });
document.querySelector('#selection').addEventListener('change', event => {
  if (event.target.type === 'radio') document.querySelector('#selection-status').textContent = event.target.classList.contains('disabled') ? `Size ${event.target.value} unavailable` : `Size ${event.target.value} selected`;
});
document.querySelectorAll('#selection .ui-pill[href]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  document.querySelectorAll('#selection .ui-pill').forEach(pill => { pill.classList.remove('ui-pill--active'); pill.removeAttribute('aria-current'); });
  link.classList.add('ui-pill--active'); link.setAttribute('aria-current','page');
}));
document.querySelector('#menu').addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  document.querySelector('#menu-status').textContent = `${link.textContent.trim().replace(/\s+/g,' ')} selected`;
});
document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
document.querySelectorAll('#cards, #sections, #privacy').forEach(section => section.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link) return;
  event.preventDefault();
  document.querySelector('#card-status').textContent = `${link.getAttribute('aria-label') || link.textContent.trim().replace(/\s+/g,' ')} selected`;
}));
document.querySelector('#reset-lab').addEventListener('click', () => location.reload());