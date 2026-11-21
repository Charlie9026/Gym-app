import { ask, notify } from '../dialog';
import { useRef } from 'react';
import type { AppData, Unit } from '../types';
import { emptyData, isAppData, type Update } from '../store';

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
        <h3>Danger zone</h3>
        <button
          className="btn-danger"
          onClick={() =>
            ask('Delete ALL workouts and custom exercises? This cannot be undone.', { confirmLabel: 'Delete everything' }).then(
              (ok) => ok && update(() => emptyData()),
            )
          }
        >
          Reset all data
        </button>
      </div>
    </div>
  );
}
