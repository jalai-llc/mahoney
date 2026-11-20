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

  // ---- "From early readers": a ribbon of quote cards (css "Early readers").
  // Still and centered while every card fits on screen. Once they don't, the set is copied to
  // fill the screen and the row drifts left in an endless loop; drag or swipe to move it by
  // hand, the arrows move it one card. Without JS the cards sit in a row you can scroll.
  document.querySelectorAll('[data-reader-ribbon]').forEach(function (box) {
    var track = box.querySelector('.reader-track');
    var cards = track ? [].slice.call(track.children) : [];
    if (!cards.length) return;
    var PAUSE = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5H5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>';
    var PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 1.5 10.5 6l-7.3 4.5z" fill="currentColor"/></svg>';
    var LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var moving = false, paused = false, held = false, away = false, running = false, placed = false;
    var pos = 0, setW = 1, speed = 24, last = 0, glide = null, drag = null;

    // ‹ pause/play ›, under the ribbon (outside it, so its faded edges don't touch them)
    var btnRow = document.createElement('div');
    btnRow.className = 'reader-buttons';
    btnRow.hidden = true;
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
    button('reader-prev', 'Back one quote', LEFT, function () { nudge(1); });
    var pause = button('reader-pause', '', '', function () { setPaused(!paused); });
    button('reader-next', 'On to the next quote', RIGHT, function () { nudge(-1); });
    box.parentNode.insertBefore(btnRow, box.nextSibling);

    function setPaused(on) {
      paused = on;
      pause.innerHTML = on ? PLAY : PAUSE;
      pause.setAttribute('aria-label', on ? 'Play the quotes' : 'Pause the quotes');
    }
    function wrap(p) { return ((p % setW) - setW) % setW; }   // always one set's width or less to the left
    function render() { track.style.transform = 'translate3d(' + wrap(pos).toFixed(2) + 'px,0,0)'; }
    function nudge(dir) {
      var step = setW / cards.length;
      var to = (glide ? glide.to : pos) + dir * step;
      if (reduce) { pos = to; glide = null; render(); return; }
      glide = { from: pos, to: to, t0: performance.now(), ms: 650 };
    }

    // Lay it out: measure the cards side by side; if they fit, stay still, otherwise fill and move.
    function layout() {
      track.querySelectorAll('[data-copy]').forEach(function (c) { c.remove(); });
      box.classList.remove('is-moving');
      track.style.transform = '';
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      setW = cards.reduce(function (w, c) { return w + c.getBoundingClientRect().width + gap; }, 0) || 1;
      moving = track.offsetWidth > box.clientWidth + 1;
      btnRow.hidden = !moving;
      if (!moving) { running = false; return; }
      box.classList.add('is-moving');
      var copies = Math.ceil(box.clientWidth / setW) + 1;
      for (var n = 0; n < copies; n++) {
        cards.forEach(function (c) {
          var copy = c.cloneNode(true);
          copy.setAttribute('data-copy', '');
          copy.setAttribute('aria-hidden', 'true');
          copy.inert = true;
          track.appendChild(copy);
        });
      }
      speed = Math.max(14, Math.min(26, box.clientWidth / 50));   // px a second: slower on phones
      if (!placed) { pos = Math.round(box.clientWidth * 0.06) + 8; placed = true; }   // first card clear of the fade
      render();
      start();
    }
    function frame(t) {
      if (!running) return;
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (glide) {
        var k = Math.min(1, (t - glide.t0) / glide.ms);
        pos = glide.from + (glide.to - glide.from) * (1 - Math.pow(1 - k, 3));
        if (k >= 1) glide = null;
      } else if (!drag && !held && !paused) {
        pos -= speed * dt;
      }
      render();
      requestAnimationFrame(frame);
    }
    function start() {
      if (running || !moving || away) return;
      running = true;
      last = 0;
      requestAnimationFrame(frame);
    }

    // hold still under the mouse; drag or swipe to move it by hand (a finger resting on it holds it too)
    box.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') held = true; });
    box.addEventListener('pointerleave', function () { held = false; });
    box.addEventListener('pointerdown', function (e) {
      if (!moving || e.button > 0) return;
      drag = { x: e.clientX, pos: pos, id: e.pointerId, on: false };
      glide = null;
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x;
      if (!drag.on && Math.abs(dx) > 4) {
        drag.on = true;
        box.classList.add('is-dragging');
        try { box.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (drag.on) pos = drag.pos + dx;
    });
    function endDrag() { drag = null; box.classList.remove('is-dragging'); }
    box.addEventListener('pointerup', endDrag);
    box.addEventListener('pointercancel', endDrag);

    // only run while it's on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        away = !entries[0].isIntersecting;
        if (away) running = false; else start();
      }).observe(box);
    }
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 150);
    });

    setPaused(reduce);
    layout();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);   // card widths settle once the fonts load
  });
})();
