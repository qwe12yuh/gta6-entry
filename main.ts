// Package the offline Solaris Keys world and four live captures for the sealed scorer.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const manifest: { name: string; query: string }[] = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));
const images = readdirSync(join(here, 'screenshots')).sort();
if (manifest.length !== 4 || images.join('|') !== manifest.map(shot => shot.name).sort().join('|')) {
  throw new Error('Solaris Keys requires exactly the four captures in shots.json.');
}
for (const { name, query } of manifest) {
  const size = statSync(join(here, 'screenshots', name)).size;
  if (!/^[1-4]-[a-z-]+\.jpg$/.test(name) || !/^\?shot=(chase|onfoot|aerial|map)$/.test(query) || size < 150 * 1024 || size > 235 * 1024) {
    throw new Error('Invalid Solaris Keys capture: ' + name);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('SOLARIS KEYS · four verified-size captures · dossier.json: ' + statSync(join(out, 'dossier.json')).size + ' bytes');
