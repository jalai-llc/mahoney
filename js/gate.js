// TEMPORARY password gate. It covers the page until the password is entered, then
// remembers this browser. GitHub Pages can't password-protect for real: the page source
// (and the public repo) still holds everything, so this only keeps casual visitors out.
//
// Change the password: put the SHA-256 of the new one (in lowercase) in HASH:
//   printf '%s' newpassword | shasum -a 256
// Everyone who already got in will be asked again.
//
// Take the gate down: delete this file, the three "password gate" lines (comment, robots
// meta, script tag) at the end of the <head> in index.html, and the "Password gate" block
// at the end of css/styles.css.
(function () {
  var HASH = '11cc76fe5951a65eea4b4632a4142fa44539d9a4c11adc6232c762789eabac7d';
  var KEY = 'site-gate';
  var root = document.documentElement;

  try { if (localStorage.getItem(KEY) === HASH) return; } catch (e) {}
  root.classList.add('gated');   // css/styles.css hides the page while this is set

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ('0' + b.toString(16)).slice(-2);
      }).join('');
    });
  }

  function build() {
    var gate = document.createElement('div');
    gate.className = 'gate';
    gate.innerHTML =
      '<form class="gate-inner">' +
        '<p class="eyebrow">A memoir by Terry Mahoney</p>' +
        '<h1>Wave After Wave</h1>' +
        '<p class="gate-copy">This site is private for now. Enter the password to continue.</p>' +
        '<div class="email-form">' +
          '<label class="sr-only" for="gate-pw">Password</label>' +
          '<input id="gate-pw" type="password" required placeholder="Password" autocomplete="current-password"' +
            ' autocapitalize="off" autocorrect="off" spellcheck="false">' +
          '<button class="btn" type="submit">Enter</button>' +
        '</div>' +
        '<p class="gate-msg" role="status" aria-live="polite"></p>' +
      '</form>';
    document.body.insertBefore(gate, document.body.firstChild);

    var form = gate.querySelector('form');
    var input = gate.querySelector('input');
    var msg = gate.querySelector('.gate-msg');
    input.focus();
    // A link with #section moves focus to the page once it loads; take it back.
    window.addEventListener('load', function () {
      setTimeout(function () { if (gate.isConnected && document.activeElement === document.body) input.focus(); }, 0);
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!window.crypto || !crypto.subtle) {
        msg.textContent = 'Open this page over https:// to sign in.';
        return;
      }
      sha256(input.value.trim().toLowerCase()).then(function (hash) {
        if (hash !== HASH) {
          msg.textContent = 'That isn’t it. Try again.';
          input.select();
          return;
        }
        try { localStorage.setItem(KEY, HASH); } catch (err) {}
        gate.remove();
        root.classList.remove('gated');
        window.dispatchEvent(new Event('resize'));   // the video carousel re-measures its arrows
        var target = location.hash && document.getElementById(location.hash.slice(1));
        if (target) target.scrollIntoView();
      });
    });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();
