import { describe, expect, it } from 'vitest';
import {
    createFirefoxManifest,
    relativizePackagedAssetUrls,
    STRICT_MIN_VERSION,
    stripSandboxFrameAttribute,
} from './package-firefox.mjs';

describe('Firefox packaged HTML', () => {
    it('removes the opaque sandbox attribute that blocks the UI bundle', () => {
        const html =
            '<iframe id="sandbox-frame" sandbox="allow-scripts allow-forms" allow="clipboard-write"></iframe>';

        expect(stripSandboxFrameAttribute(html)).toBe(
            '<iframe id="sandbox-frame" allow="clipboard-write"></iframe>'
        );
    });

    it('requires Firefox 140 so tabGroups and AMO data collection are valid', () => {
        const manifest = createFirefoxManifest({
            permissions: ['sidePanel', 'debugger', 'tabs', 'tabGroups'],
            background: { service_worker: 'background/index.js' },
            content_scripts: [{ js: ['content/index.js'], world: 'ISOLATED' }],
        });

        expect(STRICT_MIN_VERSION).toBe('140.0');
        expect(manifest.browser_specific_settings.gecko.strict_min_version).toBe('140.0');
        expect(manifest.permissions).toContain('tabGroups');
        expect(manifest.permissions).toContain('declarativeNetRequest');
        expect(manifest.permissions).not.toContain('debugger');
        expect(manifest.permissions).not.toContain('sidePanel');
    });

    it('points root-absolute asset URLs at the packaged assets directory', () => {
        const html = '<script type="module" src="/assets/sidepanel.js"></script>';

        expect(relativizePackagedAssetUrls(html)).toBe(
            '<script type="module" src="../assets/sidepanel.js"></script>'
        );
    });
});
