// @ts-check
/**
 * Builds the Firefox (Gecko) variant of the extension into
 * `artifacts/firefox-extension/` plus a store-ready zip and optional
 * AMO source-code archive (`--source`).
 *
 * Usage:
 *   npm run build && node scripts/package-firefox.mjs
 *   npm run build && node scripts/package-firefox.mjs --source
 */
import { cp, mkdir, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { CONTENT_SCRIPT_ORDER } from './content-script-order.mjs';
import {
  createPackagedManifest,
  shouldExcludeFromPackage,
  formatContentBundle,
  getUnbundledContentScriptFiles,
  findMissingPackagedAssetReferences,
} from './package-extension.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts');
const packageDir = path.join(artifactsDir, 'firefox-extension');

export const FIREFOX_SHIM_PATH = 'shared/compat/firefox_shim.js';
export const GECKO_ID = 'gemini-nexus-firefox@haso2007';
export const STRICT_MIN_VERSION = '140.0';
export const DEFAULT_SIDEBAR_PANEL = 'sidepanel/index.html';

const UNSUPPORTED_PERMISSIONS = new Set(['sidePanel', 'debugger']);

const localDependencyAssets = [
  {
    source: 'node_modules/katex/dist/katex.min.css',
    target: 'vendor/katex/katex.min.css',
  },
  {
    source: 'node_modules/katex/dist/fonts',
    target: 'vendor/katex/fonts',
  },
  {
    source: 'node_modules/highlight.js/styles/atom-one-dark.min.css',
    target: 'vendor/highlight.js/atom-one-dark.min.css',
  },
];

const requiredPaths = [
  'manifest.json',
  'logo.png',
  'assets/icons',
  'background',
  'shared',
  'shared/compat/firefox_shim.js',
  'services',
  'dist/assets',
  'dist/sidepanel/index.html',
  'dist/sidepanel/preload.js',
  'dist/sandbox/index.html',
  'dist/sandbox/theme_boot.js',
  'dist/settings/index.html',
  'vendor/gemini-watermark-remover',
];

/**
 * Rewrites an already-packaged (content-script bundled) Chrome manifest
 * into its Firefox MV3 equivalent.
 * @param {Record<string, any>} packagedManifest
 */
export function createFirefoxManifest(packagedManifest) {
  const manifest = { ...packagedManifest };

  delete manifest.key;
  delete manifest.side_panel;
  delete manifest.sandbox;

  manifest.permissions = (manifest.permissions || []).filter(
    (permission) => !UNSUPPORTED_PERMISSIONS.has(permission)
  );
  if (!manifest.permissions.includes('declarativeNetRequest')) {
    manifest.permissions.push('declarativeNetRequest');
  }

  if (manifest.content_security_policy) {
    manifest.content_security_policy = {
      extension_pages: manifest.content_security_policy.extension_pages,
    };
  }

  manifest.background = {
    scripts: ['background/index.js'],
    type: 'module',
  };

  const actionIcons = manifest.action?.default_icon;
  const resolvedIcon =
    actionIcons && typeof actionIcons === 'object'
      ? { ...actionIcons }
      : typeof actionIcons === 'string'
        ? actionIcons
        : undefined;

  manifest.sidebar_action = {
    default_panel: DEFAULT_SIDEBAR_PANEL,
    default_title: manifest.action?.default_title || 'Gemini Nexus',
    ...(resolvedIcon ? { default_icon: resolvedIcon } : {}),
  };

  // Register Firefox native `_execute_sidebar_action` shortcut if not already present
  manifest.commands = {
    ...(manifest.commands || {}),
    _execute_sidebar_action: {
      suggested_key: {
        default: 'Alt+Shift+G',
        mac: 'Command+Shift+G',
      },
      description: 'Toggle Gemini Nexus Sidebar',
    },
  };

  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: STRICT_MIN_VERSION,
      data_collection_permissions: {
        required: ['none'],
      },
    },
  };

  manifest.content_scripts = (manifest.content_scripts || []).map((entry) => {
    const out = { ...entry };
    delete out.exclude_globs;
    if (out.world !== 'MAIN') {
      const existingJs = out.js || [];
      out.js = existingJs.includes(FIREFOX_SHIM_PATH)
        ? existingJs
        : [FIREFOX_SHIM_PATH, ...existingJs];
    }
    return out;
  });

  return manifest;
}

/**
 * Ensures `sandbox/index.html` in the Firefox package never loads `firefox_shim.js`
 * and always runs purely as an unprivileged UI renderer inside `<iframe sandbox>`.
 */
async function sanitizePackagedSandboxHtml() {
  const sandboxHtmlPath = path.join(packageDir, 'sandbox/index.html');
  const html = await readFile(sandboxHtmlPath, 'utf8');
  const sanitized = html.replace(
    /<script[^>]*src=["'][^"']*firefox_shim\.js["'][^>]*>\s*<\/script>\s*/gi,
    ''
  );
  if (sanitized !== html) {
    await writeFile(sandboxHtmlPath, sanitized, 'utf8');
  }
}

/**
 * Firefox treats a sandboxed iframe as an opaque origin. Extension CSP
 * `script-src 'self'` then blocks the UI bundle, so the sidebar stays blank.
 * @param {string} html
 */
export function stripSandboxFrameAttribute(html) {
  return html.replace(
    /<iframe\b([^>]*\bid=["']sandbox-frame["'][^>]*)>/gi,
    (_match, attrs) => `<iframe${attrs.replace(/\s+sandbox=(["'])[\s\S]*?\1/gi, '')}>`
  );
}

/**
 * Sidebar and sandbox documents live in subdirectories. Root-absolute
 * `/assets/...` URLs fail to resolve in Firefox sidebars, so point them at
 * the packaged `assets/` directory.
 * @param {string} html
 */
export function relativizePackagedAssetUrls(html) {
  return html.replace(/(=)(["'])\/assets\//g, '$1$2../assets/');
}

async function prepareFirefoxHtmlPages() {
  const pages = ['sidepanel/index.html', 'sandbox/index.html', 'settings/index.html'];
  await Promise.all(
    pages.map(async (relativePath) => {
      const htmlPath = path.join(packageDir, relativePath);
      const html = await readFile(htmlPath, 'utf8');
      const updated = relativizePackagedAssetUrls(
        relativePath.endsWith('sidepanel/index.html') ? stripSandboxFrameAttribute(html) : html
      );
      if (updated !== html) await writeFile(htmlPath, updated, 'utf8');
    })
  );
}

/**
 * @param {string} relativePath
 */
async function ensureExists(relativePath) {
  try {
    await stat(path.join(rootDir, relativePath));
  } catch {
    throw new Error(`Missing required build input: ${relativePath}`);
  }
}

/**
 * @param {string} sourceRelativePath
 * @param {string} [targetRelativePath]
 */
async function copyIntoPackage(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  const source = path.join(rootDir, sourceRelativePath);
  const target = path.join(packageDir, targetRelativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, {
    recursive: true,
    filter: (sourcePath) => {
      const relativePath = path.relative(rootDir, sourcePath);
      return !shouldExcludeFromPackage(relativePath);
    },
  });
}

async function writeFirefoxManifest() {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'manifest.json'), 'utf8'));
  const packaged = createPackagedManifest(manifest);
  await writeFile(
    path.join(packageDir, 'manifest.json'),
    JSON.stringify(createFirefoxManifest(packaged), null, 2) + '\n',
    'utf8'
  );
}

async function writeContentBundle() {
  /** @type {string[]} */
  const contentScriptOrder = CONTENT_SCRIPT_ORDER;
  const segments = await Promise.all(
    contentScriptOrder.map(async (relativePath) => ({
      relativePath,
      source: await readFile(path.join(rootDir, relativePath), 'utf8'),
    }))
  );

  const target = path.join(packageDir, 'content/index.js');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, formatContentBundle(segments), 'utf8');
}

async function copyUnbundledContentScripts() {
  const manifest = JSON.parse(await readFile(path.join(rootDir, 'manifest.json'), 'utf8'));
  const files = getUnbundledContentScriptFiles(manifest);
  await Promise.all(files.map((relativePath) => copyIntoPackage(relativePath)));
}

/**
 * @param {string} directory
 */
async function removeJunkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await removeJunkFiles(fullPath);
        return;
      }
      if (entry.name === '.DS_Store') {
        await rm(fullPath, { force: true });
      }
    })
  );
}

/**
 * @param {string} cwdDir
 * @param {string} zipPath
 */
async function createZipFromDirectory(cwdDir, zipPath) {
  await rm(zipPath, { force: true });
  const relZipPath = path.relative(cwdDir, zipPath);

  const tryZip = () =>
    new Promise((resolve, reject) => {
      execFile(
        'zip',
        ['-r', '-X', zipPath, '.'],
        { cwd: cwdDir },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`zip failed: ${stderr || error.message}`));
            return;
          }
          resolve(stdout);
        }
      );
    });

  const tryTar = () =>
    new Promise((resolve, reject) => {
      const tarCmd = process.platform === 'win32' ? 'tar.exe' : 'tar';
      execFile(
        tarCmd,
        ['-a', '-c', '-f', relZipPath, '.'],
        { cwd: cwdDir },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`tar failed: ${stderr || error.message}`));
            return;
          }
          resolve(stdout);
        }
      );
    });

  try {
    await tryZip();
    return true;
  } catch (zipError) {
    try {
      await tryTar();
      return true;
    } catch (tarError) {
      console.warn(
        `[warn] Could not create zip archive (${zipError.message}; ${tarError.message}).`
      );
      return false;
    }
  }
}

async function writeZipArchive() {
  const manifest = JSON.parse(await readFile(path.join(packageDir, 'manifest.json'), 'utf8'));
  const zipName = `gemini-nexus-firefox-${manifest.version}.zip`;
  const zipPath = path.join(artifactsDir, zipName);
  const ok = await createZipFromDirectory(packageDir, zipPath);
  if (ok) {
    console.log(`Firefox store zip written to ${path.relative(rootDir, zipPath)}`);
  }
}

async function writeAmoSourceArchive() {
  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const sourceStagingDir = path.join(artifactsDir, 'firefox-source-staging');
  const sourceZipPath = path.join(
    artifactsDir,
    `gemini-nexus-firefox-${packageJson.version}-sources.zip`
  );

  await rm(sourceStagingDir, { recursive: true, force: true });
  await mkdir(sourceStagingDir, { recursive: true });

  const excludedTopLevel = new Set([
    'node_modules',
    'dist',
    'artifacts',
    '.git',
    '.DS_Store',
  ]);

  const entries = await readdir(rootDir);
  for (const name of entries) {
    if (excludedTopLevel.has(name)) continue;
    await cp(path.join(rootDir, name), path.join(sourceStagingDir, name), {
      recursive: true,
    });
  }

  const amoInstructions = [
    '# Mozilla Add-ons (AMO) Reproducible Build Instructions',
    '',
    '## Environment Requirements',
    '- OS: Linux, macOS, or Windows',
    '- Node.js: v22.14.0 LTS (or >= 20.x)',
    '- npm: >= 10.x',
    '',
    '## Build Steps',
    '1. Install exact locked dependencies:',
    '   ```bash',
    '   npm ci',
    '   ```',
    '2. Build the Vite UI bundles and package the Firefox MV3 extension:',
    '   ```bash',
    '   npm run package:firefox',
    '   ```',
    '3. Output location:',
    '   - Unpacked extension directory: `artifacts/firefox-extension/`',
    `   - Store archive: \`artifacts/gemini-nexus-firefox-${packageJson.version}.zip\``,
    '',
  ].join('\n');

  await writeFile(
    path.join(sourceStagingDir, 'AMO_BUILD_INSTRUCTIONS.md'),
    amoInstructions,
    'utf8'
  );

  const ok = await createZipFromDirectory(sourceStagingDir, sourceZipPath);
  await rm(sourceStagingDir, { recursive: true, force: true });
  if (ok) {
    console.log(`AMO source archive written to ${path.relative(rootDir, sourceZipPath)}`);
  }
}

async function main() {
  for (const relativePath of requiredPaths) {
    await ensureExists(relativePath);
  }
  for (const relativePath of CONTENT_SCRIPT_ORDER) {
    await ensureExists(relativePath);
  }
  for (const asset of localDependencyAssets) {
    await ensureExists(asset.source);
  }

  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  await Promise.all([
    writeFirefoxManifest(),
    copyIntoPackage('logo.png'),
    copyIntoPackage('assets/icons'),
    copyIntoPackage('background'),
    copyIntoPackage('background/control/dom_page_script.js'),
    copyIntoPackage('background/control/dom_bridge_script.js'),
    writeContentBundle(),
    copyUnbundledContentScripts(),
    copyIntoPackage('shared'),
    copyIntoPackage('services'),
    copyIntoPackage('vendor/gemini-watermark-remover'),
    ...localDependencyAssets.map((asset) => copyIntoPackage(asset.source, asset.target)),
    copyIntoPackage('dist/assets', 'assets'),
    copyIntoPackage('dist/sidepanel/index.html', 'sidepanel/index.html'),
    copyIntoPackage('dist/sidepanel/preload.js', 'sidepanel/preload.js'),
    copyIntoPackage('dist/sandbox/index.html', 'sandbox/index.html'),
    copyIntoPackage('dist/sandbox/theme_boot.js', 'sandbox/theme_boot.js'),
    copyIntoPackage('dist/settings/index.html', 'settings/index.html'),
  ]);

  await sanitizePackagedSandboxHtml();
  await prepareFirefoxHtmlPages();
  await removeJunkFiles(packageDir);

  const missingReferences = await findMissingPackagedAssetReferences(packageDir, [
    'sidepanel/index.html',
    'sandbox/index.html',
    'settings/index.html',
  ]);
  if (missingReferences.length > 0) {
    throw new Error(
      [
        'Packaged HTML references missing asset files:',
        ...missingReferences.map((r) => `- ${r}`),
      ].join('\n')
    );
  }

  const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
  await writeFile(
    path.join(packageDir, 'build-info.json'),
    JSON.stringify(
      {
        name: packageJson.name,
        version: packageJson.version,
        target: 'firefox',
        geckoId: GECKO_ID,
        builtAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  await writeZipArchive();

  if (process.argv.includes('--source')) {
    await writeAmoSourceArchive();
  }

  console.log(`Firefox extension package prepared at ${path.relative(rootDir, packageDir)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}