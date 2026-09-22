/**
 * A tri-state light/dark/system theme toggle.
 *
 * Not a binary light/dark switch. A binary toggle has to map one of its two
 * states back to "system" behind the scenes, and that produces a real bug: a
 * reader who visits by day (system = light), switches the toggle away and
 * back to "light" and thinks they are done, has actually landed back on
 * "system" — so when their OS flips to dark at night, the site follows it,
 * silently overriding a choice they made on purpose. Three explicit states —
 * システム / ライト / ダーク — cost one more button and remove the bug
 * entirely: "system" is never implied, only ever chosen.
 *
 * The only state kept is which of the three was picked, in `localStorage`.
 * Nothing here reaches the network — this file is the site's one exception to
 * running no code at all, and it stays inside that one narrow job.
 *
 * Loaded synchronously in `<head>`, ahead of first paint, specifically so the
 * theme applies before anything is drawn — a deferred script here would flash
 * the wrong theme for one frame on every load.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'apv-theme';
  var root = document.documentElement;

  function stored() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch (error) {
      // Storage blocked (private mode, disabled entirely) — the toggle still
      // works for the current page view, it just forgets on reload.
      return 'system';
    }
  }

  function apply(value) {
    if (value === 'light' || value === 'dark') {
      root.setAttribute('data-theme', value);
    } else {
      // "system" is the absence of the attribute, not a third value written
      // into it — the existing `prefers-color-scheme` query in site.css
      // already handles this case and needs nothing from this file.
      root.removeAttribute('data-theme');
    }
  }

  apply(stored());

  document.addEventListener('DOMContentLoaded', function () {
    var group = document.querySelector('[data-theme-toggle]');
    if (!group) return;

    // Hidden in the HTML so a reader without JavaScript never sees a control
    // that cannot do anything — revealed only once this file has run and can
    // actually wire it up.
    group.hidden = false;

    var current = stored();
    var inputs = group.querySelectorAll('input[type="radio"]');
    for (var i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      input.checked = input.value === current;
      input.addEventListener('change', function (event) {
        var target = event.target;
        if (!target.checked) return;
        try {
          if (target.value === 'system') {
            localStorage.removeItem(STORAGE_KEY);
          } else {
            localStorage.setItem(STORAGE_KEY, target.value);
          }
        } catch (error) {
          // Falls back to applying for this page view only — see stored().
        }
        apply(target.value);
      });
    }
  });
})();
