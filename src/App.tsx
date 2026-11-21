import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useAppData } from './store';
import { WorkoutLogger } from './components/WorkoutLogger';
import { History } from './components/History';
import { Progress } from './components/Progress';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { Settings } from './components/Settings';
import { DialogHost } from './dialog';
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

export default function App() {
  const [data, update] = useAppData();
  const [tab, setTab] = useState<Tab>('workout');
  const [prs, setPrs] = useState<string[] | null>(null);
  const [progressEx, setProgressEx] = useState<string | undefined>(undefined);

  useLayoutEffect(() => applyTheme(getTheme(data.settings.theme)), [data.settings.theme]);

  // Sliding highlight behind the active tab.
  const navRef = useRef<HTMLElement>(null);
  const blobRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const blob = blobRef.current;
    if (!nav || !blob) return;
    const place = (animate: boolean) => {
      const btn = nav.querySelector<HTMLElement>('button.active');
      if (!btn) return;
      blob.classList.toggle('no-anim', !animate);
      blob.style.width = `${btn.offsetWidth}px`;
      blob.style.transform = `translateX(${btn.offsetLeft}px)`;
      blob.classList.add('ready');
      if (!animate) requestAnimationFrame(() => blob.classList.remove('no-anim'));
    };
    place(blob.classList.contains('ready'));
    // Re-measure without animating when the bar changes size (rotation, resize).
    const ro = new ResizeObserver(() => place(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [tab]);

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
      </main>

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
