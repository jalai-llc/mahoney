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

  // "Join the waitlist" in the nav jumps to the form and focuses the field.
  document.querySelectorAll('[data-focus-signup]').forEach(function (a) {
    a.addEventListener('click', function () {
      var field = document.getElementById('signup-email');
      if (field) setTimeout(function () { field.focus({ preventScroll: true }); }, 350);
    });
  });

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
})();
