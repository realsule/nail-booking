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
6. Log in at **`/admin.html`**, upload your real nail photos, adjust services/prices, save business settings.
7. Deploy to Netlify and add the URL to your **Linktree**.

> Everything in step 6 can also be edited later without touching code.

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
   - `gallery_items` — photo metadata + `published` / `featured` flags
   - `business_settings` — one JSON row with your business identity
   - **RLS policies**: anonymous visitors can only *read* enabled services,
     published photos and settings; only the authenticated owner can write;
     storage uploads are restricted to the owner’s own folder.

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

Alternatively edit `config.js` directly — it is the fallback source of truth.

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
- [ ] Wrong password shows a friendly error; correct login opens the dashboard
- [ ] Logout returns to the login screen; session survives a refresh
- [ ] Upload 2–3 photos → progress bars → they appear in “Your photos”
- [ ] **Unpublished** photo does **not** appear on the public site; publishing it makes it appear
- [ ] Edit title/category/featured; reorder with ↑/↓; delete removes it from the site *and* storage
- [ ] Change a price → public site shows the new price after a refresh (no code edits)
- [ ] Settings save → public site reflects new name/hours/areas
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
├── supabase-setup.sql  tables, RLS policies, storage bucket
├── assets/
│   ├── favicon.svg
│   └── placeholder.svg graceful image fallback
└── .gitignore
```

## ❓ Troubleshooting

| Symptom | Fix |
|---|---|
| “Supabase is not configured yet” on admin | Paste URL + anon key into `supabase.js`, reload |
| Public site shows starter data even though you edited things in admin | The database fetch failed — open the browser console; usually a wrong URL/key or `supabase-setup.sql` not run |
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
- Unpublished photos are hidden from the public gallery by policy. (Their raw
  file URL remains technically guessable since the bucket is public-read —
  standard for public-image buckets; the metadata/privacy layer is what the
  site relies on. Switch the bucket to private + signed URLs if you need
  cryptographic privacy.)
- No cookies beyond Supabase’s own auth session; no analytics or trackers.
# nail-booking
