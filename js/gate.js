// TEMPORARY password gate. It covers the page until the password is entered. The unlock
// lasts only while the tab is open (reloads included); a new tab or visit asks again.
// GitHub Pages can't password-protect for real: the page source
// (and the public repo) still holds everything, so this only keeps casual visitors out.
//
// Change the password: put the SHA-256 of the new one (in lowercase) in HASH:
//   printf '%s' newpassword | shasum -a 256
// Anyone with the site open will be asked again on their next reload.
//
// On/off: the gate runs only while index.html loads this file. It is OFF (since Nov 13 2026):
// the robots meta and script tag at the end of the <head> are inside a comment. Move them out
// of it to turn the gate back on. (The "Password gate" block at the end of css/styles.css does
// nothing while it's off.)
// Remove it for good: delete this file, those <head> lines, and that CSS block.
(function () {
  var HASH = '11cc76fe5951a65eea4b4632a4142fa44539d9a4c11adc6232c762789eabac7d';
  var KEY = 'site-gate';
  var root = document.documentElement;

  try { localStorage.removeItem(KEY); } catch (e) {}   // forget the old remember-this-browser unlock
  try { if (sessionStorage.getItem(KEY) === HASH) return; } catch (e) {}
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
        try { sessionStorage.setItem(KEY, HASH); } catch (err) {}
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
