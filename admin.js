/* ==========================================================================
   Mrembo Nails — Owner dashboard (admin.html)
   Login via Supabase Auth · gallery photo uploads · service & price manager
   · business settings. All writes require the owner's authenticated session
   AND must pass Supabase RLS policies (see supabase-setup.sql).
   ========================================================================== */
(function () {
  'use strict';

  var $ = UI.$, $$ = UI.$$, esc = UI.esc, fmt = UI.fmtKSh;
  var S = window.SITE;
  var SETUP = window.SUPABASE_SETUP;

  var state = {
    user: null,
    services: [],
    gallery: [],
    settingsRow: null,
    editingSvcId: null,
    editingImgId: null,
    pending: []   // photos staged for upload
  };
  var pendingConfirm = null;
  var pid = 0;

  function shortErr(err) {
    return err && err.message ? String(err.message).slice(0, 140) : String(err || 'Unknown error');
  }

  /* ==================================================================
     AUTH
     ================================================================== */
  function showAuth(message) {
    $('#dash-view').hidden = true;
    $('#auth-view').hidden = false;
    if (message) {
      var m = $('#login-msg');
      m.textContent = message;
      m.hidden = false;
    }
  }
  function showDash(user) {
    $('#auth-view').hidden = true;
    $('#dash-view').hidden = false;
    $('#user-chip').textContent = user.email || 'owner';
    refreshData();
  }

  function friendlyAuthError(e) {
    var msg = (e && e.message) || '';
    if (/Invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
    if (/Email not confirmed/i.test(msg)) return 'This email is not confirmed yet — check your inbox (or confirm it in the Supabase dashboard).';
    if (/Too many requests/i.test(msg)) return 'Too many attempts — please wait a minute and try again.';
    if (/signups not allowed/i.test(msg)) return 'Sign-up is disabled on this project (by design). Ask the owner to create accounts in Supabase → Auth.';
    return msg || 'Could not sign in — please try again.';
  }

  async function boot() {
    if (!SETUP.isConfigured()) {
      var m = $('#login-msg');
      m.textContent = 'Supabase is not configured yet. Paste your Project URL and anon/publishable key into supabase.js (see README → step 4), then reload this page.';
      m.hidden = false;
      $('#login-email').disabled = true;
      $('#login-password').disabled = true;
      $('#login-btn').disabled = true;
      return;
    }
    var client;
    try { client = await SETUP.getClient(); }
    catch (e) { showAuth('Could not reach Supabase: ' + shortErr(e)); return; }

    try {
      var res = await client.auth.getSession();
      if (res && res.data && res.data.session) showDash(res.data.session.user);
      else showAuth();
    } catch (e) { showAuth('Could not check your session: ' + shortErr(e)); }

    client.auth.onAuthStateChange(function (evt, session) {
      if (evt === 'SIGNED_OUT' || !session) {
        if (!$('#dash-view').hidden) showAuth();
        return;
      }
      if ($('#dash-view').hidden) showDash(session.user);
      if (evt === 'PASSWORD_RECOVERY') {
        UI.toast('Password reset verified — set a new password below under Settings → Account.', 'info', 7000);
        showTab('settings');
      }
    });
  }

  function setLoading(btn, on, label) {
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + (label || 'Working…');
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.label || label || 'Save';
    }
  }

  $('#login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('#login-btn'), msg = $('#login-msg');
    msg.hidden = true;
    var email = $('#login-email').value.trim();
    var password = $('#login-password').value;
    if (!email || !password) {
      msg.textContent = 'Please enter both email and password.';
      msg.hidden = false;
      return;
    }
    setLoading(btn, true, 'Signing in…');
    try {
      var client = await SETUP.getClient();
      var res = await client.auth.signInWithPassword({ email: email, password: password });
      if (res.error) throw res.error;
      // success → onAuthStateChange shows the dashboard
    } catch (err) {
      msg.textContent = friendlyAuthError(err);
      msg.hidden = false;
    } finally {
      setLoading(btn, false, 'Sign In');
    }
  });

  $('#forgot-btn').addEventListener('click', async function () {
    var email = $('#login-email').value.trim();
    if (!email) {
      UI.toast('Type your email above first, then tap “Forgot password?”.', 'info');
      $('#login-email').focus();
      return;
    }
    try {
      var client = await SETUP.getClient();
      var res = await client.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      if (res.error) throw res.error;
      UI.toast('Password reset email sent — check your inbox 💌', 'ok', 6000);
    } catch (err) {
      UI.toast('Could not send reset email: ' + shortErr(err), 'err', 6000);
    }
  });

  $('#logout-btn').addEventListener('click', async function () {
    try {
      var client = await SETUP.getClient();
      await client.auth.signOut();
    } catch (e) { /* signing out locally regardless */ }
    state.user = null;
    state.pending.forEach(function (p) { URL.revokeObjectURL(p.url); });
    state.pending = [];
    renderPending();
    showAuth();
  });

  /* ==================================================================
     TABS
     ================================================================== */
  function showTab(name) {
    $$('.admin-tab').forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
    $$('.tab-panel').forEach(function (p) { p.hidden = p.dataset.tab !== name; });
  }
  $$('.admin-tab').forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.dataset.tab); });
  });
  $$('[data-goto]').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.goto); });
  });

  /* ==================================================================
     DATA LOADING + DASHBOARD
     ================================================================== */
  async function refreshData() {
    if (!state.user) return;
    try {
      var data = await SETUP.fetchAdminData();
      state.services = data.services || [];
      state.gallery = data.gallery || [];
      state.settingsRow = data.settings;
      renderDashboard();
      renderGalleryAdmin();
      renderServicesAdmin();
      fillSettingsForm(state.settingsRow);
      $('#gal-refresh').disabled = false;
    } catch (err) {
      UI.toast('Could not load your data: ' + shortErr(err) + ' — if this persists, re-run supabase-setup.sql (README step 6).', 'err', 8000);
      $('#gallery-manage').innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><span class="big">😕</span><p>Could not load photos. ' + esc(shortErr(err)) + '</p></div>';
      $('#services-manage').innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><span class="big">😕</span><p>Could not load services. ' + esc(shortErr(err)) + '</p></div>';
    }
  }

  function renderDashboard() {
    var g = state.gallery, s = state.services;
    var published = g.filter(function (x) { return x.published; }).length;
    var active = s.filter(function (x) { return x.enabled !== false; }).length;
    var featured = g.filter(function (x) { return x.featured; }).length;

    $('#stat-total').textContent = g.length;
    $('#stat-total-sub').textContent = 'stored in Supabase';
    $('#stat-published').textContent = published;
    $('#stat-pub-sub').textContent = published ? 'Visible on the site' : 'Nothing published yet';
    $('#stat-services').textContent = s.length;
    $('#stat-svc-sub').textContent = active + ' of ' + (s.length || 0) + ' enabled';
    $('#stat-feat').textContent = featured;

    var recent = g.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 5);
    $('#recent-uploads').innerHTML = recent.length
      ? recent.map(function (r) {
          return '<img class="thumb" src="' + esc(r.image_url) + '" alt="' + esc(r.title) + '" loading="lazy" style="border-radius:14px;">';
        }).join('')
      : '<div class="empty-state" style="grid-column:1/-1; padding:18px;"><span class="big">📷</span><p>No uploads yet — your five latest photos will appear here.</p></div>';
    UI.guardImages($('#recent-uploads'));
  }

  $('#gal-refresh').addEventListener('click', function () {
    refreshData();
    UI.toast('Gallery refreshed.', 'info', 2200);
  });

  /* ==================================================================
     GALLERY — UPLOADS
     ================================================================== */
  function addFiles(files) {
    var added = 0;
    Array.prototype.slice.call(files || []).forEach(function (f) {
      if (!/^image\//.test(f.type)) { UI.toast(f.name + ' is not an image — skipped.', 'err'); return; }
      if (f.size > 12 * 1024 * 1024) { UI.toast(f.name + ' is over 12 MB — skipped.', 'err'); return; }
      state.pending.push({ id: 'f' + (++pid), file: f, url: URL.createObjectURL(f) });
      added++;
    });
    renderPending();
    if (added) UI.toast(added + ' photo' + (added > 1 ? 's' : '') + ' ready — check details, then press Upload.', 'info', 3600);
  }

  function renderPending() {
    $('#previews').innerHTML = state.pending.map(function (p) {
      return '<div><img src="' + p.url + '" alt="Preview of ' + esc(p.file.name) + '">' +
        '<button type="button" data-rm="' + p.id + '" aria-label="Remove ' + esc(p.file.name) + '">✕</button></div>';
    }).join('');
    var btn = $('#upload-btn');
    btn.disabled = !state.pending.length;
    btn.textContent = state.pending.length
      ? 'Upload ' + state.pending.length + ' Photo' + (state.pending.length > 1 ? 's' : '')
      : 'Upload Photos';
  }

  $('#previews').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]');
    if (!b) return;
    var id = b.getAttribute('data-rm');
    state.pending = state.pending.filter(function (p) {
      if (p.id === id) { URL.revokeObjectURL(p.url); return false; }
      return true;
    });
    renderPending();
  });

  var dz = $('#dropzone'), fi = $('#file-input');
  dz.addEventListener('click', function () { fi.click(); });
  dz.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
  });
  fi.addEventListener('change', function () { addFiles(fi.files); fi.value = ''; });
  ['dragover', 'dragenter'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('dragover'); });
  });
  dz.addEventListener('drop', function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });

  /* --- image compression (keeps uploads light + fast for visitors) --- */
  function compressImage(file) {
    var MAX_DIM = 1600, QUALITY = 0.85;
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
          if (scale === 1 && file.size < 600 * 1024) { URL.revokeObjectURL(url); resolve(file); return; }
          var w = Math.max(1, Math.round(img.naturalWidth * scale));
          var h = Math.max(1, Math.round(img.naturalHeight * scale));
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) { resolve(blob || file); }, 'image/jpeg', QUALITY);
        } catch (e) { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  /* --- XHR upload so we get real progress % (falls back to supabase-js) --- */
  function xhrUpload(url, blob, token, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = function () {
        if (xhr.status < 300) resolve();
        else reject(new Error('Storage error ' + xhr.status));
      };
      xhr.onerror = function () { reject(new Error('Network error during upload')); };
      var fd = new FormData();
      fd.append('file', blob, 'photo.jpg');
      xhr.send(fd);
    });
  }

  async function uploadBlob(client, session, blob, path, onProgress) {
    var base = '';
    try { base = (client.supabaseUrl || SETUP.SUPABASE_URL || '').replace(/\/+$/, ''); } catch (e) { base = ''; }
    if (base && session && session.access_token) {
      try {
        await xhrUpload(
          base + '/storage/v1/object/' + SETUP.BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/'),
          blob, session.access_token, onProgress
        );
        return;
      } catch (e) { /* fall back to the SDK upload below */ }
    }
    var r = await client.storage.from(SETUP.BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '31536000'
    });
    if (r.error) throw r.error;
    if (onProgress) onProgress(1);
  }

  function progressRow(i, name) {
    var row = document.createElement('div');
    row.className = 'progress-row';
    row.innerHTML = '<div>' + esc(String(i + 1) + '. ' + name) + '</div>' +
      '<div class="bar"><i></i></div><div class="mini status" style="color:var(--ink-faint);">Queued…</div>';
    $('#upload-progress').appendChild(row);
    return row;
  }
  function setProg(row, pct, label) {
    row.querySelector('.bar i').style.width = pct + '%';
    row.querySelector('.status').textContent = label || '';
  }

  $('#upload-btn').addEventListener('click', async function () {
    var btn = this;
    if (!state.pending.length) return;
    if (btn.disabled) return;
    var client;
    try { client = await SETUP.getClient(); }
    catch (e) { UI.toast('Supabase unavailable: ' + shortErr(e), 'err'); return; }

    var sessionRes = await client.auth.getSession();
    var session = sessionRes && sessionRes.data && sessionRes.data.session;
    if (!session) { UI.toast('Please sign in again.', 'err'); showAuth(); return; }

    var sharedTitle = $('#gal-title').value.trim();
    var sharedDesc = $('#gal-desc').value.trim();
    var category = $('#gal-category').value || 'Nude Nails';
    var published = $('#gal-pub').checked;
    var featured = $('#gal-feat').checked;

    // new photos go to the top of the gallery
    var minSort = 0;
    state.gallery.forEach(function (g) {
      if (typeof g.sort_order === 'number' && g.sort_order < minSort) minSort = g.sort_order;
    });
    var nextSort = minSort - 1;

    setLoading(btn, true, 'Uploading…');
    $('#upload-progress').innerHTML = '';
    var okCount = 0, failCount = 0;
    var total = state.pending.length;

    for (var i = 0; i < total; i++) {
      var entry = state.pending[i];
      var row = progressRow(i, entry.file.name);
      var uploadedPath = null;
      try {
        setProg(row, 12, 'Preparing…');
        var blob = await compressImage(entry.file);
        if (!(blob instanceof Blob)) blob = new Blob([blob], { type: blob.type || 'image/jpeg' });

        var safe = UI.slugify(entry.file.name);
        var path = session.user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe + '.jpg';

        setProg(row, 30, 'Uploading…');
        await uploadBlob(client, session, blob, path, function (p) {
          setProg(row, 30 + Math.round(p * 0.55), 'Uploading… ' + Math.round(p * 100) + '%');
        });
        uploadedPath = path;

        setProg(row, 90, 'Saving details…');
        var title = sharedTitle || entry.file.name.replace(/\.[^.]+$/, '');
        if (total > 1 && !sharedTitle) title = title + ' (' + (i + 1) + '/' + total + ')';

        var publicUrl = client.storage.from(SETUP.BUCKET).getPublicUrl(path).data.publicUrl;
        var ins = await client.from('gallery_items').insert({
          title: title.slice(0, 120),
          description: sharedDesc,
          category: category,
          image_url: publicUrl,
          storage_path: path,
          published: published,
          featured: featured,
          sort_order: nextSort--
        });
        if (ins.error) throw ins.error;

        okCount++;
        setProg(row, 100, 'Done ✓');
        row.classList.add('done');
      } catch (err) {
        failCount++;
        setProg(row, 100, '✕ Failed: ' + shortErr(err));
        row.classList.add('failed');
        // clean up the stored object if the metadata insert failed
        if (uploadedPath) {
          try { await client.storage.from(SETUP.BUCKET).remove([uploadedPath]); } catch (e) { /* best effort */ }
        }
      }
    }

    setLoading(btn, false, 'Upload Photos');
    if (okCount) {
      state.pending.forEach(function (p) { URL.revokeObjectURL(p.url); });
      state.pending = [];
      renderPending();
      ['gal-title', 'gal-desc'].forEach(function (id) { $('#' + id).value = ''; });
      $('#gal-feat').checked = false;
      await refreshData();
      UI.toast(okCount + ' photo' + (okCount > 1 ? 's' : '') + ' uploaded' + (failCount ? ' · ' + failCount + ' failed' : '') + ' ✓', failCount ? 'info' : 'ok', 5000);
    } else {
      UI.toast('Upload failed — check your connection and try again. (' + failCount + ' of ' + total + ' failed)', 'err', 6000);
    }
  });

  /* ==================================================================
     GALLERY — MANAGE LIST
     ================================================================== */
  function renderGalleryAdmin() {
    var wrap = $('#gallery-manage');
    var list = state.gallery;
    $('#gal-count').textContent = list.length;
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><span class="big">🌸</span><p>No photos yet. Upload your first set above — publish it and it appears on the public gallery instantly.</p></div>';
      return;
    }
    wrap.innerHTML = list.map(function (g, i) {
      return '<div class="manage-card">' +
        '<img class="thumb" src="' + esc(g.image_url) + '" alt="' + esc(g.title) + '" loading="lazy">' +
        '<h3>' + esc(g.title) + '</h3>' +
        (g.description ? '<p class="mini">' + esc(g.description) + '</p>' : '') +
        '<div class="chip-group">' +
          '<span class="tag">' + esc(g.category || '—') + '</span>' +
          '<span class="tag ' + (g.published ? 'tag-on' : 'tag-off') + '">' + (g.published ? '● Published' : '○ Unpublished') + '</span>' +
          (g.featured ? '<span class="tag tag-feat">★ Featured</span>' : '') +
        '</div>' +
        '<div class="manage-actions">' +
          '<label class="switch"><input type="checkbox" data-pub="' + g.id + '"' + (g.published ? ' checked' : '') + '><i></i>Live</label>' +
          '<label class="switch"><input type="checkbox" data-feat="' + g.id + '"' + (g.featured ? ' checked' : '') + '><i></i>★</label>' +
          '<button type="button" class="icon-btn" data-up="' + g.id + '" aria-label="Move earlier"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-down="' + g.id + '" aria-label="Move later"' + (i === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="icon-btn" data-edit="' + g.id + '" aria-label="Edit photo details">✎</button>' +
          '<button type="button" class="icon-btn" data-del="' + g.id + '" aria-label="Delete photo">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');
    UI.guardImages(wrap);
  }

  function findGallery(id) {
    var found = null;
    state.gallery.forEach(function (g) { if (String(g.id) === String(id)) found = g; });
    return found;
  }

  async function updateGalleryRow(id, patch, okMsg) {
    var client = await SETUP.getClient();
    var payload = Object.assign({ updated_at: new Date().toISOString() }, patch);
    var res = await client.from('gallery_items').update(payload).eq('id', id);
    if (res.error) {
      UI.toast('Could not update: ' + shortErr(res.error), 'err', 6000);
      await refreshData(); // revert to server state
      return false;
    }
    if (okMsg) UI.toast(okMsg, 'ok', 2600);
    await refreshData();
    return true;
  }

  $('#gallery-manage').addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches && t.matches('[data-pub]')) {
      updateGalleryRow(t.getAttribute('data-pub'), { published: t.checked }, t.checked ? 'Photo published ✓' : 'Photo hidden from the public gallery');
    } else if (t.matches && t.matches('[data-feat]')) {
      updateGalleryRow(t.getAttribute('data-feat'), { featured: t.checked });
    }
  });

  $('#gallery-manage').addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-edit]'))) openImgModal(b.getAttribute('data-edit'));
    else if ((b = e.target.closest('[data-del]'))) deleteGalleryRow(b.getAttribute('data-del'));
    else if ((b = e.target.closest('[data-up]'))) moveRow('gallery_items', b.getAttribute('data-up'), -1);
    else if ((b = e.target.closest('[data-down]'))) moveRow('gallery_items', b.getAttribute('data-down'), 1);
  });

  async function deleteGalleryRow(id) {
    var row = findGallery(id);
    if (!row) return;
    var ok = await confirmDialog('Delete “' + row.title + '”? This also removes the photo file from storage. This cannot be undone.');
    if (!ok) return;
    var client = await SETUP.getClient();
    if (row.storage_path) {
      try {
        var rm = await client.storage.from(SETUP.BUCKET).remove([row.storage_path]);
        if (rm.error && !/not found|does not exist/i.test(rm.error.message || '')) throw rm.error;
      } catch (err) {
        UI.toast('Could not remove the file: ' + shortErr(err) + ' — the gallery entry was not deleted.', 'err', 7000);
        return;
      }
    }
    var res = await client.from('gallery_items').delete().eq('id', id);
    if (res.error) { UI.toast('Could not delete: ' + shortErr(res.error), 'err', 6000); return; }
    UI.toast('Photo deleted.', 'ok', 2600);
    refreshData();
  }

  /* --- photo edit modal --- */
  function openImgModal(id) {
    var g = findGallery(id);
    if (!g) return;
    state.editingImgId = g.id;
    $('#im-thumb').src = g.image_url;
    $('#im-title').value = g.title || '';
    $('#im-desc').value = g.description || '';
    $('#im-category').value = g.category || S.GALLERY_CATEGORIES[0];
    $('#im-feat').checked = !!g.featured;
    $('#im-msg').textContent = '';
    UI.openModal($('#img-modal'));
  }

  $('#im-save').addEventListener('click', async function () {
    if (!state.editingImgId) return;
    var title = $('#im-title').value.trim();
    if (!title) { $('#im-msg').textContent = 'Please give this photo a title.'; return; }
    setLoading($('#im-save'), true, 'Saving…');
    var ok = await updateGalleryRow(state.editingImgId, {
      title: title,
      description: $('#im-desc').value.trim(),
      category: $('#im-category').value,
      featured: $('#im-feat').checked
    }, 'Photo updated ✓');
    setLoading($('#im-save'), false, 'Save Changes');
    if (ok) UI.closeModal($('#img-modal'));
  });

  /* ==================================================================
     ROW ORDERING (shared by gallery & services)
     ================================================================== */
  async function moveRow(table, id, dir) {
    var list = table === 'gallery_items' ? state.gallery : state.services;
    var idx = -1;
    list.forEach(function (r, i) { if (String(r.id) === String(id)) idx = i; });
    var other = list[idx + dir];
    if (idx < 0 || !other) return;

    var a = list[idx], b = other;
    var ao = typeof a.sort_order === 'number' ? a.sort_order : 1000 + idx;
    var bo = typeof b.sort_order === 'number' ? b.sort_order : ao + 1;
    if (ao === bo) { // duplicate orders → renumber the whole list first
      list.forEach(function (r, i) { r.sort_order = i + 1; });
      ao = a.sort_order; bo = b.sort_order;
    }
    var client = await SETUP.getClient();
    var res = await client.from(table).upsert([
      Object.assign({ id: a.id, sort_order: bo }, table === 'services' ? { updated_at: new Date().toISOString() } : {}),
      Object.assign({ id: b.id, sort_order: ao }, table === 'services' ? { updated_at: new Date().toISOString() } : {})
    ]);
    if (res.error) { UI.toast('Could not reorder: ' + shortErr(res.error), 'err', 6000); return; }
    refreshData();
  }

  /* ==================================================================
     SERVICES
     ================================================================== */
  function renderServicesAdmin() {
    var wrap = $('#services-manage');
    var list = state.services;
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state glass-card" style="grid-column:1/-1;"><span class="big">💅</span><p>No services in Supabase yet — the public site is showing the starter set from config.js. Add your first service to take over.</p></div>';
      return;
    }
    wrap.innerHTML = list.map(function (sv, i) {
      var addons = Array.isArray(sv.addons) ? sv.addons : [];
      return '<div class="manage-card">' +
        (sv.cover_url ? '<img class="thumb" src="' + esc(sv.cover_url) + '" alt="' + esc(sv.name) + ' cover" loading="lazy">' : '') +
        '<h3>' + esc(sv.name) + '</h3>' +
        '<p class="mini">' + fmt(sv.price) + ' starting · ' + esc(sv.duration || 'no duration set') + '</p>' +
        (sv.description ? '<p class="mini">' + esc(sv.description) + '</p>' : '') +
        '<div class="chip-group">' +
          '<span class="tag">' + esc(sv.category || 'All only') + '</span>' +
          '<span class="tag ' + (sv.enabled !== false ? 'tag-on' : 'tag-off') + '">' + (sv.enabled !== false ? '● Enabled' : '○ Hidden') + '</span>' +
          (sv.featured ? '<span class="tag tag-feat">★ Featured</span>' : '') +
          (addons.length ? '<span class="tag">' + addons.length + ' add-on' + (addons.length > 1 ? 's' : '') + '</span>' : '') +
        '</div>' +
        '<div class="manage-actions">' +
          '<label class="switch"><input type="checkbox" data-svc-on="' + sv.id + '"' + (sv.enabled !== false ? ' checked' : '') + '><i></i>On site</label>' +
          '<label class="switch"><input type="checkbox" data-svc-feat="' + sv.id + '"' + (sv.featured ? ' checked' : '') + '><i></i>★</label>' +
          '<button type="button" class="icon-btn" data-svc-up="' + sv.id + '" aria-label="Move earlier"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icon-btn" data-svc-down="' + sv.id + '" aria-label="Move later"' + (i === list.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="icon-btn" data-svc-edit="' + sv.id + '" aria-label="Edit service">✎</button>' +
          '<button type="button" class="icon-btn" data-svc-del="' + sv.id + '" aria-label="Delete service">🗑</button>' +
        '</div>' +
      '</div>';
    }).join('');
    UI.guardImages(wrap);
  }

  function findService(id) {
    var found = null;
    state.services.forEach(function (s) { if (String(s.id) === String(id)) found = s; });
    return found;
  }

  $('#services-manage').addEventListener('change', async function (e) {
    var t = e.target;
    if (!(t.matches && (t.matches('[data-svc-on]') || t.matches('[data-svc-feat]')))) return;
    var id = t.getAttribute('data-svc-on') || t.getAttribute('data-svc-feat');
    var patch = t.matches('[data-svc-on]') ? { enabled: t.checked } : { featured: t.checked };
    var client = await SETUP.getClient();
    patch.updated_at = new Date().toISOString();
    var res = await client.from('services').update(patch).eq('id', id);
    if (res.error) { UI.toast('Could not update: ' + shortErr(res.error), 'err', 6000); await refreshData(); return; }
    UI.toast('Service updated ✓', 'ok', 2200);
    refreshData();
  });

  $('#services-manage').addEventListener('click', async function (e) {
    var b;
    if ((b = e.target.closest('[data-svc-edit]'))) {
      openSvcModal(findService(b.getAttribute('data-svc-edit')));
    } else if ((b = e.target.closest('[data-svc-del]'))) {
      var sv = findService(b.getAttribute('data-svc-del'));
      if (!sv) return;
      var ok = await confirmDialog('Delete service “' + sv.name + '”? It will disappear from the public site.');
      if (!ok) return;
      var client = await SETUP.getClient();
      var res = await client.from('services').delete().eq('id', sv.id);
      if (res.error) { UI.toast('Could not delete: ' + shortErr(res.error), 'err', 6000); return; }
      UI.toast('Service deleted.', 'ok', 2600);
      refreshData();
    } else if ((b = e.target.closest('[data-svc-up]'))) {
      moveRow('services', b.getAttribute('data-svc-up'), -1);
    } else if ((b = e.target.closest('[data-svc-down]'))) {
      moveRow('services', b.getAttribute('data-svc-down'), 1);
    }
  });

  /* --- service modal --- */
  function addonRowEl(label, price) {
    var div = document.createElement('div');
    div.style.cssText = 'display:grid;grid-template-columns:1fr 110px 44px;gap:8px;align-items:center;';
    div.innerHTML =
      '<input class="input addon-label-in" placeholder="Add-on name (e.g. Chrome finish)" maxlength="60">' +
      '<input class="input addon-price-in" type="number" min="0" step="50" inputmode="numeric" placeholder="KSh">' +
      '<button type="button" class="icon-btn addon-del" aria-label="Remove this add-on">✕</button>';
    div.querySelector('.addon-label-in').value = label || '';
    div.querySelector('.addon-price-in').value = (price != null && price !== '') ? price : '';
    div.querySelector('.addon-del').addEventListener('click', function () { div.remove(); });
    return div;
  }

  function openSvcModal(svc) {
    state.editingSvcId = svc ? svc.id : null;
    $('#svc-modal-title').textContent = svc ? 'Edit service' : 'Add service';
    $('#svc-name').value = svc ? svc.name : '';
    $('#svc-category').value = svc ? (svc.category || '') : '';
    $('#svc-price').value = svc ? svc.price : '';
    $('#svc-duration').value = svc ? (svc.duration || '') : '';
    $('#svc-desc').value = svc ? (svc.description || '') : '';
    $('#svc-cover').value = svc ? (svc.cover_url || '') : '';
    $('#svc-order').value = svc && svc.sort_order != null ? svc.sort_order : '';
    $('#svc-enabled').checked = svc ? svc.enabled !== false : true;
    $('#svc-feat').checked = svc ? !!svc.featured : false;
    var wrap = $('#addon-rows');
    wrap.innerHTML = '';
    (svc && Array.isArray(svc.addons) ? svc.addons : []).forEach(function (a) {
      if (a && a.label != null) wrap.appendChild(addonRowEl(a.label, a.price));
    });
    $('#svc-msg').textContent = '';
    UI.openModal($('#svc-modal'));
    setTimeout(function () { $('#svc-name').focus(); }, 80);
  }

  $('#add-service-btn').addEventListener('click', function () { openSvcModal(null); });
  $('#addon-add').addEventListener('click', function () {
    $('#addon-rows').appendChild(addonRowEl('', ''));
  });

  $('#svc-save').addEventListener('click', async function () {
    var msg = $('#svc-msg');
    msg.textContent = '';
    var name = $('#svc-name').value.trim();
    var price = Number($('#svc-price').value);
    var cover = $('#svc-cover').value.trim();
    var errs = [];
    if (name.length < 2) errs.push('a service name (2+ characters)');
    if (!isFinite(price) || price < 0) errs.push('a starting price (KSh 0 or more)');
    if (cover && !/^https?:\/\//i.test(cover)) errs.push('a cover photo URL starting with http(s)://');
    if (errs.length) { msg.textContent = 'Please provide ' + errs.join(' and ') + '.'; return; }

    var addons = Array.prototype.map.call($('#addon-rows').children, function (row) {
      return {
        label: row.querySelector('.addon-label-in').value.trim(),
        price: Number(row.querySelector('.addon-price-in').value)
      };
    }).filter(function (a) { return a.label && isFinite(a.price) && a.price >= 0; });

    var payload = {
      name: name,
      price: Math.round(price),
      category: $('#svc-category').value || null,
      duration: $('#svc-duration').value.trim() || null,
      description: $('#svc-desc').value.trim(),
      cover_url: cover || null,
      addons: addons,
      enabled: $('#svc-enabled').checked,
      featured: $('#svc-feat').checked,
      updated_at: new Date().toISOString()
    };
    var orderVal = $('#svc-order').value;
    if (orderVal !== '' && isFinite(Number(orderVal))) payload.sort_order = Number(orderVal);

    var btn = $('#svc-save');
    setLoading(btn, true, 'Saving…');
    try {
      var client = await SETUP.getClient();
      if (state.editingSvcId) {
        var res = await client.from('services').update(payload).eq('id', state.editingSvcId);
        if (res.error) throw res.error;
      } else {
        if (payload.sort_order == null) {
          var max = 0;
          state.services.forEach(function (s) { if ((s.sort_order || 0) > max) max = s.sort_order; });
          payload.sort_order = max + 1;
        }
        var ins = await client.from('services').insert(payload);
        if (ins.error) throw ins.error;
      }
      UI.closeModal($('#svc-modal'));
      UI.toast('Service saved — the public site is already updated ✓', 'ok', 4200);
      refreshData();
    } catch (err) {
      msg.textContent = 'Could not save: ' + shortErr(err);
    } finally {
      setLoading(btn, false, 'Save Service');
    }
  });

  /* ==================================================================
     BUSINESS SETTINGS
     ================================================================== */
  function fillSettingsForm(row) {
    var v = row || {};
    $('#st-name').value = v.businessName || '';
    $('#st-logo').value = v.logoUrl || '';
    $('#st-wa').value = v.whatsappNumber || '';
    $('#st-ig').value = v.instagramUsername || '';
    $('#st-location').value = v.studioLocation || '';
    $('#st-areas').value = v.houseCallAreas || '';
    $('#st-transport').value = v.transportFee || '';
    $('#st-hours').value = v.businessHours || '';
    $('#st-instructions').value = v.bookingInstructions || '';
    $('#st-disclaimer').value = v.bookingDisclaimer || '';
    $('#settings-source-hint').textContent = row
      ? 'These values are live — they override config.js on the public site.'
      : 'Nothing saved yet — these are the config.js defaults. Press Save to take over.';
  }

  $('#settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('#settings-msg');
    msg.textContent = '';
    var wa = $('#st-wa').value.replace(/\D/g, '');
    if (wa && !/^[0-9]{9,15}$/.test(wa)) {
      msg.className = 'form-msg err';
      msg.textContent = 'WhatsApp must be digits only in international format, e.g. 254712345678 (no +, spaces or leading 0).';
      return;
    }
    var logo = $('#st-logo').value.trim();
    if (logo && !/^https?:\/\//i.test(logo)) {
      msg.className = 'form-msg err';
      msg.textContent = 'Logo must be an image URL starting with http(s)://';
      return;
    }
    var settings = {
      businessName: $('#st-name').value.trim() || 'Mrembo Nails',
      logoUrl: logo,
      whatsappNumber: wa,
      instagramUsername: $('#st-ig').value.trim().replace(/^@/, ''),
      studioLocation: $('#st-location').value.trim(),
      houseCallAreas: $('#st-areas').value.trim(),
      transportFee: $('#st-transport').value.trim(),
      businessHours: $('#st-hours').value.trim(),
      bookingInstructions: $('#st-instructions').value.trim(),
      bookingDisclaimer: $('#st-disclaimer').value.trim()
    };
    setLoading($('#settings-save'), true, 'Saving…');
    try {
      var client = await SETUP.getClient();
      var res = await client.from('business_settings').upsert({
        id: 1,
        owner_id: state.user.id,
        settings: settings,
        updated_at: new Date().toISOString()
      });
      if (res.error) throw res.error;
      msg.className = 'form-msg ok';
      msg.textContent = 'Saved — changes are live on the public site ✓';
      UI.toast('Settings saved ✓', 'ok');
      refreshData();
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = 'Could not save: ' + shortErr(err);
    } finally {
      setLoading($('#settings-save'), false, '💾 Save Settings');
    }
  });

  $('#settings-reset').addEventListener('click', async function () {
    var ok = await confirmDialog('Reset these settings to the config.js defaults? The saved record in Supabase will be deleted.');
    if (!ok) return;
    try {
      var client = await SETUP.getClient();
      var res = await client.from('business_settings').delete().eq('id', 1);
      if (res.error) throw res.error;
      UI.toast('Settings reset to config.js defaults.', 'ok');
      refreshData();
    } catch (err) {
      UI.toast('Could not reset: ' + shortErr(err), 'err', 6000);
    }
  });

  /* ==================================================================
     ACCOUNT
     ================================================================== */
  $('#pw-save').addEventListener('click', async function () {
    var msg = $('#pw-msg');
    msg.className = 'form-msg';
    var pw = $('#pw-new').value;
    if (!pw || pw.length < 8) {
      msg.className = 'form-msg err';
      msg.textContent = 'Use at least 8 characters.';
      return;
    }
    setLoading($('#pw-save'), true, 'Updating…');
    try {
      var client = await SETUP.getClient();
      var res = await client.auth.updateUser({ password: pw });
      if (res.error) throw res.error;
      msg.className = 'form-msg ok';
      msg.textContent = 'Password updated ✓';
      $('#pw-new').value = '';
      UI.toast('Password updated ✓', 'ok');
    } catch (err) {
      msg.className = 'form-msg err';
      msg.textContent = shortErr(err);
    } finally {
      setLoading($('#pw-save'), false, 'Update Password');
    }
  });

  /* ==================================================================
     CONFIRM DIALOG
     ================================================================== */
  function confirmDialog(text) {
    return new Promise(function (resolve) {
      pendingConfirm = resolve;
      $('#confirm-text').textContent = text;
      UI.openModal($('#confirm-modal'));
    });
  }
  $('#confirm-ok').addEventListener('click', function () {
    UI.closeModal($('#confirm-modal'));
    if (pendingConfirm) { pendingConfirm(true); pendingConfirm = null; }
  });
  $('#confirm-modal').addEventListener('ui:modalclosed', function () {
    if (pendingConfirm) { pendingConfirm(false); pendingConfirm = null; }
  });

  /* ==================================================================
     BOOT
     ================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    UI.initModals();

    // category selects
    $('#gal-category').innerHTML = S.GALLERY_CATEGORIES.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
    $('#im-category').innerHTML = $('#gal-category').innerHTML;
    $('#svc-category').innerHTML =
      '<option value="">— No category (shows only under “All”) —</option>' +
      S.SERVICE_CATEGORIES.map(function (c) {
        return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
      }).join('');

    boot();
  });
})();
