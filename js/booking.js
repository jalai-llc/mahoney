// "Invite Terry": tabs that swap between Cal.com calendars, embedded inline.
// The calendar loads only when the section scrolls near view (or a tab is clicked),
// and each tab's calendar loads the first time it's opened. Every panel also has a
// plain cal.com link, so booking still works if the embed is blocked.
(function () {
  var cfg = window.SITE_CONFIG || {};
  var user = String(cfg.calUsername || '').trim()
    .replace(/^https?:\/\/(app\.)?cal\.com\//, '').replace(/\/+$/, '');
  var events = cfg.calEvents || {};
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  if (!tabs.length) return;
  var keys = tabs.map(function (t) { return t.getAttribute('data-key'); });
  var current = keys[0];
  var mounted = {};
  var calLoaded = false;
  var inView = false;

  function calLink(key) { return user + '/' + (events[key] || key); }

  // Plain links (fallback + "open in a new tab")
  document.querySelectorAll('[data-cal-url]').forEach(function (a) {
    if (user) a.href = 'https://cal.com/' + calLink(a.getAttribute('data-cal-url'));
    else a.closest('.cal-fallback').hidden = true;
  });

  // Contact email
  var contact = document.querySelector('[data-contact]');
  if (contact && cfg.contactEmail) {
    var link = contact.querySelector('a');
    link.href = 'mailto:' + cfg.contactEmail;
    link.textContent = cfg.contactEmail;
    contact.hidden = false;
  }

  // Cal.com's standard embed loader (from their embed snippet).
  function loadCal() {
    if (calLoaded) return;
    calLoaded = true;
    (function (C, A, L) { var p = function (a, ar) { a.q.push(ar); }; var d = C.document; C.Cal = C.Cal || function () { var cal = C.Cal; var ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement('script')).src = A; cal.loaded = true; } if (ar[0] === L) { var api = function () { p(api, arguments); }; var namespace = ar[1]; api.q = api.q || []; if (typeof namespace === 'string') { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ['initNamespace', namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, 'https://app.cal.com/embed/embed.js', 'init');
  }

  function mount(key) {
    if (!user || !inView || mounted[key]) return;
    var el = document.getElementById('cal-' + key);
    if (!el) return;
    mounted[key] = true;
    loadCal();
    el.innerHTML = '';
    window.Cal('init', key, { origin: 'https://cal.com' });
    window.Cal.ns[key]('inline', {
      elementOrSelector: '#cal-' + key,
      calLink: calLink(key),
      config: { layout: 'month_view', theme: 'light' }
    });
    window.Cal.ns[key]('ui', {
      theme: 'light',
      layout: 'month_view',
      hideEventTypeDetails: false,
      cssVarsPerTheme: { light: { 'cal-brand': '#0e1f3b' } }
    });
  }

  function select(key, opts) {
    if (keys.indexOf(key) === -1) return;
    current = key;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-key') === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && opts && opts.focus) t.focus();
    });
    if (opts && opts.user) inView = true;
    mount(key);
    if (opts && opts.updateHash && location.hash !== '#' + key) {
      history.replaceState(null, '', '#' + key);
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t.getAttribute('data-key'), { updateHash: true, user: true }); });
    t.addEventListener('keydown', function (e) {
      var dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') dir = -i; else if (e.key === 'End') dir = tabs.length - 1 - i;
      if (!dir) return;
      e.preventDefault();
      select(keys[(i + dir + keys.length) % keys.length], { focus: true, updateHash: true, user: true });
    });
  });

  // Load the calendar when the section is about to scroll into view.
  var section = document.getElementById('book');
  if (section && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        inView = true; mount(current); io.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(section);
  } else {
    inView = true;
  }

  // Links like #speaking open that tab (and its calendar).
  window.addEventListener('hashchange', function () { select(location.hash.slice(1), { user: true }); });
  var initial = location.hash.slice(1);
  if (keys.indexOf(initial) !== -1) select(initial, { user: true }); else select(current);
})();
