import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, 'dist');

const copyTargets = [
  'logo.png',
  'manifest.json',
  'metadata.json',
];

async function bundleScripts() {
  await build({
    entryPoints: [path.resolve(root, 'background/index.js')],
    outfile: path.resolve(dist, 'background/index.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120'],
    logLevel: 'silent',
  });

  await build({
    entryPoints: [path.resolve(root, 'content/main.js')],
    outfile: path.resolve(dist, 'content/index.js'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome120'],
    logLevel: 'silent',
  });
}

if (!existsSync(dist)) {
  throw new Error('Build output directory not found. Run vite build before packaging the extension.');
}

rmSync(path.resolve(dist, 'background'), { recursive: true, force: true });
rmSync(path.resolve(dist, 'content'), { recursive: true, force: true });
await bundleScripts();

for (const target of copyTargets) {
  const source = path.resolve(root, target);
  const destination = path.resolve(dist, target);
  if (!existsSync(source)) continue;
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: true });
}

console.log('Packaged extension assets into dist/');
