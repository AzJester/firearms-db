# Personal Firearms Database — Cloud Edition (v2.0)

A private web app to track your firearms, ammunition, accessories, NFA items,
maintenance, value history and more — now with **cloud sync** so the same data
is available on every device (phone, tablet, laptop) behind your own login.

This is a rebuild of the original single-file `Firearms_Database_v1.3.3.html`.
**Every feature and every record was preserved** — the app logic is the same,
but the data now lives in a private cloud database instead of being trapped in
one browser on one computer.

---

## Access it from any device

Once GitHub Pages is enabled (see **Hosting setup** below), the app lives at:

> **https://azjester.github.io/firearms-db/**

1. Open that link in any browser (Chrome, Safari, Edge, Firefox — desktop or mobile).
2. **Sign in** with your email and password (sent to you privately — not stored in this repo).
3. Your collection loads automatically. Edits save to the cloud within ~2 seconds
   and appear on your other devices the next time they load.

### Install it like a real app (recommended on phones)

Because it's a **PWA (Progressive Web App)** you can add it to your home screen:

- **iPhone/iPad (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app* / *Add to Home screen*.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

It then opens full-screen like a native app and works offline (read-only) using a
cached copy; changes re-sync when you're back online.

---

## First-time data import (one time only)

Your real data is **not** stored in this public repository (that would expose your
serial numbers and tax stamps). Instead it's loaded into your private cloud once:

1. Sign in for the first time. A **"Welcome"** panel appears because your cloud is empty.
2. Click **Choose backup file** and select the `firearms_full_backup.json` file that
   was sent to you privately.
3. It uploads everything (7 firearms, 2 ammo lots, 2 accessories, 8 photos,
   receipts and stamp PDFs) to your cloud. Done — future devices just sign in.

> Keep that backup file somewhere safe (a password manager vault or encrypted drive).
> You can also re-export at any time from the app with **Export JSON** / **Save to File**.

---

## What's in the app

All original capabilities are intact:

- Firearms inventory with photos, condition, price, tags and rich-text notes
- **NFA tracking** — SBR/suppressor type, Form 4, tax-stamp status, submit/approve dates, stamp PDFs
- Ammunition tracking (quantity, price/round, location, low-stock alerts)
- Accessories linked to specific firearms
- Maintenance logs and round counts
- Disposition / sale tracking
- Wishlist and FFL dealer directory
- Dashboard with stats and a value-over-time chart
- Receipts (image/PDF) per item, with on-device OCR serial scanning
- QR codes, custom fields, audit trail
- Exports: Excel, PDF, CSV import, JSON, **ATF bound-book**, and an insurance report
- Dark / light theme

---

## How it works (architecture)

```
Browser (GitHub Pages, static)            Supabase (your private cloud)
┌────────────────────────────┐            ┌──────────────────────────────┐
│ index.html / css / js       │  HTTPS     │ Auth (email + password login) │
│  ├─ app.js  (original logic) │ ─────────▶ │ collections  (Postgres, RLS)  │  <- structured data (JSON)
│  ├─ cloud-sync.js (sync)     │ <───────── │ media bucket (Storage, RLS)   │  <- photos / receipts / PDFs
│  └─ auth.js (login gate)     │            └──────────────────────────────┘
└────────────────────────────┘            Row Level Security ties every row &
                                           file to your user id — nobody else
                                           can read or write your data.
```

- **Structured records** are stored as one JSON document per user in the `collections`
  table, with binaries replaced by `@media:<key>` references.
- **Binaries** (photos, receipts, stamp PDFs) are stored as individual files in a
  private `media` Storage bucket under your own `user-id/` folder.
- On load, `cloud-sync.js` reconstructs the exact in-memory shape the original app
  expects (so none of the 160+ original functions had to change). On every edit it
  saves the small JSON document and uploads only new/changed binaries.
- A local IndexedDB copy is kept for instant loads and offline viewing.

### Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, login screen, first-run import panel |
| `css/styles.css` | All styles (extracted from the original) |
| `js/app.js` | The original application logic, de-embedded |
| `js/cloud-sync.js` | Pull/push sync engine between the app and Supabase |
| `js/auth.js` | Login gate, session restore, sign-out, first-run import |
| `js/supabase-client.js` / `js/config.js` | Supabase connection (public anon key only) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: installable + offline |
| `.github/workflows/deploy.yml` | Auto-deploys to GitHub Pages on push to `main` |

---

## Hosting setup (one-time)

The code is already in this repo. To publish it:

### Enable GitHub Pages

**Option A — GitHub Actions (recommended, already wired up):**
1. Repo **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or merge the PR). The included workflow deploys automatically.

**Option B — Deploy from branch:**
1. Repo **Settings → Pages**.
2. **Source: Deploy from a branch**, Branch: `main`, Folder: `/ (root)`, Save.

Your site goes live at `https://azjester.github.io/firearms-db/` within a minute.

### Supabase (already provisioned)

A Supabase project named **firearms-db** has already been created with:
- `collections` table + `media` Storage bucket (both with Row Level Security)
- Your user account (email + password)

The only values the app needs are the project URL and the **public anon key**,
already set in `js/config.js`. These are safe to be public — security is enforced
by Row Level Security, not by hiding the key.

---

## Security & privacy

- The published **code is public**, but it contains **no personal data** — your
  collection lives only in your private, login-protected Supabase project.
- Every database row and storage file is restricted to its owner via Row Level
  Security, so the public anon key cannot read or write your data without your login.
- Traffic is HTTPS (encrypted in transit) and Supabase encrypts data at rest.
- The `service_role` (admin) key is **never** placed in this repo.
- `.gitignore` blocks any `*backup*.json` / database export from being committed.

To change your password later: sign in, then use the browser console once
(`await sbClient.auth.updateUser({ password: 'newPassword' })`) — a Settings
button for this is a good future addition.

---

## Improvements over the original

**Done in this rebuild**

- **True multi-device cloud sync** (the headline goal) instead of data trapped on one PC.
- **Login-protected**, per-user data isolation via Row Level Security.
- **Works on phones/tablets** — the original relied on the desktop-only File System
  Access API; this works everywhere and is **installable** as a PWA with offline support.
- **Maintainable codebase** — one 21 MB file split into readable HTML/CSS/JS modules.
- **No personal data in the repo** — the public site exposes nothing sensitive.

**Recommended next steps**

- **Conflict handling:** today it's last-write-wins. Add an "updated elsewhere — reload?"
  check using the `updated_at` timestamp for safe simultaneous editing on two devices.
- **Storage thumbnails:** generate small thumbnails so card grids load faster on mobile.
- **In-app account settings:** change password / email and "forgot password" (needs email
  configured in Supabase).
- **At-rest field encryption** for the most sensitive fields (e.g., serial numbers) using a
  passphrase only you hold, if you want zero-knowledge storage.
- **Search/filter on the server** once the collection grows large.
- **Automated backups:** a scheduled export of your data to a private location.

---

## Local development

It's plain static files — no build step:

```bash
# from the repo root
python3 -m http.server 8080
# open http://localhost:8080
```

(Use a server rather than opening `index.html` directly so the service worker and
module loading behave correctly.)
