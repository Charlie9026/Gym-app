import { useRef, useState } from 'react';
import type { AppData } from '../types';
import type { Update } from '../store';
import { buildPlan, type Joint, type PlanAnswers } from '../planner';
import { newTemplate } from '../workout';
import { notify } from '../dialog';
import { useExerciseMap } from '../hooks';
import { fmtTime, repTarget } from '../sets';
import { MUSCLE_CODE } from '../exercises';
import type { TemplateSet } from '../types';
import { useSlidingHighlight } from '../slidingHighlight';
import { BackIcon } from './Icons';

interface Choice<T> {
  value: T;
  title: string;
  detail: string;
}

type Single = 'goal' | 'experience' | 'days' | 'minutes' | 'equipment';

const QUESTIONS: { key: Single; question: string; choices: Choice<string | number>[] }[] = [
  {
    key: 'goal',
    question: 'What’s your main goal?',
    choices: [
      { value: 'muscle', title: 'Build muscle', detail: 'Moderate weights, 8–12 reps' },
      { value: 'strength', title: 'Get stronger', detail: 'Heavier big lifts, fewer reps' },
      { value: 'fat', title: 'Lose fat', detail: 'Lifting plus a short cardio finish' },
      { value: 'general', title: 'General fitness', detail: 'A bit of everything' },
    ],
  },
  {
    key: 'experience',
    question: 'How much have you trained before?',
    choices: [
      { value: 'new', title: 'I’m brand new', detail: 'Simple, safe exercises to learn first' },
      { value: 'some', title: 'A bit', detail: 'I know my way around some machines' },
      { value: 'confident', title: 'I’m confident', detail: 'Happy with barbell lifts' },
    ],
  },
  {
    key: 'days',
    question: 'How many days a week can you train?',
    choices: [
      { value: 2, title: '2 days', detail: 'Two full-body workouts' },
      { value: 3, title: '3 days', detail: 'Three full-body workouts' },
      { value: 4, title: '4 days', detail: 'Upper body and lower body days' },
      { value: 5, title: '5 days', detail: 'Push, pull, legs, upper and lower' },
    ],
  },
  {
    key: 'minutes',
    question: 'How long can each workout be?',
    choices: [
      { value: 30, title: 'About 30 minutes', detail: '4 exercises' },
      { value: 45, title: 'About 45 minutes', detail: '5 exercises' },
      { value: 60, title: 'An hour or more', detail: '6 exercises' },
    ],
  },
  {
    key: 'equipment',
    question: 'Where will you train?',
    choices: [
      { value: 'gym', title: 'A full gym', detail: 'Machines, barbells and dumbbells' },
      { value: 'dumbbells', title: 'Dumbbells only', detail: 'At home or a small gym' },
      { value: 'bodyweight', title: 'No equipment', detail: 'Bodyweight at home (a pull-up bar helps)' },
    ],
  },
];

const JOINTS: Choice<Joint>[] = [
  { value: 'knees', title: 'Knees', detail: 'Skips squats, lunges and jumping' },
  { value: 'back', title: 'Lower back', detail: 'Skips deadlifts and bent-over rows' },
  { value: 'shoulders', title: 'Shoulders', detail: 'Skips overhead pressing and dips' },
];

const STEPS = QUESTIONS.length + 2; // the questions, joints, then the preview

type Answers = Partial<Omit<PlanAnswers, 'avoid'>> & { avoid: Joint[] };

/**
 * "Build me a plan": a few multiple-choice questions, then a preview of the
 * workouts it made, which can be added to My workouts in one tap.
 */
export function PlanBuilder({ data, update, onClose }: { data: AppData; update: Update; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ avoid: [] });
  const exById = useExerciseMap(data.exercises);
  const advance = useRef<number | undefined>(undefined);

  const back = () => {
    window.clearTimeout(advance.current);
    if (step === 0) onClose();
    else setStep(step - 1);
  };

  const pick = (key: Single, value: string | number) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    // Move on once the highlight has had a moment to slide.
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => setStep((s) => s + 1), 320);
  };

  const complete = (a: Answers): a is PlanAnswers =>
    !!a.goal && !!a.experience && !!a.days && !!a.minutes && !!a.equipment;
  const plan = step === STEPS - 1 && complete(answers) ? buildPlan(answers) : null;

  const addPlan = () => {
    if (!plan) return;
    const taken = new Set(data.templates.map((t) => t.name.toLowerCase()));
    const unique = (name: string) => {
      let n = name;
      for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${name} (${i})`;
      taken.add(n.toLowerCase());
      return n;
    };
    const created = plan.workouts.map((w) => newTemplate(unique(w.name), w.exercises));
    const ids = new Set(created.map((t) => t.id));
    update((d) => ({ ...d, templates: [...d.templates, ...created] }));
    notify(`${created.length} workouts added to My workouts`, {
      undo: () => update((d) => ({ ...d, templates: d.templates.filter((t) => !ids.has(t.id)) })),
    });
    onClose();
  };

  const q = QUESTIONS[step];
  return (
    <div className="screen editor plan-builder">
      <div className="editor-bar">
        <button className="btn-ghost back-btn" onClick={back}>
          <BackIcon /> {step === 0 ? 'Cancel' : 'Back'}
        </button>
        <span className="eyebrow">Build me a plan</span>
        <span className="plan-count muted small">{Math.min(step + 1, STEPS - 1)} of {STEPS - 1}</span>
      </div>
      <div
        className="plan-progress"
        role="progressbar"
        aria-label="Questions answered"
        aria-valuemin={0}
        aria-valuemax={STEPS - 1}
        aria-valuenow={step}
      >
        <span style={{ transform: `scaleX(${step / (STEPS - 1)})` }} />
      </div>

      <div className="plan-step" key={step}>
        {q && (
          <>
            <h1 className="plan-question">{q.question}</h1>
            <OptionList
              label={q.question}
              choices={q.choices}
              value={answers[q.key]}
              onPick={(v) => pick(q.key, v)}
            />
          </>
        )}

        {step === QUESTIONS.length && (
          <>
            <h1 className="plan-question">Anything to go easy on?</h1>
            <p className="muted plan-sub">Tick any that bother you, or skip this.</p>
            <div className="plan-options" role="group" aria-label="Go easy on">
              {JOINTS.map((j) => {
                const on = answers.avoid.includes(j.value);
                return (
                  <button
                    key={j.value}
                    type="button"
                    className={'plan-opt check-opt' + (on ? ' on' : '')}
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, avoid: on ? a.avoid.filter((x) => x !== j.value) : [...a.avoid, j.value] }))
                    }
                  >
                    <span className="plan-opt-text">
                      <strong>{j.title}</strong>
                      <span className="muted small">{j.detail}</span>
                    </span>
                    <span className="plan-tick" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                  </button>
                );
              })}
            </div>
            <button className="btn-primary big plan-next" onClick={() => setStep(step + 1)}>
              {answers.avoid.length ? 'Show my plan' : 'Nothing to avoid, show my plan'}
            </button>
          </>
        )}

        {plan && (
          <>
            <h1 className="plan-question">Your plan</h1>
            <p className="plan-sub">{plan.howTo}</p>
            {plan.workouts.map((w, i) => (
              <article className="card plan-workout" key={w.name}>
                <header className="plan-head">
                  <span className="plan-badge" aria-hidden="true">{i + 1}</span>
                  <span className="plan-title">
                    <span className="eyebrow">Workout {i + 1} of {plan.workouts.length}</span>
                    <h3>{w.name}</h3>
                  </span>
                  <span className="muted small">{w.exercises.length} exercises</span>
                </header>
                <ul className="plan-list">
                  {w.exercises.map((e) => {
                    const info = exById.get(e.exerciseId);
                    return (
                      <li key={e.exerciseId}>
                        <span className="muscle-badge" aria-hidden="true">{info ? MUSCLE_CODE[info.muscle] : '··'}</span>
                        <span className="plan-ex">
                          <strong>{info?.name ?? 'Exercise'}</strong>
                          <span className="muted small">{describeSets(e.sets)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
            <ul className="plan-tips muted small">
              {plan.tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <button className="btn-primary big plan-next" onClick={addPlan}>
              Add {plan.workouts.length} workouts to My workouts
            </button>
            <button className="btn-ghost plan-restart" onClick={() => setStep(0)}>Change my answers</button>
          </>
        )}
      </div>
    </div>
  );
}

/** "Warm-up, then 3 × 8–12 reps", "3 × 0:45", "10:00 steady". */
function describeSets(sets: TemplateSet[]): string {
  const working = sets.filter((s) => s.kind !== 'warmup');
  const first = working[0];
  if (!first) return '';
  const each = first.seconds ? fmtTime(first.seconds) : `${repTarget(first)} reps`;
  const main = first.seconds && working.length === 1 && !first.reps ? `${each} steady` : `${working.length} × ${each}`;
  return sets.length > working.length ? `Warm-up, then ${main}` : main;
}

/** Big single-choice options with the app's sliding highlight. */
function OptionList<T extends string | number>({
  label,
  choices,
  value,
  onPick,
}: {
  label: string;
  choices: Choice<T>[];
  value: T | undefined;
  onPick: (v: T) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  useSlidingHighlight(listRef, pillRef, { active: '.plan-opt.active', axis: 'xy' }, [value]);
  return (
    <div className="plan-options" role="radiogroup" aria-label={label} ref={listRef}>
      <span className="plan-pill" ref={pillRef} aria-hidden="true" />
      {choices.map((c) => (
        <button
          key={String(c.value)}
          type="button"
          role="radio"
          aria-checked={c.value === value}
          className={'plan-opt' + (c.value === value ? ' active' : '')}
          onClick={() => onPick(c.value)}
        >
          <span className="plan-opt-text">
            <strong>{c.title}</strong>
            <span className="small">{c.detail}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
