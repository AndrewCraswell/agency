window.Shopify = window.Shopify || {};
let privacySelection = { analytics: 'no', marketing: 'no', preferences: 'no' };
window.Shopify.customerPrivacy = {
  currentVisitorConsent: () => ({ ...privacySelection }),
  shouldShowBanner: () => false,
  setTrackingConsent(selection, callback) {
    setTimeout(() => {
      if (document.querySelector('#fail-consent').checked) { callback({ error: 'Simulated failure' }); return; }
      privacySelection = Object.fromEntries(Object.entries(selection).map(([key, value]) => [key, value ? 'yes' : 'no']));
      document.querySelector('#privacy-status').textContent = Object.entries(privacySelection).map(([key, value]) => `${key}: ${value}`).join(', ');
      callback({});
    }, 350);
  },
};
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#show-consent-banner').addEventListener('click', () => {
    privacySelection = { analytics: '', marketing: '', preferences: '' };
    const consent = document.querySelector('cookie-consent');
    consent.setError(false);
    consent.syncInputs();
    consent.showBanner();
    document.querySelector('#privacy-status').textContent = 'New visitor fixture';
    consent.querySelector('[data-action="consent-manage"]').focus();
  });
});