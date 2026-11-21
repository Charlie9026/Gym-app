import { ask, notify } from '../dialog';
import { useEffect, useRef, useState } from 'react';
import { requestStorageProtection, storageProtection, type StorageProtection } from '../pwa';
import type { AppData, Unit } from '../types';
import { emptyData, isAppData, migrate, type Update } from '../store';
import { THEMES, getTheme, type Theme } from '../themes';
import { ChipGroup } from './ChipGroup';
import { Switch } from './Switch';
import { requestNotify } from '../restAlert';
import { REST_OPTIONS, restLabel } from '../sets';
import { isEmbedded } from '../env';
import { CloudCard } from './CloudCard';
import type { CloudSync } from '../cloud/useCloudSync';
import { addDemoWeek, hasDemoData, removeDemoWeek } from '../demo';

export function Settings({ data, update, cloud }: { data: AppData; update: Update; cloud: CloudSync }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [protection, setProtection] = useState<StorageProtection>('unknown');
  useEffect(() => {
    void storageProtection().then(setProtection);
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overload-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      notify('Backup copied. Paste it into a note or email to keep it safe.');
    } catch {
      notify(isEmbedded ? 'Copying isn’t allowed here. Open the app in its own tab to back up.' : 'Copying isn’t allowed here. Use Export JSON instead.');
    }
  };

  /** Restore from backup text (a file's contents or pasted text). */
  const restore = async (text: string, source: 'file' | 'paste') => {
    try {
      const parsed = JSON.parse(text);
      if (!isAppData(parsed)) throw new Error('not a backup');
      const n = parsed.workouts.length;
      const ok = await ask('Replace all current data with this backup?', {
        confirmLabel: 'Replace',
        detail: `The backup has ${n} workout${n === 1 ? '' : 's'}. What’s in the app now will be replaced.`,
      });
      if (!ok) return;
      update(() => migrate({ ...emptyData(), ...parsed }));
      notify(`Backup restored: ${n} workout${n === 1 ? '' : 's'}`);
      if (source === 'paste') {
        setPasted('');
        setPasting(false);
      }
    } catch {
      notify(
        source === 'file'
          ? 'That file isn’t an Overload backup. Pick a file exported from this app.'
          : 'That doesn’t look like an Overload backup. Paste the whole text from “Copy backup”.',
      );
    }
  };
  const importData = async (file: File) => restore(await file.text(), 'file');

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
        <div className="card-head">
          <h3>Rest timer</h3>
          <span className="muted small">{restLabel(data.settings.restSeconds ?? 90)}</span>
        </div>
        <ChipGroup
          label="Rest time between sets"
          kind="radio"
          wrap
          value={String(data.settings.restSeconds ?? 90)}
          onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, restSeconds: Number(v) } }))}
          options={REST_OPTIONS.map((sec) => ({ value: String(sec), label: restLabel(sec, true) }))}
        />
        <p className="muted small">
          {(data.settings.restSeconds ?? 90) === 0
            ? 'Ticking a set won’t start a timer.'
            : 'Starts when you tick a set. You can still add 30 seconds or skip it during a workout.'}
        </p>
        <div className="toggle-row">
          <label htmlFor="rest-sound">
            Chime when rest ends
            <span className="muted small">A soft two-note sound, even if the app is in the background.</span>
          </label>
          <Switch
            id="rest-sound"
            label="Chime when rest ends"
            checked={data.settings.restSound !== false}
            onChange={(v) => update((d) => ({ ...d, settings: { ...d.settings, restSound: v } }))}
          />
        </div>
        <div className="toggle-row">
          <label htmlFor="rest-notify">
            Notify when rest ends
            <span className="muted small">Shows a notification if you’ve switched away from the app.</span>
          </label>
          <Switch
            id="rest-notify"
            label="Notify when rest ends"
            checked={!!data.settings.restNotify}
            onChange={async (v) => {
              if (!v) return update((d) => ({ ...d, settings: { ...d.settings, restNotify: false } }));
              const r = await requestNotify();
              if (r === 'granted') {
                update((d) => ({ ...d, settings: { ...d.settings, restNotify: true } }));
                notify('You’ll get a notification when rest ends.');
              } else {
                notify(
                  isEmbedded
                    ? 'Notifications aren’t allowed inside this page. Open the app in its own tab to use them.'
                    : r === 'denied'
                      ? 'Notifications are blocked. Allow them for this site in your browser settings.'
                      : 'This browser doesn’t support notifications.',
                );
              }
            }}
          />
        </div>
      </div>

      <div className="card">
        <h3>Weight unit</h3>
        <ChipGroup
          label="Weight unit"
          kind="radio"
          variant="segmented"
          value={data.settings.unit}
          onChange={(u) => update((d) => ({ ...d, settings: { ...d.settings, unit: u } }))}
          options={(['kg', 'lb'] as Unit[]).map((u) => ({ value: u, label: u }))}
        />
        <p className="muted small">Switching converts all displayed weights; nothing you logged is lost.</p>
      </div>

      <CloudCard cloud={cloud} />

      <div className="card">
        <h3>Backup</h3>
        <p className="muted small">
          Your data lives only in this browser. Back it up now and then so you don’t lose it.
        </p>
        {protection !== 'unknown' && !isEmbedded && (
          <div className={'protect-row' + (protection === 'protected' ? ' ok' : '')}>
            <span className="protect-dot" aria-hidden="true" />
            <span className="small">
              {protection === 'protected'
                ? 'Storage protected: your browser won’t clear this data when space runs low.'
                : 'Storage not protected yet: your browser may clear this data if your phone runs low on space.'}
            </span>
            {protection !== 'protected' && (
              <button className="btn-ghost small-btn" onClick={() => void requestStorageProtection().then((r) => {
                setProtection(r);
                notify(r === 'protected' ? 'Storage protected' : 'Your browser didn’t allow it yet. Adding the app to your home screen usually does.');
              })}>
                Protect
              </button>
            )}
          </div>
        )}
        <div className="finish-row">
          {!isEmbedded && <button className="btn-secondary" onClick={exportData}>Export JSON</button>}
          <button className="btn-secondary" onClick={copyData}>Copy backup</button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>Import JSON</button>
          <button className="btn-secondary" onClick={() => setPasting((p) => !p)} aria-expanded={pasting}>Paste backup</button>
        </div>
        <div className={'collapse' + (pasting ? ' open' : '')} inert={!pasting} aria-hidden={!pasting}>
          <div className="collapse-inner">
            <div className="paste-box">
              <label htmlFor="paste-backup" className="muted small">
                Paste the text you copied with “Copy backup” on your other copy of the app.
              </label>
              <textarea
                id="paste-backup"
                className="notes"
                placeholder="Paste backup here…"
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
              />
              <button className="btn-primary" disabled={!pasted.trim()} onClick={() => restore(pasted, 'paste')}>
                Restore from pasted backup
              </button>
            </div>
          </div>
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
