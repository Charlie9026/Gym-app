// Bundles dist/ into one self-contained HTML file (dist-single/gym-log.html)
// for hosts that need a single page, e.g. a claude.ai artifact.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js')), 'utf8');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css')), 'utf8');
if (/<\/script/i.test(js)) throw new Error('bundle contains </script>, cannot inline safely');

const html = `<title>Gym Log</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0B0B10">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/gym-log.html', html);
console.log('wrote dist-single/gym-log.html', (html.length / 1024).toFixed(0) + ' KB');
