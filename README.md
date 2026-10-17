# 💅 Mrembo Nails — Luxury Nail Booking Website

A beautiful, feminine, mobile-first booking site for a nail technician in Kenya —
built with **plain HTML + CSS + vanilla JavaScript** (no frameworks, no build
step), styled with iOS-inspired **glassmorphism**, and powered by **Supabase**
(authentication, photo storage, database) hosted free on **Netlify**.

| Page | Purpose |
|---|---|
| `index.html` | Public landing page — services & KSh prices, gallery, house calls, WhatsApp booking |
| `admin.html` | Private owner dashboard — login, photo uploads, price editing, business settings |

---

## ✅ 0. What the owner must configure before launch

Do these **once**, in order. Details for every step are below.

1. **`supabase.js`** — paste your Supabase **Project URL** and the **anon/publishable key**.
2. **`config.js` → `DEFAULT_SETTINGS.whatsappNumber`** — Kenyan international format:
   `254712345678` (no `+`, no spaces, no leading zero).
3. **`config.js` → `DEFAULT_SETTINGS.instagramUsername`** — your real handle.
4. Run **`supabase-setup.sql`** once in the Supabase SQL editor (creates tables + security policies).
5. Create your **owner account** in the Supabase dashboard (email + password).
6. Run **`supabase-migrate-2.sql`** in the SQL editor — registers your owner account in the
   `app_owners` whitelist, adds gallery **source** tracking (upload / AI / external) and locks
   all writes to whitelisted owners.
7. Log in at **`/admin.html`**, upload your real nail photos, adjust services/prices, save business settings.
8. Deploy to Netlify and add the URL to your **Linktree**.

> Everything in step 7 can also be edited later without touching code.

---

## 🚀 1. Open the public website locally

No build step and no local server is required — it's plain static files:

- Double-click `index.html`, **or**
- Serve the folder (`npx serve .`, `python -m http.server`, or VS Code “Live Server”).

> Tip: until you finish step 4–5, the site runs in **demo mode** — it shows the
> starter services, gallery and copy from `config.js`, and the admin page
> explains that Supabase isn’t configured yet.

## 🗄 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier is fine).
2. Choose a name (e.g. `mrembo-nails`), a strong **database password** (store it in your
   password manager — it never goes in this code), and a region close to Kenya (e.g. `eu-central-1`).
3. When the project is ready open **Project Settings → API**:
   - copy the **Project URL** → paste into `supabase.js` (`SUPABASE_URL`);
   - copy the **anon / publishable** key → paste into `supabase.js` (`SUPABASE_ANON_KEY`).

> 🔒 The **anon key is safe to ship to browsers** — it is a *publishable* key.
> It can never read unpublished photos or change data, because every table and
> bucket is locked with **Row Level Security** (step 4).
> **Never** put the *service-role* key, the database password, or any account
> password into any file in this project.

## 🔐 3. Configure authentication

In the Supabase dashboard → **Authentication**:

1. **Providers → Email**: leave *Email* enabled. Keep **Confirm email** ON for
   password recovery to work.
2. **Providers → Email → Disable new users / Sign ups**: turn public sign-up **OFF**.
   Only you will ever have an account — this is the “controlled setup” that
   replaces a registration page.
3. **URL Configuration → Site URL**: set it to your final Netlify URL
   (e.g. `https://mrembonails.netlify.app`). Add `http://localhost:…` /
   `http://127.0.0.1:5500` under *Redirect URLs* if you test locally.

## 🧱 4. Create the tables & access policies

1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of **`supabase-setup.sql`** → **Run**.
3. You should see “Success”. The script creates:
   - `services` — the price list (name, KSh price, duration, add-ons, category, order…)
   - `gallery_items` — photo metadata + `published` / `featured` flags + `source`
   - `business_settings` — one JSON row with your business identity
   - **RLS policies**: anonymous visitors can only *read* enabled services,
     published photos and settings; only the authenticated owner can write;
     storage uploads are restricted to the owner’s own folder.
4. Then create your owner account (step 5) and run **`supabase-migrate-2.sql`**:
   it seeds the `app_owners` whitelist with every account that exists at that
   moment (normally just yours), adds `public.is_owner()`, and rewrites all
   write policies so **only whitelisted owners may write** — a different
   signed-in account gets “permission denied” from RLS.
   To add another owner later, run in the SQL editor:
   `insert into public.app_owners (user_id) values ('<their user id>'::uuid);`

## 👤 5. Create the owner’s account securely

1. Supabase dashboard → **Authentication → Users → Add user → Create new user**.
2. Enter your email + a strong password (8+ characters) and tick **Auto Confirm User**.
3. Open `admin.html` and log in with those credentials.
4. Forgot the password later? Use **“Forgot password?”** on the login screen —
   Supabase emails a reset link (this is why email confirmations stay enabled).
5. You can also change the password anytime in **admin → Settings → Account**.

## 🖼 6. Storage bucket (created automatically)

`supabase-setup.sql` already created the **public** bucket `nail-photos` and its
policies:

- **read**: everyone (needed so published photos render on the site),
- **insert / update / delete**: only the signed-in owner, and only inside
  `nail-photos/<owner-uid>/…` (the dashboard always uploads there).

Nothing to do manually — the step exists so you can verify it under
**Storage** in the dashboard.

## ⚙ 7. Business configuration

Fastest path: log into `admin.html` → **Settings** tab → fill in business name,
WhatsApp number, Instagram, location, service areas, transport fee, hours and
booking instructions → **Save**. These override `config.js` on the public site
instantly.

The **Homepage & public text** part of the Settings tab controls everything
visitors read: hero headline & subtitle, both hero button labels, section
headings and sub-copy (services / gallery / house calls / booking), the promo
band, the search-engine description, the footer note (`{year}` and `{brand}`
tokens work), plus **show / hide switches** for the gallery section, the
house-call panel and the promo band.

Alternatively edit `config.js` directly — it is the fallback source of truth.

## 🖼 7b. Photo sources (uploads, AI images, external links)

The Gallery tab lets you choose what each photo **is**:

- **☁ Upload from my device** — stored in Supabase Storage, fully managed
  (publish, edit, reorder, replace, delete — deletion also removes the file).
- **✨ Upload AI-generated art** — same as an upload, but tagged
  `ai_generated` so you can find AI sets later. Generate the image in any AI
  tool you like, then upload it here. (If you later connect a generation API,
  `admin.js` is the single integration point: reuse the normal upload path.)
- **🔗 Publish an external image URL** — the photo lives somewhere else; only
  your gallery record is stored. Deleting removes your record, **not** the
  hosted file.

Every photo also supports **🔄 Replace** — upload a new file over the same
record; the old file is removed from storage, the record keeps its identity
(add-ons of the record: title, category, published state).

If the database still predates migration 2 (no `source` column), uploads keep
working and simply skip the source tag — run `supabase-migrate-2.sql` to enable it.

## 🌍 8. Deploy to Netlify (free)

**Option A — drag & drop (easiest):**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) (sign in free).
2. Drag the **`nail-booking` folder** onto the page → done, you get a live URL.
   Rename it under *Site settings → Change site name* (e.g. `mrembonails.netlify.app`).

**Option B — GitHub (auto-deploys on every change):**
1. Push this folder to a GitHub repository (`.gitignore` is already provided).
2. Netlify → **Add new site → Import an existing project** → pick the repo →
   leave build command **empty** and publish directory as `.` → Deploy.

After the first deploy, update **Authentication → Site URL** (step 3) to the
final https URL so password-reset links point at the right page.

## 🔗 9. Add it to Linktree / Instagram bio

1. Copy your Netlify URL (e.g. `https://mrembonails.netlify.app`).
2. In Linktree → **Add Link** → paste the URL → title “💅 Book Your Nails”.
3. That’s it — Linktree should **link out** to the website (never embed it).
   Visitors land on `index.html` directly: no login, no pop-ups, and the
   booking buttons work on mobile and desktop.

## 🧪 10. Testing checklist

**Public site (`index.html`)**
- [ ] Loads fast on mobile data; hero CTA visible without scrolling
- [ ] Prices show in **KSh** on every card and in the modal
- [ ] Category filters (All / Gel / Acrylic / French Tips / Natural Nails / Nail Art) work
- [ ] **View Details** opens the modal; add-on ticks change the estimated total
- [ ] Modal closes via ✕, backdrop click **and** Escape; page scroll locks while open
- [ ] Gallery filters work; clicking a photo opens the **lightbox** (← → Esc, zoom)
- [ ] Booking form validates empty fields and future date; summary renders
- [ ] **Send Booking via WhatsApp** opens `wa.me` with a fully prefilled message
- [ ] “Request a House Call” pre-selects house call and includes area/transport info
- [ ] Instagram button opens the configured profile
- [ ] Works before Supabase setup (demo mode) **and** after (live data)

**Admin (`admin.html`)**
- [ ] Without the anon key: shows a clear “not configured” message
- [ ] While the session is being checked, a “One moment…” loading card shows (no login flash)
- [ ] Wrong password shows a friendly error; correct login opens the dashboard
- [ ] The dashboard *stays* after login — it must not snap back to the login page
- [ ] Logout returns to the login screen; session survives refreshes and new tabs
- [ ] Upload 2–3 photos → progress bars → they appear in “Your photos”
- [ ] Search box & source filter narrow the photo list
- [ ] **Unpublished** photo does **not** appear on the public site; publishing it makes it appear
- [ ] Edit title/category/featured; reorder with ↑/↓; 🔄 replace keeps the record but swaps the file
- [ ] Delete removes it from the site *and* storage (external-linked photos only remove your record)
- [ ] Change a price → public site shows the new price after a refresh (no code edits)
- [ ] Settings save → public site reflects new name/hours/areas/headings
- [ ] Disable a service → it disappears from the public site

**Security (test as a visitor, e.g. in a private window)**
- [ ] `supabase.com` → Table editor: try editing as anon — blocked by RLS
- [ ] Supabase Storage: anonymous upload to `nail-photos/<any-uid>/` → denied
- [ ] No service-role key, database password or owner password anywhere in the repo
- [ ] `admin.html` is **not** linked in the public navigation

## 📁 Project structure

```
nail-booking/
├── index.html          public landing page
├── admin.html          owner dashboard (noindex)
├── styles.css          shared styling (glassmorphism + admin)
├── script.js           public interactions
├── admin.js            dashboard, uploads & settings logic
├── config.js           👑 business configuration + starter data
├── supabase.js         Supabase client init + data helpers
├── ui.js               shared helpers (toasts, modals, formatting)
├── supabase-setup.sql    tables, RLS policies, storage bucket
├── supabase-migrate-2.sql owner whitelist (app_owners), source tracking
├── assets/
│   ├── favicon.svg
│   └── placeholder.svg graceful image fallback
└── .gitignore
```

## ❓ Troubleshooting

| Symptom | Fix |
|---|---|
| “Supabase is not configured yet” on admin | Paste URL + anon key into `supabase.js`, reload |
| Login keeps returning to the login page by itself | Fixed in admin.js (single auth lifecycle). If you ever see it again, check the browser console for `[mrembo-auth]` lines and report |
| Public site shows starter data even though you edited things in admin | The database fetch failed — open the browser console; usually a wrong URL/key or `supabase-setup.sql` not run. Also verify the fetch didn’t fall back: the console shows `[Mrembo] public content fetch failed` in that case |
| Upload says “source tagging needs migration 2” | Run `supabase-migrate-2.sql` in the SQL editor — adds the `source` column and the owner whitelist |
| After running migration 2, uploads fail with permission denied | Your login account was created *after* the migration ran — add it: `insert into public.app_owners (user_id) values ('<id>'::uuid);` |
| Uploads fail with a permission error | Re-run `supabase-setup.sql`, confirm the bucket `nail-photos` exists and you are logged in |
| WhatsApp button scrolls but doesn’t open WhatsApp | Set a valid `whatsappNumber` (`2547…`, digits only) |
| Reset email never arrives | Check **Authentication → Email** and your spam folder; free Supabase projects have a small daily email quota |
| Fonts/photos don’t load offline | They’re served from CDNs (Google Fonts / Unsplash samples) — normal on a static site, and everything has fallbacks |

## 🛡 Security notes

- Only the **publishable anon key** is in browser code; all permissions are
  enforced server-side by RLS + storage policies — never by hiding buttons.
- Passwords are handled exclusively by Supabase Auth (bcrypt, rate-limiting,
  recovery flow). No password ever touches this codebase.
- Uploaded files use unique paths (`<owner-uid>/<timestamp>-<random>-<name>.jpg`),
  client-side compression keeps them light, and deletions clean up storage too.
- **Owner whitelist**: after `supabase-migrate-2.sql`, table & storage writes
  require membership in `app_owners` — a stray authenticated account (even one
  created by you or an invite) cannot modify content.
- Unpublished photos are hidden from the public gallery by policy. (Their raw
  file URL remains technically guessable since the bucket is public-read —
  standard for public-image buckets; the metadata/privacy layer is what the
  site relies on. Switch the bucket to private + signed URLs if you need
  cryptographic privacy.)
- No cookies beyond Supabase’s own auth session; no analytics or trackers.
