import { useLayoutEffect, useState, type ReactNode } from 'react';
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

  useLayoutEffect(() => applyTheme(getTheme(data.settings.theme)), [data.settings.theme]);

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
        {tab === 'progress' && <Progress data={data} />}
        {tab === 'exercises' && <ExerciseLibrary data={data} update={update} />}
        {tab === 'settings' && <Settings data={data} update={update} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
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
