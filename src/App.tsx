import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useSlidingHighlight } from './slidingHighlight';
import { useAppData } from './store';
import { WorkoutLogger } from './components/WorkoutLogger';
import { History } from './components/History';
import { Progress } from './components/Progress';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { Settings } from './components/Settings';
import { DialogHost } from './components/DialogHost';
import { RestTimer } from './components/RestTimer';
import { primeAudio } from './restAlert';
import { useStorageProtection, useWakeLock } from './pwa';
import { useCloudSync } from './cloud/useCloudSync';
import { Welcome } from './components/Welcome';
import { caloriesOn, fmtKcal, workoutCalories } from './calories';
import { useExerciseMap } from './hooks';
import { applyTheme, getTheme } from './themes';
import { CalendarIcon, ChartIcon, DumbbellIcon, GearIcon, ListIcon } from './components/Icons';

type Tab = 'workout' | 'history' | 'progress' | 'exercises' | 'settings';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'workout', label: 'Workout', icon: <DumbbellIcon /> },
  { id: 'history', label: 'History', icon: <CalendarIcon /> },
  { id: 'progress', label: 'Progress', icon: <ChartIcon /> },
  { id: 'exercises', label: 'Exercises', icon: <ListIcon /> },
  { id: 'settings', label: 'Settings', icon: <GearIcon /> },
];

const WELCOME_KEY = 'gym-app-welcome-v1';

export default function App() {
  const [data, update] = useAppData();
  const [tab, setTab] = useState<Tab>('workout');
  const [saved, setSaved] = useState<{ prs: string[]; workoutId: string } | null>(null);
  const [progressEx, setProgressEx] = useState<string | undefined>(undefined);
  // Rest timer for the active workout. Kept here so it survives switching tabs;
  // tied to the workout's id so it never carries over to the next workout.
  const [rest, setRest] = useState<{ workoutId: string; end: number; total: number } | null>(null);
  const activeRest = rest && rest.workoutId === data.activeWorkout?.id ? rest : null;

  // Keep the screen awake while a workout is in progress.
  useWakeLock(!!data.activeWorkout);
  // Once you've logged something, ask the browser not to clear the app's data.
  useStorageProtection(data.workouts.length > 0);
  // Cloud backup and sync (switched off until Firebase is set up).
  const cloud = useCloudSync(data, update);
  const exById = useExerciseMap(data.exercises);

  // First open: ask to sign in or create an account (once; skippable).
  const [welcomeDone, setWelcomeDone] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) === 'done';
    } catch {
      return true;
    }
  });
  const finishWelcome = () => {
    setWelcomeDone(true);
    try {
      localStorage.setItem(WELCOME_KEY, 'done');
    } catch {
      /* fine: it just may show again next time */
    }
  };
  // Signing in (here or anywhere) also counts as done, so it won't reappear after a sign-out.
  useEffect(() => {
    if (cloud.user) {
      try {
        localStorage.setItem(WELCOME_KEY, 'done');
      } catch {
        /* ignore */
      }
    }
  }, [cloud.user]);
  const showWelcome = cloud.available && !welcomeDone && !cloud.user && cloud.status !== 'connecting';

  // Calories for the workout just saved (it can change if you edit the workout while the banner shows).
  const savedWorkout = saved && caloriesOn(data.settings) ? data.workouts.find((w) => w.id === saved.workoutId) : undefined;
  const savedCalories = savedWorkout ? workoutCalories(savedWorkout, exById, data.settings.bodyWeightKg) : null;
  const savedKcal = savedCalories?.total ?? 0;
  const savedKcalText = savedCalories ? `${savedCalories.estimated ? 'About ' : ''}${fmtKcal(savedKcal)} burned` : '';

  useLayoutEffect(() => applyTheme(getTheme(data.settings.theme)), [data.settings.theme]);

  // Sliding highlight behind the active tab.
  const navRef = useRef<HTMLElement>(null);
  const blobRef = useRef<HTMLSpanElement>(null);

  useSlidingHighlight(navRef, blobRef, { active: 'button.active', axis: 'x' }, [tab]);

  return (
    <div className="app">
      <div className="glow" aria-hidden="true" />
      <main>
        {saved && (
          <div className="banner" role="status">
            <div>
              <strong>Workout saved</strong>
              {savedKcal > 0 && <div className="banner-kcal">{savedKcalText}</div>}
              {saved.prs.length > 0 ? (
                <ul>
                  {saved.prs.map((p) => <li key={p}><span className="pr-badge">PR</span> {p}</li>)}
                </ul>
              ) : (
                <div className="small">Nice work. Keep showing up.</div>
              )}
            </div>
            <button className="btn-ghost" onClick={() => setSaved(null)}>Dismiss</button>
          </div>
        )}
        {tab === 'workout' && (
          <WorkoutLogger
            data={data}
            update={update}
            onRest={(ms) => {
              if (!data.activeWorkout) return;
              if (data.settings.restSound !== false) primeAudio(); // runs inside the tap, so audio is allowed
              setRest({ workoutId: data.activeWorkout.id, end: Date.now() + ms, total: ms });
            }}
            onFinished={(prs, workoutId) => {
              setSaved({ prs, workoutId });
              setTab('history');
            }}
          />
        )}
        {tab === 'history' && <History data={data} update={update} onRepeat={() => setTab('workout')} />}
        {tab === 'progress' && <Progress key={progressEx ?? 'default'} data={data} initialExercise={progressEx} />}
        {tab === 'exercises' && (
          <ExerciseLibrary
            data={data}
            update={update}
            onOpen={(id) => {
              setProgressEx(id);
              setTab('progress');
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === 'settings' && <Settings data={data} update={update} cloud={cloud} />}
        {activeRest && <div className="rest-spacer" aria-hidden="true" />}
      </main>

      {activeRest && (
        <RestTimer
          end={activeRest.end}
          total={activeRest.total}
          onAdd={() => setRest((r) => (r ? { ...r, end: r.end + 30_000, total: r.total + 30_000 } : r))}
          onDone={() => setRest(null)}
          sound={data.settings.restSound !== false}
          notify={!!data.settings.restNotify}
        />
      )}

      <nav className="tabbar" ref={navRef}>
        <span className="tabbar-track" aria-hidden="true">
          <span className="tabbar-blob" ref={blobRef} />
        </span>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => {
              setTab(t.id);
              window.scrollTo({ top: 0 });
            }}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'workout' && data.activeWorkout && <span className="live-dot" aria-label="Workout in progress" />}
          </button>
        ))}
      </nav>
      {showWelcome && <Welcome cloud={cloud} data={data} update={update} onSkip={finishWelcome} />}
      <DialogHost />
    </div>
  );
}
