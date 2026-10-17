/* ==========================================================================
   Mrembo Nails — public site interactions
   Renders services & gallery from config.js defaults (overridden by Supabase
   when configured), service detail modal, lightbox, filters, booking form.
   ========================================================================== */
(function () {
  'use strict';

  var $ = UI.$, $$ = UI.$$, esc = UI.esc, fmt = UI.fmtKSh;
  var S = window.SITE;

  /* ------------------------------------------------------------------
     State: config.js defaults, upgraded with live Supabase data if the
     owner has configured the dashboard (supabase.js).
     ------------------------------------------------------------------ */
  var state = {
    settings: Object.assign({}, S.DEFAULT_SETTINGS),
    services: S.DEFAULT_SERVICES.slice(),
    gallery: S.DEFAULT_GALLERY.slice(),
    usedSupabase: false
  };
  var svcMap = {};  // key → service object (defaults use def-idx, DB rows db-id)
  var galMap = {};  // key → gallery item
  var svcFilter = 'All';
  var galFilter = 'All';
  var galItems = [];       // gallery items currently rendered (lightbox source)
  var modalSvc = null;     // service shown in the detail modal
  var pendingExtras = [];  // add-ons picked in the modal, added to booking msg
  var pendingSvcName = '';

  function keyOfSvc(sv) { return sv.id != null ? 'db-' + sv.id : 'def-' + state.services.indexOf(sv); }
  function keyOfGal(g) { return g.storage_path ? 'up-' + g.storage_path : 'def-' + state.gallery.indexOf(g); }

  function normalizeServices(rows) {
    return rows.map(function (r) {
      var o = Object.assign({}, r);
      if (typeof o.addons === 'string') { try { o.addons = JSON.parse(o.addons); } catch (e) { o.addons = []; } }
      if (!Array.isArray(o.addons)) o.addons = [];
      o.price = Number(o.price) || 0;
      return o;
    });
  }

  /* ------------------------------------------------------------------
     Content loading (Supabase → merge over config defaults)
     ------------------------------------------------------------------ */
  async function loadContent() {
    if (!SUPABASE_SETUP.isConfigured()) { applySettings(); renderAll(); return; }
    try {
      var data = await SUPABASE_SETUP.fetchPublicContent();
      if (data.usedSupabase) {
        state.usedSupabase = true;
        if (data.settings) state.settings = Object.assign({}, state.settings, data.settings);
        if (data.services && data.services.length) state.services = normalizeServices(data.services);
        if (data.gallery && data.gallery.length) {
          // owner uploads first (newest sort), then built-in inspiration
          state.gallery = data.gallery.concat(S.DEFAULT_GALLERY);
        }
      }
    } catch (e) { /* fetchPublicContent already falls back safely */ }
    applySettings();
    renderAll();
  }

  /* ------------------------------------------------------------------
     Settings → DOM (brand, hero, house-call facts, booking copy, links)
     ------------------------------------------------------------------ */
  function setImg(sel, src, alt) {
    var img = $(sel);
    if (!img) return;
    if (src) { img.src = src; img.alt = alt || ''; }
    UI.guardImages(img.parentElement || document);
  }

  function updateWaButtons() {
    var s = state.settings;
    var ok = UI.waNumberOk(s.whatsappNumber);
    var text = 'Hello ' + (s.businessName || 'Mrembo Nails') + '! 💅 I found your page and would love to book a nail session. Could you share your availability?';
    var link = ok ? UI.waLink(s.whatsappNumber, text) : '#book';
    ['hero-wa', 'band-wa'].forEach(function (id) {
      var a = $('#' + id);
      if (a) a.href = link;
    });
    var fab = $('#fab');
    if (fab) {
      fab.onclick = function () {
        if (ok) { window.open(link, '_blank', 'noopener'); }
        else {
          document.getElementById('book').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth' });
          console.warn('[Mrembo] WhatsApp number not configured — set DEFAULT_SETTINGS.whatsappNumber in config.js');
        }
      };
    }
    var ig = String(s.instagramUsername || '').replace(/^@/, '');
    var igLink = 'https://instagram.com/' + encodeURIComponent(ig);
    var igA = $('#band-ig');
    if (igA) igA.href = igLink;
  }

  function tokenize(text, name) {
    return String(text == null ? '' : text)
      .replace(/\{year\}/g, new Date().getFullYear())
      .replace(/\{brand\}/g, String(name));
  }

  function applySettings() {
    var s = state.settings;
    var name = s.businessName || 'Mrembo Nails';
    document.title = name + ' — Luxury Nail Experiences in Kenya';
    var og1 = document.querySelector('meta[property="og:title"]');
    if (og1) og1.setAttribute('content', name + ' — Your Nails. Your Mood. Your Moment.');

    // search-engine / share description (safe: both are plain attributes)
    if (s.metaDescription) {
      var md = document.querySelector('meta[name="description"]');
      var ogd = document.querySelector('meta[property="og:description"]');
      if (md) md.setAttribute('content', s.metaDescription);
      if (ogd) ogd.setAttribute('content', s.metaDescription);
    }

    // hero buttons (textContent on the label spans keeps the button icons intact)
    var maybeText = function (id, key, fallback) {
      var el = $('#' + id);
      if (el) el.textContent = s[key] || fallback;
    };
    maybeText('hero-wa-label', 'heroCtaPrimaryLabel', 'Book on WhatsApp');
    maybeText('hero-explore', 'heroCtaSecondaryLabel', 'Explore Nail Designs');
    maybeText('band-wa-label', 'heroCtaPrimaryLabel', 'WhatsApp Us');
    maybeText('band-ig-label', 'heroCtaPrimaryLabel', 'Follow on Instagram');

    // section headings & copy
    maybeText('services-title', 'servicesSectionTitle', 'Choose Your Ritual');
    maybeText('services-sub', 'servicesSectionSub', 'Prices below are starting rates in Kenyan shillings — the final quote depends on length, design and add-ons.');
    maybeText('gallery-title', 'gallerySectionTitle', 'The Inspiration Wall');
    maybeText('gallery-sub', 'gallerySectionSub', 'Real sets from the studio. Tap any photo to view it up close — find the look you want and mention it when booking.');
    maybeText('booking-title', 'bookingSectionTitle', 'Reserve Your Moment');
    maybeText('house-title', 'houseSectionTitle', 'Beauty Comes to You');
    maybeText('house-tag', 'housePhotoTag', 'We come to you — set-up, session & spotless cleanup');

    // promo band
    maybeText('cta-band-title', 'ctaBandTitle', 'Ready for your next set?');
    maybeText('cta-band-sub', 'ctaBandSubtitle', 'Follow the daily work on Instagram, or book directly on WhatsApp.');

    // footer sign-off ({year} / {brand} tokens)
    var note = $('#foot-note');
    if (note) note.textContent = tokenize(s.footerNote || ' · Nail artistry in Kenya · Appointments confirmed by the artist via WhatsApp/Instagram', name);

    var initial = (name.trim().charAt(0) || 'M').toUpperCase();
    $('#brand-name').textContent = name;
    $('#foot-name').textContent = name;
    $('#foot-brand').textContent = name;
    $('#brand-mark').textContent = initial;
    $('#foot-mark').textContent = initial;
    if (s.logoUrl) {
      $('#brand-img').src = s.logoUrl;
      $('#brand-img').alt = name + ' logo';
      $('#brand-img').hidden = false;
      $('#brand-mark').hidden = true;
    } else {
      $('#brand-img').hidden = true;
      $('#brand-mark').hidden = false;
    }

    $('#hero-badge-text').textContent = s.heroBadge || 'House Calls Available';
    $('#hero-headline').textContent = s.heroHeadline || '';
    $('#hero-desc').textContent = s.heroDescription || '';
    $('#hero-meta').textContent =
      (s.studioLocation ? s.studioLocation : '') +
      (s.studioLocation && s.instagramUsername ? ' · Instagram: @' : '') +
      (s.instagramUsername ? '@' + String(s.instagramUsername).replace(/^@/, '') : '');

    setImg('#hero-image', s.heroImage, 'Fresh set of glossy nails — a sample from ' + name);
    setImg('#tech-image', s.technicianImage, 'The nail technician at work during a house call');

    $('#house-desc').textContent = s.houseCallDescription || '';
    $('#fact-studio').textContent = s.studioLocation || '';
    $('#fact-areas').textContent = String(s.houseCallAreas || '').split(';').map(function (x) { return x.trim(); }).filter(Boolean).join(' · ');
    $('#fact-transport').textContent = s.transportFee || '';
    $('#fact-hours').textContent = s.businessHours || '';

    $('#booking-instructions').textContent = s.bookingInstructions || '';
    $('#booking-disclaimer-text').textContent = s.bookingDisclaimer || '';

    $('#foot-location').textContent = s.studioLocation || '';
    $('#foot-year').textContent = new Date().getFullYear();

    // "From KSh …" hero chip — derived from the LIVE cheapest service
    var fromCard = $('#hero-from-card');
    var prices = state.services
      .filter(function (sv) { return sv.enabled !== false; })
      .map(function (sv) { return Number(sv.price); })
      .filter(function (p) { return isFinite(p) && p >= 0; });
    if (s.showHeroFrom !== false && prices.length) {
      fromCard.hidden = false;
      $('#hero-from-label').textContent = s.heroFromLabel || 'From';
      $('#hero-from').textContent = UI.fmtKSh(Math.min.apply(null, prices));
      $('#hero-from-caption').textContent = s.heroFromCaption || 'Manicure & gel sets';
    } else {
      fromCard.hidden = true;
    }

    // section visibility (gallery / house-call panel / promo band)
    var show = key => s[key] !== false;
    var setSectionVisible = function (sel, on) {
      var sec = document.querySelector(sel);
      if (sec) sec.hidden = !on;
      // every anchor pointing at a hidden section (nav, drawer, footer)
      document.querySelectorAll('a[href="' + sel + '"]').forEach(function (a) { a.hidden = !on; });
      if (sel === '#gallery') {
        var explore = document.getElementById('hero-explore');
        if (explore) explore.hidden = !on;
      }
    };
    setSectionVisible('#gallery', show('showGallerySection'));
    setSectionVisible('#house-calls', show('showHouseCallSection'));
    var ctaBand = $('#cta-band');
    if (ctaBand) ctaBand.hidden = !show('showCtaBand');

    updateWaButtons();
  }

  /* ------------------------------------------------------------------
     Filter chips (shared builder for services & gallery)
     ------------------------------------------------------------------ */
  function buildChips(host, cats, current, onPick) {
    if (!host) return;
    var all = ['All'].concat(cats);
    host.innerHTML = all.map(function (c) {
      return '<button type="button" class="chip' + (c === current ? ' active' : '') +
        '" data-cat="' + esc(c) + '" aria-pressed="' + (c === current) + '">' + esc(c) + '</button>';
    }).join('');
    host.onclick = function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.chip') : null;
      if (b) onPick(b.getAttribute('data-cat'));
    };
  }

  function emptyHtml(emoji, msg) {
    return '<div class="empty-state glass-card" style="grid-column:1/-1;"><span class="big" aria-hidden="true">' + emoji + '</span><p>' + msg + '</p></div>';
  }

  /* ------------------------------------------------------------------
     Services
     ------------------------------------------------------------------ */
  function renderServiceFilters() {
    buildChips($('#service-filters'), S.SERVICE_CATEGORIES, svcFilter, function (c) {
      svcFilter = c;
      renderServiceFilters();
      renderServices();
    });
  }

  function enabledServices() {
    return state.services.filter(function (sv) { return sv.enabled !== false; });
  }

  function renderServices() {
    svcMap = {};
    state.services.forEach(function (sv) { svcMap[keyOfSvc(sv)] = sv; });
    var grid = $('#services-grid');
    var list = enabledServices();
    if (svcFilter !== 'All') list = list.filter(function (sv) { return sv.category === svcFilter; });

    if (!list.length) {
      grid.innerHTML = emptyHtml('💅', 'No sets in “' + esc(svcFilter) + '” right now — try another filter, or ask on WhatsApp if it can be booked.');
      return;
    }

    grid.innerHTML = list.map(function (sv) {
      var key = keyOfSvc(sv);
      var cat = sv.category ? '<span class="card-cat">' + esc(sv.category) + '</span>' : '';
      var feat = sv.featured ? '<span class="featured-badge">★ Featured</span>' : '';
      return '<article class="card reveal">' +
        '<div class="card-media">' +
          '<img src="' + esc(sv.cover_url || UI.PLACEHOLDER_IMG) + '" alt="' + esc(sv.name) + ' — nail service at ' + esc(state.settings.businessName) + '" loading="lazy">' +
          cat + feat +
        '</div>' +
        '<div class="card-body">' +
          '<h3 class="card-title">' + esc(sv.name) + '</h3>' +
          '<p class="card-desc">' + esc(sv.description || '') + '</p>' +
          '<div class="card-meta">' +
            '<div><span class="price-tag">' + fmt(sv.price) + '</span> <span class="price-small">starting</span></div>' +
            (sv.duration ? '<span class="duration-chip">⏱ ' + esc(sv.duration) + '</span>' : '') +
          '</div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-sm btn-outline" data-details="' + esc(key) + '">View Details</button>' +
            '<button class="btn btn-sm btn-wa" data-book="' + esc(key) + '">Book This Set</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
    UI.guardImages(grid);
    UI.$$('.reveal', grid).forEach(bindReveal);
  }

  function openService(key) {
    var sv = svcMap[key];
    if (!sv) return;
    modalSvc = sv;
    $('#sm-img').src = sv.cover_url || UI.PLACEHOLDER_IMG;
    $('#sm-img').alt = esc(sv.name) + ' — service photo';
    $('#sm-cat').textContent = sv.category || 'Nail Service';
    $('#sm-title').textContent = sv.name;
    $('#sm-price').textContent = fmt(sv.price) + '+';
    $('#sm-duration').textContent = sv.duration ? '· ' + sv.duration : '';
    $('#sm-desc').textContent = sv.description || '';
    var addons = Array.isArray(sv.addons) ? sv.addons : [];
    var wrap = $('#sm-addons-wrap'), list = $('#sm-addons');
    if (addons.length) {
      list.innerHTML = addons.map(function (a, i) {
        if (!a || !a.label) return '';
        return '<label class="addon">' +
          '<input type="checkbox" data-idx="' + i + '">' +
          '<span class="addon-label">' + esc(a.label) + '</span>' +
          '<span class="addon-price">+' + fmt(a.price) + '</span></label>';
      }).join('');
      wrap.hidden = false;
    } else { wrap.hidden = true; list.innerHTML = ''; }
    updateTotal();
    UI.openModal($('#service-modal'));
  }

  function selectedAddons() {
    if (!modalSvc) return [];
    return $$('#sm-addons input:checked').map(function (cb) {
      return modalSvc.addons[Number(cb.getAttribute('data-idx'))];
    });
  }

  function updateTotal() {
    var total = modalSvc ? (Number(modalSvc.price) || 0) : 0;
    selectedAddons().forEach(function (a) { total += Number(a && a.price) || 0; });
    $('#sm-total').textContent = fmt(total);
  }

  /* ------------------------------------------------------------------
     Gallery + lightbox
     ------------------------------------------------------------------ */
  function renderGalleryFilters() {
    buildChips($('#gallery-filters'), S.GALLERY_CATEGORIES, galFilter, function (c) {
      galFilter = c;
      renderGalleryFilters();
      renderGallery();
    });
  }

  function renderGallery() {
    galMap = {};
    state.gallery.forEach(function (g) { galMap[keyOfGal(g)] = g; });
    var grid = $('#gallery-grid');
    var list = state.gallery;
    if (galFilter !== 'All') list = list.filter(function (g) { return g.category === galFilter; });
    galItems = list;

    if (!list.length) {
      grid.innerHTML = emptyHtml('🌸', 'No photos in “' + esc(galFilter) + '” just yet — new sets are added often. Try another filter!');
      return;
    }
    grid.innerHTML = list.map(function (g) {
      var key = keyOfGal(g);
      var cap = esc(g.title || '') + (g.description ? ' — ' + esc(g.description) : '');
      return '<button type="button" class="g-item reveal" data-lb="' + esc(key) + '" aria-label="View ' + esc(g.title || 'photo') + ' enlarged">' +
        '<img src="' + esc(g.image_url || UI.PLACEHOLDER_IMG) + '" alt="' + cap + '" loading="lazy">' +
        '<span class="g-cat-tag' + (g.featured ? ' feat' : '') + '">' + (g.featured ? '★ ' : '') + esc(g.category || 'Nails') + '</span>' +
        '<span class="g-cap">' + esc(g.title || '') + '</span>' +
      '</button>';
    }).join('');
    UI.guardImages(grid);
    UI.$$('.reveal', grid).forEach(bindReveal);
  }

  var lbIndex = -1;
  function openLightbox(key) {
    var idx = galItems.findIndex(function (g) { return keyOfGal(g) === key; });
    if (idx < 0) return;
    lbIndex = idx;
    renderLightbox();
    UI.openModal($('#lightbox'));
  }
  function renderLightbox() {
    var g = galItems[lbIndex];
    if (!g) return;
    var img = $('#lb-img');
    img.classList.remove('zoomed');
    img.style.maxHeight = ''; img.style.maxWidth = '';
    $('#lb-zoom').setAttribute('aria-pressed', 'false');
    $('#lb-zoom').classList.remove('zoomed');
    img.src = g.image_url || UI.PLACEHOLDER_IMG;
    img.alt = esc(g.title || 'Gallery photo');
    $('#lb-title').textContent = g.title || '';
    $('#lb-desc').textContent = g.description ? ' — ' + g.description : '';
  }
  function lbStep(dir) {
    if (!galItems.length) return;
    lbIndex = (lbIndex + dir + galItems.length) % galItems.length;
    renderLightbox();
  }

  /* ------------------------------------------------------------------
     Booking form
     ------------------------------------------------------------------ */
  function renderBookingServices() {
    var sel = $('#f-service');
    var list = enabledServices();
    sel.innerHTML = '<option value="" disabled selected>Choose a service…</option>' +
      list.map(function (sv) {
        return '<option value="' + esc(sv.name) + '">' + esc(sv.name) + ' — from ' + fmt(sv.price) + '</option>';
      }).join('');
  }

  function refreshSummary() {
    var box = $('#booking-summary');
    var name = $('#f-service').value;
    if (!name) { box.hidden = true; box.innerHTML = ''; return; }
    var sv = null;
    enabledServices().forEach(function (s) { if (s.name === name) sv = s; });
    if (!sv) { box.hidden = true; return; }

    var extras = (pendingSvcName === name) ? pendingExtras : [];
    var total = (Number(sv.price) || 0);
    extras.forEach(function (a) { total += Number(a && a.price) || 0; });

    var date = $('#f-date').value, time = $('#f-time').value;
    var loc = $('#f-location').value.trim();
    var mode = document.querySelector('input[name="mode"]:checked');
    var when = (date ? UI.formatDate(date) : '') + (time ? (date ? ', ' : '') + time : '');

    box.innerHTML = '<dl>' +
      '<div><dt>Service</dt><dd>' + esc(sv.name) + '</dd></div>' +
      '<div><dt>Starting price</dt><dd>' + fmt(sv.price) + '</dd></div>' +
      (extras.length ? '<div><dt>Add-ons</dt><dd>' + extras.map(function (a) { return esc(a.label); }).join(' · ') + '</dd></div>' : '') +
      '<div><dt>Estimated total</dt><dd>' + fmt(total) + '</dd></div>' +
      (when ? '<div><dt>When</dt><dd>' + esc(when) + '</dd></div>' : '') +
      '<div><dt>Session</dt><dd>' + esc(mode ? mode.value : 'House call') + '</dd></div>' +
      (loc ? '<div><dt>Area</dt><dd>' + esc(loc) + '</dd></div>' : '') +
      '</dl>';
    box.hidden = false;
  }

  function fieldError(input, msg) {
    input.classList.add('input-error');
    input.setAttribute('aria-invalid', 'true');
    var err = input.parentElement.querySelector('.field-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      input.parentElement.appendChild(err);
    }
    err.textContent = msg;
  }
  function clearErrors(form) {
    $$('.input-error', form).forEach(function (el) {
      el.classList.remove('input-error');
      el.removeAttribute('aria-invalid');
    });
    $$('.field-error', form).forEach(function (el) { el.remove(); });
  }

  function submitBooking(e) {
    e.preventDefault();
    var form = $('#booking-form');
    clearErrors(form);

    var name = $('#f-service').value;
    var date = $('#f-date').value;
    var time = $('#f-time').value;
    var loc = $('#f-location').value.trim();
    var notes = $('#f-notes').value.trim();
    var modeEl = document.querySelector('input[name="mode"]:checked');
    var mode = modeEl ? modeEl.value : 'House call';

    var bad = false, first = null;
    [['#f-service', 'Choose a service'], ['#f-date', 'Choose a date'], ['#f-time', 'Choose a time'], ['#f-location', 'Tell us your area']]
      .forEach(function (pair) {
        var el = $(pair[0]);
        if (!el.value || !el.value.trim()) {
          bad = true;
          fieldError(el, pair[1]);
          if (!first) first = el;
        }
      });
    if (bad) {
      UI.toast('Please complete the highlighted fields.', 'err');
      if (first) first.focus();
      return;
    }

    var s = state.settings;
    if (!UI.waNumberOk(s.whatsappNumber)) {
      UI.toast('WhatsApp number is not set up yet — the owner adds it in config.js.', 'err', 6000);
      return;
    }

    var sv = null;
    enabledServices().forEach(function (x) { if (x.name === name) sv = x; });
    var extras = (pendingSvcName === name) ? pendingExtras : [];
    var total = (Number(sv && sv.price) || 0);
    extras.forEach(function (a) { total += Number(a && a.price) || 0; });

    var text = UI.buildBookingText({
      businessName: s.businessName,
      serviceName: name,
      basePrice: sv ? sv.price : null,
      addons: extras,
      total: total,
      date: UI.formatDate(date),
      time: time,
      mode: mode,
      location: loc,
      notes: notes,
      disclaimer: s.bookingDisclaimer
    });

    window.open(UI.waLink(s.whatsappNumber, text), '_blank', 'noopener');
    UI.toast('Opening WhatsApp — just press send to request this booking 💕', 'ok', 5200);
  }

  /* ------------------------------------------------------------------
     Motion helpers: reveal-on-scroll, nav spy, drawer, misc
     ------------------------------------------------------------------ */
  var revealIO = null;
  function bindReveal(el) {
    if (!('IntersectionObserver' in window) || UI.reduceMotion()) { el.classList.add('in'); return; }
    if (!revealIO) {
      revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
        });
      }, { threshold: 0.1 });
    }
    revealIO.observe(el);
  }
  function scanReveal() { $$('.reveal').forEach(bindReveal); }

  function initSpy() {
    var links = $$('.nav-links a[href^="#"]').filter(function (a) { return !a.classList.contains('nav-cta'); });
    var map = {};
    links.forEach(function (a) {
      var sec = document.querySelector(a.getAttribute('href'));
      if (sec) map[sec.id] = a;
    });
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (l) { l.classList.remove('active'); });
          map[en.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) { io.observe(document.getElementById(id)); });
  }

  function initDrawer() {
    var btn = $('#menu-btn'), drawer = $('#drawer');
    if (!btn || !drawer) return;
    function set(open) {
      drawer.classList.toggle('open', open);
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    btn.addEventListener('click', function () { set(!drawer.classList.contains('open')); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('click', function (e) {
      if (drawer.classList.contains('open') && !e.target.closest('#drawer') && !e.target.closest('#menu-btn')) set(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) set(false);
    });
  }

  /* ------------------------------------------------------------------
     Wiring
     ------------------------------------------------------------------ */
  function renderAll() {
    renderServiceFilters();
    renderServices();
    renderBookingServices();
    renderGalleryFilters();
    renderGallery();
    refreshSummary();
  }

  document.addEventListener('DOMContentLoaded', function () {
    UI.initModals();
    initDrawer();
    initSpy();

    // date input: no past dates
    var d = $('#f-date');
    if (d) d.min = new Date().toISOString().slice(0, 10);

    // service cards (delegated)
    $('#services-grid').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-details],[data-book]') : null;
      if (!b) return;
      if (b.hasAttribute('data-details')) openService(b.getAttribute('data-details'));
      else {
        var key = b.getAttribute('data-book');
        var sv = svcMap[key];
        if (sv) {
          pendingExtras = [];
          pendingSvcName = '';
          $('#f-service').value = sv.name;
          refreshSummary();
          document.getElementById('book').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth' });
          UI.toast(sv.name + ' selected — complete date & time, then send 💕', 'info', 3400);
        }
      }
    });

    // detail modal
    $('#sm-addons').addEventListener('change', updateTotal);
    $('#sm-book').addEventListener('click', function () {
      if (!modalSvc) return;
      pendingExtras = selectedAddons();
      pendingSvcName = modalSvc.name || '';
      $('#f-service').value = modalSvc.name || '';
      updateTotal();
      UI.closeModal($('#service-modal'));
      setTimeout(function () {
        document.getElementById('book').scrollIntoView({ behavior: UI.reduceMotion() ? 'auto' : 'smooth' });
        refreshSummary();
        UI.toast('Added to booking — pick date & time, then send 💕', 'info', 3400);
      }, 180);
    });

    // gallery + lightbox
    $('#gallery-grid').addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-lb]') : null;
      if (b) openLightbox(b.getAttribute('data-lb'));
    });
    $('#lb-prev').addEventListener('click', function () { lbStep(-1); });
    $('#lb-next').addEventListener('click', function () { lbStep(1); });
    $('#lb-zoom').addEventListener('click', function () {
      var img = $('#lb-img');
      var on = img.classList.toggle('zoomed');
      img.style.maxHeight = on ? 'none' : '';
      img.style.maxWidth = on ? 'none' : '';
      this.setAttribute('aria-pressed', String(on));
      this.classList.toggle('zoomed', on);
      this.textContent = on ? '✕ Reset zoom' : '🔍 Zoom';
    });
    document.addEventListener('keydown', function (e) {
      var lb = $('#lightbox');
      if (!lb.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
    });

    // booking form
    $('#booking-form').addEventListener('submit', submitBooking);
    ['f-service', 'f-date', 'f-time', 'f-location'].forEach(function (id) {
      $('#' + id).addEventListener('change', refreshSummary);
      $('#' + id).addEventListener('input', refreshSummary);
    });
    $$('input[name="mode"]').forEach(function (r) { r.addEventListener('change', refreshSummary); });

    $$('.reveal').forEach(bindReveal);
    loadContent();
  });
})();
