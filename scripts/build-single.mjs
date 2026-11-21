// Bundles dist/ into one self-contained HTML file (dist-single/gym-log.html)
// for hosts that need a single page, e.g. a claude.ai artifact.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Use the files index.html actually loads (there are other chunks, e.g. Firebase,
// which the single-file copy doesn't need: cloud backup is off inside the viewer).
const indexHtml = readFileSync('dist/index.html', 'utf8');
const entryJs = indexHtml.match(/<script[^>]+src="\.?\/?(assets\/[^"]+\.js)"/)?.[1];
const entryCss = indexHtml.match(/<link[^>]+href="\.?\/?(assets\/[^"]+\.css)"/)?.[1];
if (!entryJs || !entryCss) throw new Error('could not find the entry script/stylesheet in dist/index.html');
const js = readFileSync('dist/' + entryJs, 'utf8');
const css = readFileSync('dist/' + entryCss, 'utf8');
if (/<\/script/i.test(js)) throw new Error('bundle contains </script>, cannot inline safely');

const html = `<title>Overload</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0B0B10">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
mkdirSync('dist-single', { recursive: true });
writeFileSync('dist-single/gym-log.html', html);
console.log('wrote dist-single/gym-log.html', (html.length / 1024).toFixed(0) + ' KB');
