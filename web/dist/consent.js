/* BizYour — storage consent banner + optional analytics.
 *
 * CONFIG: to switch analytics on, paste a Google Analytics 4 Measurement ID
 * (it looks like "G-XXXXXXXXXX") between the quotes on the next line.
 * While it is empty, NO analytics loads for anyone, ever — the banner then
 * only records that the visitor saw the storage notice.
 *
 * How it works:
 * - BizYour itself needs only essential browser storage (sign-in, language,
 *   offline use). That storage is always on; it is not tracking.
 * - Analytics is OFF unless the visitor taps "Allow analytics" AND an ID is
 *   configured above. The choice is remembered in localStorage
 *   ("bizyour_consent_v1") and can be changed by clearing site data.
 */
var BIZYOUR_GA_ID = '';

(function () {
  'use strict';
  var KEY = 'bizyour_consent_v1';

  function readChoice() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.choice ? parsed.choice : null;
    } catch (e) { return null; }
  }

  function saveChoice(choice) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ choice: choice, at: new Date().toISOString() }));
    } catch (e) { /* storage unavailable — banner will simply show again */ }
  }

  function loadAnalytics() {
    if (!BIZYOUR_GA_ID) return;
    if (window.__bizyourGaLoaded) return;
    window.__bizyourGaLoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(BIZYOUR_GA_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', BIZYOUR_GA_ID, { anonymize_ip: true });
  }

  function showBanner() {
    if (document.getElementById('bizyour-consent')) return;
    var bar = document.createElement('div');
    bar.id = 'bizyour-consent';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Storage and analytics notice');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
      'max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #E3E8F2;border-radius:14px;' +
      'box-shadow:0 10px 34px rgba(27,35,64,.18);padding:14px 16px;color:#1B2340;' +
      'font-family:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;';
    var text = document.createElement('p');
    text.style.cssText = 'margin:0 0 10px;font-size:13.5px;line-height:1.55;';
    text.textContent = BIZYOUR_GA_ID
      ? 'BizYour uses only the browser storage the app needs to work — sign-in, language and offline use. No advertising trackers. With your permission, anonymous usage analytics helps us improve BizYour.'
      : 'BizYour uses only the browser storage the app needs to work — sign-in, language and offline use. We do not use advertising or tracking cookies. See our Privacy Policy for details.';
    bar.appendChild(text);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    function button(label, primary) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'cursor:pointer;border-radius:10px;padding:8px 14px;font-size:13.5px;font-weight:600;' +
        (primary
          ? 'background:#2B3A8F;color:#fff;border:1px solid #2B3A8F;'
          : 'background:#fff;color:#2B3A8F;border:1px solid #C9D2E8;');
      return b;
    }
    var link = document.createElement('a');
    link.href = '/privacy';
    link.textContent = 'Privacy Policy';
    link.style.cssText = 'font-size:13px;color:#2B3A8F;margin-left:2px;';

    if (BIZYOUR_GA_ID) {
      var allow = button('Allow analytics', true);
      allow.addEventListener('click', function () { saveChoice('analytics'); loadAnalytics(); bar.remove(); });
      var essential = button('Essential only', false);
      essential.addEventListener('click', function () { saveChoice('essential'); bar.remove(); });
      row.appendChild(allow);
      row.appendChild(essential);
    } else {
      var ok = button('Got it', true);
      ok.addEventListener('click', function () { saveChoice('essential'); bar.remove(); });
      row.appendChild(ok);
    }
    row.appendChild(link);
    bar.appendChild(row);

    function attach() { document.body.appendChild(bar); }
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach);
  }

  var choice = readChoice();
  if (choice === 'analytics') { loadAnalytics(); return; }
  if (choice === 'essential') return;
  showBanner();
})();
