# Overload

A mobile-first gym progress tracker. Log your workouts, track weight and reps, and watch your lifts go up.

## Features

- **Workout logging**: start an empty workout or repeat a past one. Add exercises, log sets as weight × reps, and tick each set off as you finish it. The last session's numbers show beside each set and are pre-filled.
- **Rest timer**: starts on its own when you tick a set (90s), with +30s and skip.
- **History**: every finished workout with its duration, total volume and best sets. Repeat or delete any of them.
- **Progress**: per-exercise charts of estimated 1RM (Epley formula), heaviest set or session volume, plus PR stats and a session table.
- **PR detection**: finishing a workout tells you about any new heaviest weight or best estimated 1RM.
- **Exercise library**: about 40 preset exercises grouped by muscle, and you can add your own.
- **Settings**: kg/lb switch (weights are stored in kg and converted for display), JSON backup export/import, reset.

Data is stored in the browser's `localStorage`, so there's no account or server. Export backups now and then.

## Install on your phone

The app is published to GitHub Pages automatically (see `.github/workflows/deploy.yml`) at
`https://<your-github-username>.github.io/Gym-app/`.

1. **One-time setup:** in the repo on GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow from the Actions tab). The first deploy takes a minute or two.
3. Open the address on your phone, then:
   - **iPhone (Safari):** Share → **Add to Home Screen**.
   - **Android (Chrome):** menu → **Install app** (or **Add to Home screen**).

Once installed it opens full screen, works offline, keeps the screen awake during a workout and can play a chime
(and show a notification, if you allow it) when your rest ends.

Your data lives in the browser it was logged in, so a new address starts empty. To move it, use **Settings → Copy backup**
on the old copy and **Settings → Paste backup** on the new one.

## Cloud backup (Firebase)

Cloud backup is off until a Firebase project is connected. Once it is, Settings shows a
**Cloud backup** card: sign in with Google or email and your workouts, saved workouts,
exercises and settings back up and sync between devices (the workout in progress stays on
the device you're using). It works offline and catches up when you're back online.

One-time setup (free Spark plan):

1. Go to <https://console.firebase.google.com>, **Create a project** (Google Analytics not needed).
2. **Build → Authentication → Get started**, then under **Sign-in method** enable **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains → Add domain**: `<your-github-username>.github.io`.
4. **Build → Firestore Database → Create database** (production mode, any nearby location).
   Then open the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and **Publish**.
5. **Project settings (gear) → General → Your apps → Web (`</>`)**, register an app (no Hosting needed)
   and copy the `firebaseConfig` values into [`src/cloud/config.ts`](src/cloud/config.ts).
   These values are public by design; your data is protected by sign-in and the rules.
6. Push. The site rebuilds and the Cloud backup card appears in Settings.

`npm run test:sync` tests sync against the local Firebase emulator (needs Java).

## Development

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build to dist/ (also prepares the offline service worker)
npm run lint       # lint; warnings count as failures
npm test           # unit tests (Vitest) for the app's logic
npm run test:e2e   # end-to-end tests (Playwright) against the production build
npm run test:sync  # cloud sync tests against the local Firebase emulator (needs Java)
```

Every push runs lint, the build and both test suites on GitHub Actions; the site is only published if they pass.

## Project layout

```
src/
  App.tsx                tab shell, rest timer, sliding tab highlight
  types.ts               data model
  store.ts               saved data (localStorage) and migrations for older data
  sets.ts                rules per exercise type (weight, reps, time, distance) and warm-ups
  workout.ts, utils.ts   workout helpers, units, formatting
  themes.ts              colour themes
  dialog.ts              in-app dialogs, toasts and Undo
  pwa.ts, restAlert.ts   installed-app extras (offline, screen awake, storage protection), rest chime/notification
  cloud/                 cloud backup: Firebase config, sync engine (records.ts), sync hook
  components/            one file per screen and shared pieces (SetsTable, ChipGroup, MorphSelect…)
  styles/                base, components, screens, app-shell
  *.test.ts              unit tests
e2e/                     end-to-end tests (Playwright)
e2e-sync/                cloud sync tests (Firebase emulator)
firestore.rules          who can read/write cloud data (each account only its own)
public/                  icons, manifest, service worker
scripts/                 build helpers (service worker list, single-file build)
```
