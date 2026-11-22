// Business OS — frontend config (split deploy).
//
// Same-origin / local / single-service deploy: leave BOS_API_BASE empty —
// the app calls its own origin, exactly as before.
//
// Split deploy (frontend on Vercel, backend on Render): set this to the
// backend's full URL, e.g.
//   window.BOS_API_BASE = 'https://api.example.com';
// A trailing slash is fine — the app strips it. After changing this file,
// redeploy the frontend (it is a static file, no build step).
// v4: the classic app is also served by the backend itself at /classic/
// (same origin). In that case — and on localhost / a shop LAN — call the
// same origin; only a separately hosted copy (e.g. Vercel) uses the remote.
(function () {
  var REMOTE = 'https://bizyour-i08s.onrender.com/';
  var h = location.hostname;
  var sameOrigin = location.origin === REMOTE.replace(/\/$/, '') ||
    /^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) ||
    /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  window.BOS_API_BASE = sameOrigin ? '' : REMOTE;
})();
