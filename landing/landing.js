/* BizYour classic landing — standalone behaviour, lifted from the classic
   app's app.js landing section (applyLandingLang / maybeIntro / CTA wiring).
   Differences from the classic: there is no in-page auth view any more —
   Login goes to the React app's /login and Free Trial to its /signup, and
   a visitor who already has a session (localStorage 'bos_token', shared
   with the React app) is sent straight into the app, exactly like the
   classic boot() did. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var LANGS = ['en', 'hi', 'hg'];
  function normLang(l) { return LANGS.indexOf(l) >= 0 ? l : 'en'; }

  // Already signed in -> straight into the app (never the landing/intro).
  try {
    if (localStorage.getItem('bos_token')) { location.replace('/login'); return; }
  } catch (e) { /* storage off: just show the landing */ }

  // The landing has its own 3-language copy (data-lp-en/hi/hg on every text
  // leaf). The choice is saved in localStorage 'bos_lang' — the same key
  // the React app reads, so the app opens in the language picked here.
  // Default on a first visit is English (founder's call, 22 Nov 2026).
  function landingDefaultLang() {
    try { var s = localStorage.getItem('bos_lang'); return s ? normLang(s) : 'en'; } catch (e) { return 'en'; }
  }
  function applyLandingLang(lang) {
    lang = normLang(lang);
    try { localStorage.setItem('bos_lang', lang); } catch (e) {}
    document.querySelectorAll('[data-lp-en]').forEach(function (el) {
      var v = lang === 'hi' ? el.dataset.lpHi : lang === 'hg' ? el.dataset.lpHg : el.dataset.lpEn;
      if (v !== undefined) el.textContent = v;
    });
    [['lpLangEn', 'en'], ['lpLangHi', 'hi'], ['lpLangHg', 'hg']].forEach(function (pair) {
      var b = $(pair[0]); if (b) b.classList.toggle('on', pair[1] === lang);
    });
  }

  // Logo intro: plays on EVERY landing load/refresh (founder's call,
  // 22 Nov 2026) — click or Esc skips it.
  function maybeIntro() {
    var ov = $('bzIntro');
    if (!ov) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    ov.classList.remove('hidden');
    document.body.classList.add('bz-intro-on');
    var done = false;
    function fin() {
      if (done) return; done = true;
      ov.classList.add('wipe');
      setTimeout(function () {
        ov.classList.add('hidden'); ov.classList.remove('wipe');
        document.body.classList.remove('bz-intro-on');
      }, 720);
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') fin(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', fin);
    setTimeout(fin, 2900);
  }

  // CTAs -> the React app's auth routes.
  ['lpLoginBtn', 'lpLoginBtn2', 'lpFootLogin'].forEach(function (id) {
    var b = $(id); if (b) b.addEventListener('click', function () { location.href = '/login'; });
  });
  ['lpTrialBtn', 'lpTrialBtn2', 'lpTrialBtn3', 'lpFootSignup', 'lpFootTrial'].forEach(function (id) {
    var b = $(id); if (b) b.addEventListener('click', function () { location.href = '/signup'; });
  });
  [['lpLangEn', 'en'], ['lpLangHi', 'hi'], ['lpLangHg', 'hg']].forEach(function (pair) {
    var b = $(pair[0]); if (b) b.addEventListener('click', function () { applyLandingLang(pair[1]); });
  });

  applyLandingLang(landingDefaultLang());
  maybeIntro();
})();
