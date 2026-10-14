import { readFile } from 'node:fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copySidepanelPreload(): Plugin {
    return {
        name: 'copy-sidepanel-preload',
        apply: 'build',
        async generateBundle() {
            const source = await readFile(path.resolve(__dirname, 'sidepanel/preload.js'), 'utf8');
            this.emitFile({
                type: 'asset',
                fileName: 'sidepanel/preload.js',
                source,
            });
        },
    };
}

function copySandboxThemeBoot(): Plugin {
    return {
        name: 'copy-sandbox-theme-boot',
        apply: 'build',
        async generateBundle() {
            // Referenced as ./theme_boot.js from sandbox/index.html; kept as a
            // separate classic script (not bundled) so it runs before first
            // render and stays CSP-clean (no inline script).
            const source = await readFile(path.resolve(__dirname, 'sandbox/theme_boot.js'), 'utf8');
            this.emitFile({
                type: 'asset',
                fileName: 'sandbox/theme_boot.js',
                source,
            });
        },
    };
}

export default defineConfig(() => {
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [copySidepanelPreload(), copySandboxThemeBoot()],
        build: {
            chunkSizeWarningLimit: 1600,
            rollupOptions: {
                input: {
                    sidepanel: path.resolve(__dirname, 'sidepanel/index.html'),
                    sandbox: path.resolve(__dirname, 'sandbox/index.html'),
                    settings: path.resolve(__dirname, 'settings/index.html'),
                },
            },
        },
        test: {
            setupFiles: ['./test/setup.js'],
            exclude: ['**/node_modules/**', '**/dist/**', '**/artifacts/**'],
        },
    };
});
