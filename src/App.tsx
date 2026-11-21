import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useAppData } from './store';
import { WorkoutLogger } from './components/WorkoutLogger';
import { History } from './components/History';
import { Progress } from './components/Progress';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { Settings } from './components/Settings';
import { DialogHost } from './dialog';
import { RestTimer } from './components/RestTimer';
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

/** Move the tab bar highlight under the active tab. */
function placeBlob(nav: HTMLElement | null, blob: HTMLElement | null, animate: boolean) {
  const btn = nav?.querySelector<HTMLElement>('button.active');
  if (!nav || !blob || !btn) return;
  blob.classList.toggle('no-anim', !animate);
  blob.style.width = `${btn.offsetWidth}px`;
  blob.style.transform = `translateX(${btn.offsetLeft}px)`;
  if (!animate) {
    void blob.offsetWidth; // commit the jump before transitions come back
    blob.classList.remove('no-anim');
  }
  blob.classList.add('ready');
}

export default function App() {
  const [data, update] = useAppData();
  const [tab, setTab] = useState<Tab>('workout');
  const [prs, setPrs] = useState<string[] | null>(null);
  const [progressEx, setProgressEx] = useState<string | undefined>(undefined);
  // Rest timer for the active workout. Kept here so it survives switching tabs;
  // tied to the workout's id so it never carries over to the next workout.
  const [rest, setRest] = useState<{ workoutId: string; end: number; total: number } | null>(null);
  const activeRest = rest && rest.workoutId === data.activeWorkout?.id ? rest : null;

  useLayoutEffect(() => applyTheme(getTheme(data.settings.theme)), [data.settings.theme]);

  // Sliding highlight behind the active tab.
  const navRef = useRef<HTMLElement>(null);
  const blobRef = useRef<HTMLSpanElement>(null);

  // Slide on every tab change (jump into place the very first time).
  useLayoutEffect(() => {
    placeBlob(navRef.current, blobRef.current, !!blobRef.current?.classList.contains('ready'));
  }, [tab]);

  // Re-align when the bar itself changes size (rotation, resize, a scrollbar appearing).
  // Animate rather than snap, so a resize mid-slide redirects instead of cancelling it.
  // Set up once; ResizeObserver fires immediately on observe, so skip that first call.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      placeBlob(nav, blobRef.current, true);
    });
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="app">
      <div className="glow" aria-hidden="true" />
      <main>
        {prs && (
          <div className="banner" role="status">
            <div>
              <strong>Workout saved</strong>
              {prs.length > 0 ? (
                <ul>
                  {prs.map((p) => <li key={p}><span className="pr-badge">PR</span> {p}</li>)}
                </ul>
              ) : (
                <div className="small">Nice work. Keep showing up.</div>
              )}
            </div>
            <button className="btn-ghost" onClick={() => setPrs(null)}>Dismiss</button>
          </div>
        )}
        {tab === 'workout' && (
          <WorkoutLogger
            data={data}
            update={update}
            onRest={(ms) => data.activeWorkout && setRest({ workoutId: data.activeWorkout.id, end: Date.now() + ms, total: ms })}
            onFinished={(p) => {
              setPrs(p);
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
        {tab === 'settings' && <Settings data={data} update={update} />}
        {activeRest && <div className="rest-spacer" aria-hidden="true" />}
      </main>

      {activeRest && (
        <RestTimer
          end={activeRest.end}
          total={activeRest.total}
          onAdd={() => setRest((r) => (r ? { ...r, end: r.end + 30_000, total: r.total + 30_000 } : r))}
          onDone={() => setRest(null)}
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
      <DialogHost />
    </div>
  );
}
