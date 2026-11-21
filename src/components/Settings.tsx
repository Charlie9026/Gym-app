import { ask, notify } from '../dialog';
import { useRef } from 'react';
import type { AppData, Unit } from '../types';
import { emptyData, isAppData, type Update } from '../store';
import { THEMES, getTheme, type Theme } from '../themes';
import { addDemoWeek, hasDemoData, removeDemoWeek } from '../demo';

export function Settings({ data, update }: { data: AppData; update: Update }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      notify('Backup copied. Paste it into a note or email to keep it safe.');
    } catch {
      notify('Copying isn’t allowed here. Use Export JSON instead.');
    }
  };

  const importData = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isAppData(parsed)) throw new Error('not a backup');
      if (!(await ask('Replace all current data with this backup?', { confirmLabel: 'Replace' }))) return;
      update(() => ({ ...emptyData(), ...parsed }));
      notify('Backup restored');
    } catch {
      notify('That file isn’t a valid gym backup. Pick a file exported from this app.');
    }
  };

  return (
    <div className="screen">
      <h1>Settings</h1>

      <div className="card">
        <div className="card-head">
          <h3>Colour theme</h3>
          <span className="muted small">{getTheme(data.settings.theme).name}</span>
        </div>
        {(['dark', 'light'] as const).map((mode) => (
          <div key={mode} className="theme-group">
            <div className="eyebrow">{mode === 'dark' ? 'Dark' : 'Light'}</div>
            <div className="theme-grid" role="radiogroup" aria-label={`${mode} themes`}>
              {THEMES.filter((t) => t.mode === mode).map((t) => (
                <ThemeOption
                  key={t.id}
                  theme={t}
                  selected={getTheme(data.settings.theme).id === t.id}
                  onSelect={() => update((d) => ({ ...d, settings: { ...d.settings, theme: t.id } }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Weight unit</h3>
        <div className="segmented">
          {(['kg', 'lb'] as Unit[]).map((u) => (
            <button
              key={u}
              className={data.settings.unit === u ? 'active' : ''}
              onClick={() => update((d) => ({ ...d, settings: { ...d.settings, unit: u } }))}
            >
              {u}
            </button>
          ))}
        </div>
        <p className="muted small">Switching converts all displayed weights; nothing you logged is lost.</p>
      </div>

      <div className="card">
        <h3>Backup</h3>
        <p className="muted small">
          Your data lives only in this browser. Export a backup now and then so you don’t lose it.
        </p>
        <div className="finish-row">
          <button className="btn-secondary" onClick={exportData}>Export JSON</button>
          <button className="btn-secondary" onClick={copyData}>Copy backup</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import JSON</button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="card">
        <h3>Sample data</h3>
        <p className="muted small">
          Fill the app with a sample week: chest and arms, back and shoulders, and leg days twice each, with Thursday
          off. It also adds the three as saved workouts. You can remove it again here.
        </p>
        <div className="finish-row">
          {hasDemoData(data) ? (
            <button
              className="btn-secondary"
              onClick={async () => {
                const ok = await ask('Remove the sample week and its saved workouts?', {
                  confirmLabel: 'Remove',
                  detail: 'Workouts you logged yourself are kept.',
                });
                if (!ok) return;
                update(removeDemoWeek);
                notify('Sample week removed');
              }}
            >
              Remove sample week
            </button>
          ) : (
            <button
              className="btn-secondary"
              onClick={() => {
                update(addDemoWeek);
                notify('Sample week added. Check the Workout and Progress tabs.');
              }}
            >
              Load sample week
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Danger zone</h3>
        <button
          className="btn-danger"
          onClick={() =>
            ask('Delete ALL workouts and custom exercises? This cannot be undone.', { confirmLabel: 'Delete everything' }).then(
              (ok) => ok && update((d) => ({ ...emptyData(), settings: d.settings })),
            )
          }
        >
          Reset all data
        </button>
      </div>
    </div>
  );
}

function ThemeOption({ theme, selected, onSelect }: { theme: Theme; selected: boolean; onSelect: () => void }) {
  return (
    <button
      className={'theme-option' + (selected ? ' selected' : '')}
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
    >
      <span
        className="theme-preview"
        style={{
          background: `radial-gradient(120% 120% at 100% 0%, ${theme.accent}66, transparent 60%), ${theme.bg}`,
        }}
      >
        <span className="tp-panel" style={{ background: theme.panel + (theme.mode === 'dark' ? 'cc' : 'e6') }}>
          <span className="tp-line" style={{ background: theme.text }} />
          <span className="tp-line short" style={{ background: theme.muted }} />
        </span>
        <span className="tp-dot" style={{ background: theme.accent }} />
      </span>
      <span className="theme-name">{theme.name}</span>
    </button>
  );
}
