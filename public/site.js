// The only client-side JavaScript on the site: the theme toggle and the
// research filter.

document.addEventListener('click', function (e) {
  var btn = e.target.closest('.theme-toggle');
  if (!btn) return;
  var root = document.documentElement;
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var current = root.dataset.theme || (systemDark ? 'dark' : 'light');
  var next = current === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  localStorage.setItem('theme', next);
});

var chips = document.querySelectorAll('#research .chip');
var cards = document.querySelectorAll('#research .card');
chips.forEach(function (chip) {
  chip.addEventListener('click', function () {
    chips.forEach(function (c) {
      c.classList.toggle('on', c === chip);
    });
    var f = chip.dataset.f;
    cards.forEach(function (card) {
      var filters = card.dataset.filter.split(' ');
      card.style.display = f === 'all' || filters.indexOf(f) !== -1 ? 'flex' : 'none';
    });
  });
});
