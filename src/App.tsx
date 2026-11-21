import { useState } from 'react';
import { useAppData } from './store';
import { WorkoutLogger } from './components/WorkoutLogger';
import { History } from './components/History';
import { Progress } from './components/Progress';
import { ExerciseLibrary } from './components/ExerciseLibrary';
import { Settings } from './components/Settings';
import { DialogHost } from './dialog';

type Tab = 'workout' | 'history' | 'progress' | 'exercises' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'workout', label: 'Workout', icon: '🏋️' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'progress', label: 'Progress', icon: '📈' },
  { id: 'exercises', label: 'Exercises', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function App() {
  const [data, update] = useAppData();
  const [tab, setTab] = useState<Tab>('workout');
  const [prs, setPrs] = useState<string[] | null>(null);

  return (
    <div className="app">
      <main>
        {prs && (
          <div className="banner" role="status">
            <div>
              <strong>Workout saved! 💪</strong>
              {prs.length > 0 ? (
                <ul>
                  {prs.map((p) => <li key={p}>🏆 New PR, {p}</li>)}
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
