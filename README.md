# Fleet Ledger

A finance tracker for a bike delivery business: manage drivers, weekly payments, and expenses. No backend, no build step — plain HTML/CSS/JS. Data is stored in the browser's `localStorage`, so it stays on whichever device you open it on.

## Run it locally
Just open `index.html` in a browser. That's it — no npm install, no build.

## Deploy for free with GitHub Pages (recommended)
1. Create a new GitHub repo (e.g. `fleet-ledger`) and push all these files (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`, `icons/`) to the root of the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source: Deploy from a branch**, branch **main**, folder **/ (root)**. Save.
4. GitHub will give you a URL like `https://yourusername.github.io/fleet-ledger/` — that's your live app, hosted for free, forever, with no App Store review needed.

## Add it to your iPhone home screen
1. Open the GitHub Pages URL in **Safari** (must be Safari, not Chrome, for this to work on iOS).
2. Tap the **Share** icon → **Add to Home Screen** → **Add**.
3. Launch it from the new icon — it opens full-screen, no browser bar, with its own bike icon.

## Notes for editing in VS Code
- `app.js` holds all the state and logic (drivers, payments, expenses) — arrays persisted to `localStorage` under the keys `fl_drivers`, `fl_payments`, `fl_expenses`.
- `style.css` uses CSS variables at the top (`--bg`, `--yellow`, etc.) for the whole color scheme — change those to re-theme the app.
- `sw.js` is a minimal service worker that caches the app shell so it still opens with no signal. Bump `CACHE` version string if you change files and want clients to pick up the update.
- `manifest.json` controls the home-screen name/icon/theme color for Android and other PWA-aware platforms (iOS mostly relies on the `<meta>` tags in `index.html`).
- The "Open Tracker" link on each driver row points to `https://my.tracker.co.za/Login.aspx` — change this if you use a different tracking service.

## Multi-device / shared data
Right now data lives only in the browser it was entered in (`localStorage`), so it won't sync between your iPhone and a laptop, for example. If you want that, you'd need a small backend (like Firebase, Supabase, or a simple API) to replace the `localStorage` calls in `app.js` — happy to help wire that up if you get there.
