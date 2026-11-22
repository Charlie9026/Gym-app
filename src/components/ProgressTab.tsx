import { useState } from 'react';
import type { AppData } from '../types';
import type { Update } from '../store';
import type { CloudSync } from '../cloud/useCloudSync';
import { ChipGroup } from './ChipGroup';
import { Progress } from './Progress';
import { Leaderboards } from './Leaderboards';

type View = 'me' | 'leaderboards';

/** The Progress tab: your own charts, or the leaderboards. */
export function ProgressTab({
  data,
  update,
  cloud,
  initialExercise,
  onOpenSettings,
}: {
  data: AppData;
  update: Update;
  cloud: CloudSync;
  initialExercise?: string;
  onOpenSettings: () => void;
}) {
  const [view, setView] = useState<View>('me');
  const header = (
    <div className="page-head">
      <h1>Progress</h1>
      <ChipGroup
        label="Progress view"
        variant="segmented"
        kind="tabs"
        value={view}
        onChange={setView}
        options={[
          { value: 'me', label: 'My progress' },
          { value: 'leaderboards', label: 'Leaderboards' },
        ]}
      />
    </div>
  );
  if (view === 'me') return <Progress data={data} initialExercise={initialExercise} header={header} />;
  return (
    <div className="screen">
      {header}
      <Leaderboards data={data} update={update} cloud={cloud} onOpenSettings={onOpenSettings} />
    </div>
  );
}
