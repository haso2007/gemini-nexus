// @ts-check
/**
 * Builds the Firefox (Gecko) variant of the extension into
 * `artifacts/firefox-extension/` plus a store-ready zip.
 *
 * Usage:
 *   npm run build && node scripts/package-firefox.mjs
 *
 * It reuses the Chrome packager's file layout and content-script bundling,
 * then rewrites manifest.json for Firefox MV3:
 *
 * - drops Chrome-only keys: `key`, `side_panel`, `sandbox`,
 *   `content_security_policy.sandbox`
 * - drops unsupported permissions: `sidePanel`, `debugger`, `tabGroups`
 * - background: event-page `scripts` (+ `type: module`, FF112+) instead of
 *   the service worker (not implemented in Firefox, bug 1573659)
 * - adds `sidebar_action` (default_panel = sidepanel/index.html); the
 *   runtime `chrome.sidePanel` calls are emulated by
 *   shared/compat/firefox_shim.js on top of `sidebarAction`
 * - adds `browser_specific_settings.gecko` (stable add-on id,
 *   strict_min_version 128.0 for content_scripts `world: "MAIN"`)
 * - drops `exclude_globs` from content_scripts (not supported by Firefox)
 * - prepends shared/compat/firefox_shim.js to every content-script entry
 *   except the MAIN-world one (page context must stay untouched)
 *
 * Known intentional degradations in the Firefox build (see docs/firefox.md):
 * - CDP-based browser control is disabled (no chrome.debugger in Firefox).
 * - Per-tab side-panel enable/disable is best-effort (no Firefox equivalent).
 * - The native tab-group indicator is skipped (no chrome.tabGroups).
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
    collectPackagedAssetReferences,
    findMissingPackagedAssetReferences,
} from './package-extension.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const artifactsDir = path.join(rootDir, 'artifacts');
const packageDir = path.join(artifactsDir, 'firefox-extension');

export const FIREFOX_SHIM_PATH = 'shared/compat/firefox_shim.js';
export const GECKO_ID = 'gemini-nexus-firefox@haso2007';
export const STRICT_MIN_VERSION = '128.0';

const UNSUPPORTED_PERMISSIONS = new Set(['sidePanel', 'debugger', 'tabGroups']);

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
    manifest.sidebar_action = {
        default_panel: 'sidepanel/index.html',
        default_title: manifest.action?.default_title || 'Gemini Nexus',
        ...(actionIcons ? { default_icon: { ...actionIcons } } : {}),
    };

    manifest.browser_specific_settings = {
        gecko: {
            id: GECKO_ID,
            strict_min_version: STRICT_MIN_VERSION,
            // Required by AMO for all new submissions (Firefox 140+ shows it
            // in the consent UI; silently ignored on older versions).
            // The add-on itself collects no data: network requests go only
            // to the AI providers the user configured.
            data_collection_permissions: {
                required: ['none'],
            },
        },
    };

    manifest.content_scripts = (manifest.content_scripts || []).map((entry) => {
        const out = { ...entry };
        delete out.exclude_globs;
        if (out.world !== 'MAIN') {
            out.js = [FIREFOX_SHIM_PATH, ...(out.js || [])];
        }
        return out;
    });

    return manifest;
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

async function writeZipArchive() {
    const manifest = JSON.parse(await readFile(path.join(packageDir, 'manifest.json'), 'utf8'));
    const zipName = `gemini-nexus-firefox-${manifest.version}.zip`;
    const zipPath = path.join(artifactsDir, zipName);
    await rm(zipPath, { force: true });
    const relZipPath = path.relative(packageDir, zipPath);

    const tryZip = () =>
        new Promise((resolve, reject) => {
            execFile(
                'zip',
                ['-r', '-X', zipPath, '.'],
                { cwd: packageDir },
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
                { cwd: packageDir },
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
    } catch (zipError) {
        try {
            await tryTar();
        } catch (tarError) {
            console.warn(
                `[warn] Could not create zip archive (${zipError.message}; ${tarError.message}). ` +
                    `The unpacked directory at ${path.relative(rootDir, packageDir)} is still usable for debugging.`
            );
            return;
        }
    }
    console.log(`Firefox store zip written to ${path.relative(rootDir, zipPath)}`);
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

    console.log(`Firefox extension package prepared at ${path.relative(rootDir, packageDir)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
