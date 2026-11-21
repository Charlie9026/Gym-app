export interface Theme {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  bg: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  good: string;
}

export const THEMES: Theme[] = [
  { id: 'D1', name: 'Midnight Violet', mode: 'dark', bg: '#0B0B10', panel: '#1A1A22', text: '#F1F1F5', muted: '#8C8C99', accent: '#7C5CFF', onAccent: '#FFFFFF', good: '#3DD68C' },
  { id: 'D2', name: 'Graphite Ember', mode: 'dark', bg: '#100F0E', panel: '#1E1C1A', text: '#F4F1EE', muted: '#968F88', accent: '#FF7A1A', onAccent: '#140A02', good: '#4ADE80' },
  { id: 'D3', name: 'Deep Ocean', mode: 'dark', bg: '#070C14', panel: '#121A26', text: '#EEF3FA', muted: '#8597AD', accent: '#3B9EFF', onAccent: '#04101F', good: '#34D399' },
  { id: 'D4', name: 'Rose Noir', mode: 'dark', bg: '#110A0E', panel: '#21151B', text: '#F7EEF2', muted: '#A38B96', accent: '#FF4D8D', onAccent: '#1A0410', good: '#4ADE9A' },
  { id: 'D5', name: 'Volt Steel', mode: 'dark', bg: '#0D0F11', panel: '#1A1E22', text: '#EFF2F4', muted: '#8B949C', accent: '#C6F432', onAccent: '#111500', good: '#3DD68C' },
  { id: 'L1', name: 'Frost', mode: 'light', bg: '#E9EDF3', panel: '#FFFFFF', text: '#0F1218', muted: '#5F6876', accent: '#5B5BF0', onAccent: '#FFFFFF', good: '#1E9E57' },
  { id: 'L2', name: 'Ember', mode: 'light', bg: '#F4EFEA', panel: '#FFFFFF', text: '#1C1612', muted: '#7A6E64', accent: '#E8650A', onAccent: '#FFFFFF', good: '#16A34A' },
  { id: 'L3', name: 'Sky', mode: 'light', bg: '#E7F1FC', panel: '#FFFFFF', text: '#0B1726', muted: '#5A6B80', accent: '#0A7CFF', onAccent: '#FFFFFF', good: '#17A34A' },
  { id: 'L4', name: 'Mint Glass', mode: 'light', bg: '#E8F4EF', panel: '#FFFFFF', text: '#0D1A15', muted: '#587067', accent: '#0F9D74', onAccent: '#FFFFFF', good: '#15803D' },
  { id: 'L5', name: 'Blush', mode: 'light', bg: '#FAEEF1', panel: '#FFFFFF', text: '#22101A', muted: '#83677A', accent: '#E0457B', onAccent: '#FFFFFF', good: '#16A34A' },
];

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function systemDefaultThemeId(): string {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'L1' : 'D1';
  } catch {
    return 'D1';
  }
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Every colour the stylesheet uses, derived from a theme's few base colours. */
export function themeVars(t: Theme): Record<string, string> {
  const dark = t.mode === 'dark';
  return {
    '--bg': t.bg,
    '--panel': t.panel,
    '--text': t.text,
    '--muted': t.muted,
    '--accent': t.accent,
    '--on-accent': t.onAccent,
    '--accent-soft': rgba(t.accent, dark ? 0.16 : 0.12),
    '--accent-glow': rgba(t.accent, dark ? 0.35 : 0.3),
    '--orb': rgba(t.accent, dark ? 0.42 : 0.34),
    '--good': t.good,
    '--on-good': dark ? '#06140C' : '#FFFFFF',
    '--good-soft': rgba(t.good, dark ? 0.14 : 0.13),
    '--danger': dark ? '#FF6B6B' : '#D23A3A',
    '--danger-soft': dark ? 'rgba(255,107,107,.12)' : 'rgba(210,58,58,.08)',
    '--glass': dark ? rgba(t.panel, 0.55) : 'rgba(255,255,255,.58)',
    '--glass-strong': dark ? rgba(t.panel, 0.88) : 'rgba(255,255,255,.9)',
    '--field': dark ? 'rgba(255,255,255,.05)' : rgba(t.bg, 0.75),
    '--edge': dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.9)',
    '--line': dark ? 'rgba(255,255,255,.07)' : rgba(t.text, 0.08),
    '--sheen': dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,1)',
    '--shadow': dark ? 'rgba(0,0,0,.35)' : rgba(t.text, 0.08),
    '--scrim': dark ? 'rgba(0,0,0,.55)' : rgba(t.text, 0.25),
    // Neumorphic light/shadow pair and fill, derived per theme.
    '--neu-dark': dark ? 'rgba(0,0,0,.55)' : rgba(t.text, 0.14),
    '--neu-light': dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.95)',
    '--neu-fill': dark
      ? `linear-gradient(145deg, ${rgba(t.panel, 0.75)}, ${rgba(t.bg, 0.85)})`
      : `linear-gradient(145deg, rgba(255,255,255,.75), ${rgba(t.bg, 0.9)})`,
  };
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.style.colorScheme = t.mode;
  root.dataset.mode = t.mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}
