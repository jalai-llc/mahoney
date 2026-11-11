// Shared behaviour: email sign-up and the clip players.
(function () {
  var cfg = window.SITE_CONFIG || {};

  // ---- email sign-up
  var signup = cfg.emailSignup || {};
  document.querySelectorAll('form[data-signup]').forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var msg = document.getElementById(form.getAttribute('data-msg'));

    if (signup.action) {
      // Hand the submission to the email provider; it shows its own confirmation.
      form.action = signup.action;
      form.method = 'post';
      if (input && signup.fieldName) input.name = signup.fieldName;
      var extra = signup.extraFields || {};
      Object.keys(extra).forEach(function (name) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = name;
        hidden.value = extra[name];
        form.appendChild(hidden);
      });
      return;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (msg) msg.textContent = "Sign-up isn't connected yet. Check back soon.";
      if (window.console) console.warn('Email sign-up: set SITE_CONFIG.emailSignup.action in js/config.js');
    });
  });

  // "Get the chapter" in the nav jumps to the form and focuses the field.
  document.querySelectorAll('[data-focus-signup]').forEach(function (a) {
    a.addEventListener('click', function () {
      var field = document.getElementById('signup-email');
      if (field) setTimeout(function () { field.focus({ preventScroll: true }); }, 350);
    });
  });

  // ---- clips: poster + play button; clicking swaps in the YouTube player.
  // The video files live on YouTube, not on this site. A card with no YouTube
  // link in config.js is hidden; with none at all, the Clips section is too.
  var links = cfg.youtube || {};
  var current = null;   // the card whose player is open

  function youtubeId(value) {
    var v = String(value || '').trim();
    var m = v.match(/(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
  }

  function closePlayer(clip) {
    var frame = clip.querySelector('iframe');
    if (frame) frame.remove();
    clip.classList.remove('playing');
  }

  var shown = 0;
  document.querySelectorAll('.clip[data-clip]').forEach(function (clip) {
    var id = youtubeId(links[clip.getAttribute('data-clip')]);
    var btn = clip.querySelector('.clip-play');
    if (!id || !btn) { clip.hidden = true; return; }
    shown++;
    btn.addEventListener('click', function () {
      if (current && current !== clip) closePlayer(current);   // one clip at a time
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0';
      frame.title = clip.querySelector('.clip-title').textContent;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube refuses embeds without a referrer
      clip.querySelector('.clip-media').appendChild(frame);
      clip.classList.add('playing');
      current = clip;
      frame.focus();
    });
  });

  if (!shown) {
    var section = document.getElementById('clips');
    if (section) section.hidden = true;
    document.querySelectorAll('[data-clips-link]').forEach(function (a) { a.hidden = true; });
  }
})();
