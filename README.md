# Gym Log

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

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build to dist/
npm run lint
```

Built with Vite, React and TypeScript, with no other runtime dependencies. Charts are hand-rolled SVG.

## Project layout

```
src/
  App.tsx              tab shell
  types.ts             data model
  store.ts             localStorage-backed state hook
  exercises.ts         preset exercise list
  utils.ts, workout.ts helpers (unit conversion, e1RM, formatting)
  components/          one file per screen + shared inputs/chart
```
