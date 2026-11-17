// VELORIA — Harbor Heat: submission entrypoint for the gta6-01 bounty.
//
// The grader runs this file with Node 22 and expects the finished artifact
// under the output directory: the playable game (game/), the captured frames
// (screenshots/) and dossier.json, the summary the judge reads. Everything the
// game itself needs already lives under game/ as plain static files, so this
// program only stages those trees and asks the vendored make.fun library to
// describe them.
//
// Local runs point the output elsewhere through MAKEFUN_OUTPUT_DIR:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, type DossierCaps } from './vendor/makefun-game.ts';

/** Where the grader collects the artifact when no override is given. */
const DEFAULT_OUTPUT_DIR = '/output';

/**
 * The scorer's gate, mirrored here so an oversized entry fails fast with a
 * clear message instead of far away in the sandbox: the dossier text budget,
 * the screenshot count/size limits, and the game tree limits (file count,
 * total bytes, longest path).
 */
const GATE_CAPS: DossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** The repository root: the folder holding this file. */
function repoRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

/** The artifact directory: the environment's override, else the default. */
function outputDir(): string {
  const override = process.env.MAKEFUN_OUTPUT_DIR;
  return override ?? DEFAULT_OUTPUT_DIR;
}

/** Copy a whole tree, creating the destination first. */
function mirrorTree(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

/**
 * Stage the entry and write its dossier. The screenshots folder is always
 * created in the output (the dossier reader expects it there); its contents
 * are copied only when the repository actually ships screenshots.
 */
function main(): void {
  const root = repoRoot();
  const out = outputDir();

  fs.mkdirSync(out, { recursive: true });
  mirrorTree(path.join(root, 'game'), path.join(out, 'game'));

  const shotsOut = path.join(out, 'screenshots');
  fs.mkdirSync(shotsOut, { recursive: true });
  const shotsIn = path.join(root, 'screenshots');
  if (fs.existsSync(shotsIn)) {
    fs.cpSync(shotsIn, shotsOut, { recursive: true });
  }

  const dossier = buildDossier(out, GATE_CAPS);
  fs.writeFileSync(path.join(out, 'dossier.json'), dossier);
}

main();
