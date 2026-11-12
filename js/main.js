// Shared behaviour: email sign-up, the top bar's waitlist field, and the clip players.
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
      var source = form.getAttribute('data-source');   // which form it came from, e.g. the top bar
      Object.keys(extra).forEach(function (name) {
        var hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = name;
        hidden.value = (name === 'fields[source]' && source) ? source : extra[name];
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

  // ---- the top bar's "Join the waitlist".
  // While the waitlist section's form is on screen, the button just puts the cursor in it.
  // Whenever that form is off screen (above or below), the bar gets .form-away: wide screens
  // then show the bar's own email field (css/styles.css), and on narrow ones the button opens
  // that field under the bar.
  var bar = document.querySelector('.site-nav');
  var toggle = document.querySelector('[data-waitlist-toggle]');
  var barField = document.getElementById('bar-signup-email');
  var mainForm = document.querySelector('#waitlist form[data-signup]');
  var mainField = document.getElementById('signup-email');

  var toggleLabel = toggle ? toggle.textContent : '';
  function setOpen(open) {
    if (!bar || !toggle) return;
    bar.classList.toggle('signup-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : toggleLabel;   // the strip below has its own "Join" button
  }

  if (bar && toggle && mainForm && mainField) {
    if ('IntersectionObserver' in window) {
      // The top 90px are under the bar, so a form hidden there counts as off screen.
      new IntersectionObserver(function (entries) {
        var away = !entries[entries.length - 1].isIntersecting;
        bar.classList.toggle('form-away', away);
        if (!away) setOpen(false);
      }, { rootMargin: '-90px 0px 0px 0px' }).observe(mainForm);
    }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      if (!bar.classList.contains('form-away')) {
        mainField.focus();   // scrolls to it if it's partly off screen
        return;
      }
      var open = !bar.classList.contains('signup-open');
      setOpen(open);
      if (open && barField) barField.focus();
    });

    // Close the strip with Escape, or when a section link is used.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && bar.classList.contains('signup-open')) { setOpen(false); toggle.focus(); }
    });
    bar.querySelectorAll('.site-nav-links a, .site-nav-brand').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
  }

  // ---- clips: poster + play button; clicking swaps in a player.
  // A clip with a YouTube link in config.js plays from YouTube. Otherwise it plays
  // the file from this site (clipFolder/<name>.mp4). With clipFolder set to "",
  // clips without a YouTube link are hidden, and with none, so is the section.
  var links = cfg.youtube || {};
  var folder = cfg.clipFolder || '';
  var current = null;   // the card whose player is open

  function youtubeId(value) {
    var v = String(value || '').trim();
    var m = v.match(/(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : '';
  }

  function closePlayer(clip) {
    var player = clip.querySelector('iframe, video');
    if (player) player.remove();
    clip.classList.remove('playing');
  }

  function youtubePlayer(id, title) {
    var frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0';
    frame.title = title;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube refuses embeds without a referrer
    return frame;
  }

  function filePlayer(src, title, clip) {
    var video = document.createElement('video');
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('aria-label', title);
    video.addEventListener('ended', function () {
      closePlayer(clip);
      if (current === clip) current = null;
      clip.querySelector('.clip-play').focus();
    });
    return video;
  }

  var shown = 0;
  document.querySelectorAll('.clip[data-clip]').forEach(function (clip) {
    var name = clip.getAttribute('data-clip');
    var id = youtubeId(links[name]);
    var btn = clip.querySelector('.clip-play');
    if (!btn || (!id && !folder)) { clip.hidden = true; return; }
    shown++;
    btn.addEventListener('click', function () {
      if (current && current !== clip) closePlayer(current);   // one clip at a time
      var title = clip.querySelector('.clip-title').textContent;
      var player = id ? youtubePlayer(id, title) : filePlayer(folder + name + '.mp4', title, clip);
      clip.querySelector('.clip-media').appendChild(player);
      clip.classList.add('playing');
      current = clip;
      if (player.play) {   // a file: start it inside the click, so sound is allowed
        var started = player.play();
        if (started && started.catch) started.catch(function () {});
      }
      player.focus();
    });
  });

  if (!shown) {
    var section = document.getElementById('clips');
    if (section) section.hidden = true;
    document.querySelectorAll('[data-clips-link]').forEach(function (a) { a.hidden = true; });
  }

  // ---- carousel arrows: scroll one screenful of cards; each arrow fades out at its end.
  // Without JS the row still scrolls by swipe or trackpad; the arrows stay hidden.
  document.querySelectorAll('.clip-carousel').forEach(function (box) {
    var track = box.querySelector('.clip-track');
    var prev = box.querySelector('.carousel-prev');
    var next = box.querySelector('.carousel-next');
    if (!track || !prev || !next) return;

    function pageWidth() {
      var card = track.querySelector('.clip:not([hidden])');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      var step = card.getBoundingClientRect().width + gap;
      return Math.max(1, Math.floor((track.clientWidth + gap) / step)) * step;
    }
    function update() {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    }
    [prev, next].forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        track.scrollBy({ left: Number(btn.getAttribute('data-scroll')) * pageWidth() });
      });
    });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
