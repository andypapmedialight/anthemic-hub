(function () {
  var tip = document.createElement('div');
  tip.className = 'tooltip';
  document.body.appendChild(tip);

  function cardFor(key) { return document.querySelector('.card[data-key="' + key + '"]'); }
  function set(key, on) {
    document.querySelectorAll('[data-key="' + key + '"]').forEach(function (el) {
      el.classList.toggle('lit', on);
    });
  }
  function showTip(key, node) {
    var card = cardFor(key);
    if (!card) return;
    tip.className = 'tooltip card ' + (node.classList.contains('violet') ? 'violet' : 'cyan');
    tip.innerHTML = card.innerHTML;
    var dot = node.querySelector('circle:not(.halo)') || node;
    var r = dot.getBoundingClientRect();
    tip.classList.add('show');
    var tw = tip.offsetWidth, th = tip.offsetHeight, gap = 16;
    var left = r.right + gap;
    if (left + tw > window.innerWidth - 8) left = r.left - gap - tw; // flip left near right edge
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    var top = r.top + r.height / 2 - th / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - th - 8));
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { tip.classList.remove('show'); }

  document.querySelectorAll('[data-key]').forEach(function (el) {
    var key = el.getAttribute('data-key');
    var isNode = el.classList.contains('node');
    el.addEventListener('mouseenter', function () { set(key, true); if (isNode) showTip(key, el); });
    el.addEventListener('mouseleave', function () { set(key, false); if (isNode) hideTip(); });
    if (isNode) {
      el.addEventListener('focus', function () { set(key, true); showTip(key, el); });
      el.addEventListener('blur', function () { set(key, false); hideTip(); });
      el.setAttribute('tabindex', '0');
    } else if (el.classList.contains('card')) {
      el.tabIndex = 0;
      el.addEventListener('focus', function () { set(key, true); });
      el.addEventListener('blur', function () { set(key, false); });
    }
  });

  function focusHash() {
    var id = (location.hash || '').replace(/^#/, '');
    if (!id) return;
    var card = document.getElementById(id) || cardFor(id);
    if (!card) return;
    set(id, true);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof card.focus === 'function') card.focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', focusHash);
  focusHash();
})();
