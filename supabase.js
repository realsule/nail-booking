/* ==========================================================================
   Mrembo Nails — Supabase client initialisation (browser side)
   --------------------------------------------------------------------------
   👑 OWNER CONFIGURATION (required for uploads/login to work):
      1. Create a free project at https://supabase.com
      2. Project Settings → API → copy the "Project URL"
      3. Copy the **anon / publishable** key (NOT the service-role key)
      4. Paste both below between the quotes.

   Only the publishable/anonymous key may live in browser code — and only
   because supabase-setup.sql locks every table & bucket down with RLS
   policies so anonymous visitors can read published content and change
   nothing.
   ========================================================================== */
(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';      // 👑 paste your Project URL
  var SUPABASE_ANON_KEY = 'YOUR-PUBLISHABLE-ANON-KEY';            // 👑 paste your anon key (starts with "eyJ…")

  var BUCKET = 'nail-photos';      // public storage bucket created by supabase-setup.sql
  var STORAGE_KEY = 'mrembo-nails-auth'; // avoids clashing with other apps on this domain
  var TABLES = { services: 'services', gallery: 'gallery_items', settings: 'business_settings' };

  var clientPromise = null;

  function isConfigured() {
    var tpl = /YOUR-|PASTE|PROJECT-REF/i;
    return !tpl.test(SUPABASE_URL) && !tpl.test(SUPABASE_ANON_KEY);
  }

  /** Returns a Promise<SupabaseClient|null>. null ⇒ not configured yet. */
  function getClient() {
    if (!isConfigured()) return Promise.resolve(null);
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      return Promise.reject(new Error('Supabase JS library did not load — check your internet connection / CDN.'));
    }
    if (!clientPromise) {
      clientPromise = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,   // handles password-recovery links landing on /admin.html
          storageKey: STORAGE_KEY
        }
      });
    }
    return clientPromise;
  }

  /* ------------------------------------------------------------------
     Public-page read helpers (called by script.js).
     All reads respect RLS: only enabled services & published images.
     ------------------------------------------------------------------ */
  async function fetchPublicContent() {
    var empty = { settings: null, services: [], gallery: [] };
    var client = await getClient().catch(function () { return null; });
    if (!client) return Object.assign({ usedSupabase: false }, empty);
    try {
      var results = await Promise.all([
        client.from(TABLES.settings).select('settings').eq('id', 1).maybeSingle(),
        client.from(TABLES.services).select('*')
          .eq('enabled', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        client.from(TABLES.gallery).select('*')
          .eq('published', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      ]);
      var failed = results.find(function (r) { return r.error; });
      if (failed) throw failed.error;
      return {
        usedSupabase: true,
        settings: (results[0].data && results[0].data.settings) || null,
        services: results[1].data || [],
        gallery: results[2].data || []
      };
    } catch (err) {
      console.warn('[Mrembo] public content fetch failed — falling back to config.js defaults.', err); // no tokens logged
      return Object.assign({ usedSupabase: false }, empty);
    }
  }

  /* ------------------------------------------------------------------
     Admin-page read helper (called by admin.js after the owner logs in).
     Returns ALL rows — RLS releases unpublished/private rows only to the
     authenticated owner.
     ------------------------------------------------------------------ */
  async function fetchAdminData() {
    var client = await getClient();
    var results = await Promise.all([
      client.from(TABLES.services).select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      client.from(TABLES.gallery).select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      client.from(TABLES.settings).select('*').eq('id', 1).maybeSingle()
    ]);
    var err = results.find(function (r) { return r.error; });
    if (err) throw err.error;
    return {
      services: results[0].data || [],
      gallery: results[1].data || [],
      settings: results[2].data ? results[2].data.settings : null
    };
  }

  global.SUPABASE_SETUP = {
    SUPABASE_URL: SUPABASE_URL,
    getClient: getClient,
    isConfigured: isConfigured,
    fetchPublicContent: fetchPublicContent,
    fetchAdminData: fetchAdminData,
    BUCKET: BUCKET,
    STORAGE_KEY: STORAGE_KEY,
    TABLES: TABLES
  };
})(window);
