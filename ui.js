/* ==========================================================================
   Mrembo Nails — small shared UI helpers (used by index.html & admin.html)
   Toasts · modal manager (focus trap / Esc / backdrop) · formatting helpers
   ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c];
    });
  }

  function fmtKSh(n) { return 'KSh ' + Number(n || 0).toLocaleString('en-KE'); }

  var PLACEHOLDER_IMG = 'assets/placeholder.svg';

  function imgFallback(img) {
    if (!img || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = '1';
    img.src = PLACEHOLDER_IMG;
  }
  function guardImages(root) {
    $$('img', root).forEach(function (im) {
      if (im.dataset.fallbackGuarded) return;
      im.dataset.fallbackGuarded = '1';
      im.addEventListener('error', function () { imgFallback(im); });
    });
  }

  /* ---------------- toasts ---------------- */
  var toastHost = null;
  function ensureToastHost() {
    if (!toastHost || !document.body.contains(toastHost)) {
      toastHost = document.createElement('div');
      toastHost.className = 'toasts';
      toastHost.setAttribute('role', 'status');
      toastHost.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastHost);
    }
  }
  function toast(message, type, ms) {
    ensureToastHost();
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'ok');
    t.textContent = message; // text only — safe for any message
    toastHost.appendChild(t);
    setTimeout(function () {
      t.classList.add('out');
      setTimeout(function () { t.remove(); }, 350);
    }, ms || 3800);
  }

  /* ---------------- modal manager ---------------- */
  var openStack = [];

  function openModal(el) {
    if (!el || !el.classList.contains('js-modal')) return;
    if (openStack.indexOf(el) !== -1) return;
    el.dataset.focusBefore = (document.activeElement && document.activeElement.id) || '';
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('open'); });
    document.body.classList.add('no-scroll');
    openStack.push(el);
    setTimeout(function () {
      var f = el.querySelector('[data-focus]') ||
              el.querySelector('button:not([data-close]), a[href], input, select, textarea');
      if (!f) f = el.querySelector('button');
      if (f) f.focus();
    }, 60);
    el.dispatchEvent(new CustomEvent('ui:modalopen', { bubbles: true }));
  }

  function closeModal(el) {
    if (!el) return;
    var i = openStack.indexOf(el);
    if (i === -1) return; // already closed
    openStack.splice(i, 1);
    el.classList.remove('open');
    setTimeout(function () { el.hidden = true; }, 220);
    if (!openStack.length) document.body.classList.remove('no-scroll');
    var prev = el.dataset.focusBefore && document.getElementById(el.dataset.focusBefore);
    if (prev) prev.focus();
    el.dispatchEvent(new CustomEvent('ui:modalclosed', { bubbles: true }));
  }

  function topModal() { return openStack.length ? openStack[openStack.length - 1] : null; }

  function initModals() {
    document.addEventListener('click', function (e) {
      var closer = e.target.closest ? e.target.closest('[data-close]') : null;
      if (closer) {
        var m = closer.closest('.js-modal');
        if (m) closeModal(m);
        return;
      }
      if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
        closeModal(e.target.closest('.js-modal'));
      }
    });
    document.addEventListener('keydown', function (e) {
      var top = topModal();
      if (!top) return;
      if (e.key === 'Escape') { e.preventDefault(); closeModal(top); return; }
      if (e.key === 'Tab') trapFocus(e, top);
    });
  }

  function trapFocus(e, modal) {
    var focusables = $$(
      'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
      modal
    ).filter(function (el) { return el.offsetParent !== null; });
    if (!focusables.length) { e.preventDefault(); return; }
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------- misc helpers ---------------- */
  function waNumberOk(n) { return /^[0-9]{9,15}$/.test(String(n || '').replace(/\D/g, '')); }

  function waLink(number, text) {
    return 'https://wa.me/' + String(number).replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }

  /**
   * Builds the WhatsApp booking message.
   * opts: { businessName, serviceName, basePrice, addons:[{label,price}],
   *         total, date, time, mode, location, notes, disclaimer }
   */
  function buildBookingText(opts) {
    var o = opts || {};
    var L = [];
    L.push('Hello ' + (o.businessName || 'Mrembo Nails') + '! 💅');
    L.push('');
    if (o.serviceName) {
      L.push('I\'d like to book a session:');
      L.push('• Service: ' + o.serviceName);
      if (o.basePrice != null) L.push('• Starting price: ' + fmtKSh(o.basePrice));
    } else {
      L.push('I\'d like to book a nail session.');
    }
    if (o.addons && o.addons.length) {
      o.addons.forEach(function (a) { L.push('   + ' + a.label + ' (' + fmtKSh(a.price) + ')'); });
    }
    if (o.total != null) L.push('• Estimated total: ' + fmtKSh(o.total) + ' (starting rate)');
    if (o.date) L.push('• Date: ' + o.date);
    if (o.time) L.push('• Time: ' + o.time);
    if (o.mode) L.push('• Session: ' + o.mode);
    if (o.location) L.push('• Location: ' + o.location);
    if (o.notes) L.push('• Design notes: ' + o.notes);
    L.push('');
    if (o.disclaimer) L.push(o.disclaimer);
    return L.join('\n');
  }

  function formatDate(iso) {
    try {
      var d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) { return iso; }
  }

  function slugify(s) {
    return String(s || '').toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')      // strip extension
      .replace(/[^a-z0-9]+/g, '-')       // separators
      .replace(/^-+|-+$/g, '') || 'photo';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  }

  function reduceMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  global.UI = {
    $: $, $$: $$, esc: esc, fmtKSh: fmtKSh, PLACEHOLDER_IMG: PLACEHOLDER_IMG,
    imgFallback: imgFallback, guardImages: guardImages,
    toast: toast, openModal: openModal, closeModal: closeModal, initModals: initModals,
    waNumberOk: waNumberOk, waLink: waLink, buildBookingText: buildBookingText,
    formatDate: formatDate, slugify: slugify, debounce: debounce, reduceMotion: reduceMotion
  };
})(window);
