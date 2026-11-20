// Shared behaviour: email sign-up, the top bar's waitlist field, "Dive deeper", and the clip players.
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
  // The button puts the cursor in the form's first box (first name, then email).
  var mainField = document.getElementById('signup-name') || document.getElementById('signup-email');

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

  // ---- "Dive deeper": the hero's button opens Terry's full description just below it (if it
  // isn't open already) and glides down to it. Open or closed is .story-open on <html>; the
  // <head> script sets the starting state (closed, or open for a link straight to #story).
  // "Rise to the surface" at the end of the story carries the reader on: it glides down to the
  // waitlist, then folds the story away above, out of sight, keeping the waitlist exactly where it
  // is on screen.
  var page = document.documentElement;
  var story = document.getElementById('story');
  var dive = document.querySelector('.dive-deeper');
  var rise = document.querySelector('.rise');
  var waitlist = document.getElementById('waitlist');
  if (story && dive) {
    var setStory = function (open) {
      page.classList.toggle('story-open', open);
      dive.setAttribute('aria-expanded', String(open));
    };
    // Calls back once a smooth scroll has finished (it can't be awaited everywhere): the page has
    // moved and then held still, or never moved at all (already there), or 2.5s have passed.
    var afterScroll = function (done) {
      var startY = window.scrollY, lastY = startY, still = 0, start = performance.now();
      (function check(now) {
        var y = window.scrollY;
        still = y === lastY ? still + 1 : 0;
        lastY = y;
        var moved = y !== startY;
        if ((moved && still >= 6) || (!moved && now - start > 500) || now - start > 2500) done();
        else requestAnimationFrame(check);
      })(start);
    };
    setStory(page.classList.contains('story-open'));
    dive.addEventListener('click', function () {
      setStory(true);
      story.scrollIntoView({ block: 'start' });   // smooth via css, unless reduced motion
    });
    if (rise && waitlist) rise.addEventListener('click', function () {
      waitlist.scrollIntoView({ block: 'start' });   // smooth via css
      afterScroll(function () {
        // Fold the story away above, then put the waitlist back where it was on screen (some
        // browsers do that themselves; this measures, so it never shifts twice).
        var before = waitlist.getBoundingClientRect().top;
        page.classList.add('story-quiet');
        setStory(false);
        window.scrollBy({ top: waitlist.getBoundingClientRect().top - before, behavior: 'instant' });
        var heading = document.getElementById('waitlist-title');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
        setTimeout(function () { page.classList.remove('story-quiet'); }, 1000);
      });
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

  // ---- "From early readers": a carousel that moves on its own (css "The carousel").
  // Each dot's fill is the timer: when it finishes, the next quote comes in. Longer quotes get
  // longer fills. Swipe sideways on phones. Without JS the quotes simply stack.
  document.querySelectorAll('[data-reader-carousel]').forEach(function (box) {
    var slides = [].slice.call(box.querySelectorAll('.reader-quote'));
    var track = box.querySelector('.reader-track');
    if (slides.length < 2 || !track) return;
    var PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5H5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>';
    var PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 1.5 10.5 6l-7.3 4.5z" fill="currentColor"/></svg>';
    var current = -1;

    box.setAttribute('role', 'region');
    box.setAttribute('aria-roledescription', 'carousel');
    box.setAttribute('aria-label', 'Quotes from early readers');
    var controls = document.createElement('div');
    controls.className = 'reader-controls';
    var dotRow = document.createElement('div');
    dotRow.className = 'reader-dots';
    var btnRow = document.createElement('div');
    btnRow.className = 'reader-buttons';
    function button(cls, label, icon, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'reader-btn ' + cls;
      if (label) b.setAttribute('aria-label', label);
      if (icon) b.innerHTML = icon;
      b.addEventListener('click', onClick);
      btnRow.appendChild(b);
      return b;
    }
    var dots = slides.map(function (slide, i) {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      var words = slide.textContent.trim().split(/\s+/).length;
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'reader-dot';
      dot.setAttribute('aria-label', 'Show quote ' + (i + 1));
      dot.style.setProperty('--read', Math.min(20000, Math.max(6000, 2500 + words * 230)) + 'ms');
      dot.innerHTML = '<span class="reader-dot-fill"></span>';
      dot.firstChild.addEventListener('animationend', function () { show(i + 1); });
      dot.addEventListener('click', function () { show(i); });
      dotRow.appendChild(dot);
      return dot;
    });
    // ‹ pause/play ›
    button('reader-prev', 'Previous quote', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      function () { show(current - 1); });
    var pause = button('reader-pause', '', '', function () { setPaused(!box.classList.contains('is-paused')); });
    button('reader-next', 'Next quote', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      function () { show(current + 1); });
    controls.appendChild(dotRow);
    controls.appendChild(btnRow);
    box.appendChild(controls);

    function setPaused(on) {
      box.classList.toggle('is-paused', on);
      pause.innerHTML = on ? PLAY : PAUSE;
      pause.setAttribute('aria-label', on ? 'Play the quotes' : 'Pause the quotes');
      track.setAttribute('aria-live', on ? 'polite' : 'off');   // announce changes only when they're asked for
    }
    function show(n) {
      n = (n + slides.length) % slides.length;
      if (n === current) return;
      var next = slides[n];
      // start it from the right every time (with two quotes, it may have just left to the left)
      next.classList.remove('is-leaving');
      next.style.transition = 'none';
      void next.offsetWidth;
      if (current >= 0) next.style.transition = '';
      slides.forEach(function (s, i) {
        s.classList.toggle('is-leaving', i === current);
        s.classList.toggle('is-active', i === n);
      });
      dots.forEach(function (d, i) {
        if (i === n) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (current < 0) { void next.offsetWidth; next.style.transition = ''; }   // the first one just appears
      current = n;
    }

    // hold still while a mouse is over it or the keyboard is in it, and while it's off screen
    box.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') box.classList.add('is-held'); });
    box.addEventListener('pointerleave', function () { box.classList.remove('is-held'); });
    box.addEventListener('focusin', function (e) { if (e.target.matches(':focus-visible')) box.classList.add('is-held'); });
    box.addEventListener('focusout', function (e) { if (!box.contains(e.relatedTarget)) box.classList.remove('is-held'); });
    if ('IntersectionObserver' in window) {
      box.classList.add('is-away');
      new IntersectionObserver(function (entries) {
        box.classList.toggle('is-away', !entries[0].isIntersecting);
      }, { threshold: 0.35 }).observe(box);
    }
    // swipe sideways on touch screens
    var startX = null;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') startX = e.clientX; });
    track.addEventListener('pointercancel', function () { startX = null; });
    track.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    });

    box.classList.add('is-live');
    setPaused(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    show(0);
  });
})();
