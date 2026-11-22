# Overload: gym progress tracker

Mobile-first React PWA. Live at https://charlie9026.github.io/Gym-app/ (GitHub Pages, deployed by CI on push). Keep hosting free.

## Stack
Vite + React 19 + TypeScript, plain CSS (no framework). oxlint (`--deny-warnings`), Vitest (unit), Playwright (e2e), Firebase (auth + Firestore) for optional cloud backup, loaded lazily only once someone signs in.

## Commands
- `npm run lint`: must be clean
- `npm run build`: tsc + vite + service-worker injection
- `npm test`: unit tests
- `npx playwright test`: e2e tests (run after `npm run build`; serves `dist` on :4173)
- `npm run test:sync`: cloud sync e2e tests against the Firebase emulators (needs Java)
- `npm run build:single`: one-file build in `dist-single/gym-log.html` (for the claude.ai artifact copy)

CI (`.github/workflows/deploy.yml`): test → build → deploy. All must pass before the site updates.

## Layout
- `src/App.tsx`: tabs (Workout, History, Progress, Exercises, Settings), floating tab bar, welcome screen
- `src/components/`: one component per file. Shared pieces: `ChipGroup` (pill rows, `variant="segmented"`), `SetsTable`, `ExerciseListEditor`, `StatCards`, `LineChart`, `Switch`, `MorphSelect`, `NumberInput`, `DurationInput`
- `src/store.ts`: data in localStorage via `update(fn)`. `src/types.ts`: data shapes
- `src/sets.ts`: exercise types (weight/reps/time/distance/steps; steps are stored in a set's `reps`), warm-up sets
- `src/workout.ts`, `src/utils.ts`: workout maths, formatting
- `src/stopwatch.ts`: the stopwatch for timing a set (saved on the active workout with its start time), pure and unit-tested; `StopwatchBar` shows it and posts a background notification if `stopwatchNotify` is on. Distance exercises can pick their own unit (`Exercise.distanceUnit`: m, km, mi, yd; `unitsFor` in `sets.ts`) or `timeOnly`
- `src/calories.ts`: calories burned (MET estimates from body weight, or numbers typed in for cardio), pure and unit-tested. Settings `showCalories` (default on) and `bodyWeightKg`
- `src/owner.ts`: `useIsOwner`, which decides who sees the Backup, Sample data and Danger zone cards in Settings (the owner's signed-in email, checked by hash, or the owner of the claude.ai copy). e2e tests act as owner unless `openApp(page, { owner: false })`
- `src/dialog.ts`: `ask`, `askText`, `notify(msg, { undo })`. Use these, never `alert`/`confirm`
- `src/slidingHighlight.ts`: the springy sliding pill used by the tab bar and every ChipGroup
- `src/cloud/`: sync engine (`records.ts`, pure and unit-tested), `firebase.ts`, `useCloudSync.ts`, `config.ts` (public web config, project `overload-b750c`)
- `src/styles/`: `base.css`, `components.css`, `screens.css`, `app-shell.css`. Themes in `src/themes.ts` (CSS variables)
- `e2e/`: Playwright specs. `helpers.ts` has `openApp`, `tab`, `loadSampleWeek`, `stored`, `answerDialog`, `skipRest`
- `public/sw.js`: offline service worker (version and file list injected at build)

## Never change (would lose users' data or caches)
Storage keys `gym-app-data-v1`, `gym-app-sync-v1`, `gym-app-welcome-v1`. Cache prefix `gym-log-`.

## Style rules
- Look: glassy cards, rounded pills, theme colours only via CSS variables (`--accent`, `--glass`, `--edge`, `--field`, `--muted`…), font Outfit. Check new UI in a dark and a light theme.
- Write only `backdrop-filter` (never add `-webkit-backdrop-filter` by hand): the build adds the Safari prefix, and writing both makes the minifier drop the standard one.
- Motion: springy (`cubic-bezier(0.34, 1.56, 0.64, 1)`). Pill highlights slide, never jump (use `useSlidingHighlight`/`ChipGroup`). Respect `prefersReducedMotion`.
- Mobile: works at 320px wide with no sideways scroll. Text fields at least 16px (stops iPhone zoom). Page zoom is disabled.
- Destructive actions offer Undo via `notify`. Plain, friendly wording in full sentences.
- Works fully offline and signed out. Cloud is optional.

## How to work
- Take care. Test each change and the app as a whole. Add or update e2e tests for new features, and check that a test fails without the fix.
- Before committing: lint clean, build, all Playwright tests pass. Then push and confirm the GitHub Actions run succeeds.
- The user is not a developer. Explain in plain English and give step-by-step instructions for anything they must do.
