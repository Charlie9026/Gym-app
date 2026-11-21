// After `vite build`: fill dist/sw.js with a version and the list of files to
// save for offline use. Runs as part of `npm run build`.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(relative(dist, full).split('\\').join('/'));
  }
})(dist);

const precache = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
const hash = createHash('sha1');
for (const f of precache) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 10);

const swPath = join(dist, 'sw.js');
let sw = readFileSync(swPath, 'utf8');
const versionLine = "const VERSION = '__VERSION__';";
const precacheLine = 'const PRECACHE = /*__PRECACHE__*/[];';
if (!sw.includes(versionLine) || !sw.includes(precacheLine)) throw new Error('sw.js placeholder lines not found');
sw = sw.replace(versionLine, `const VERSION = '${version}';`).replace(precacheLine, `const PRECACHE = ${JSON.stringify(['./', ...precache])};`);
if (sw.includes('__VERSION__') || sw.includes('__PRECACHE__')) throw new Error('sw.js still has placeholders');
writeFileSync(swPath, sw);
console.log(`sw.js: version ${version}, ${precache.length} files cached for offline`);
