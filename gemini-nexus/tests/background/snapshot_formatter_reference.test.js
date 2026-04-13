import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { SnapshotFormatter } from '../../background/control/snapshot/formatter.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '../..');

describe('snapshot formatter reference hygiene', () => {
    test('keeps only the runtime formatter and an upstream reference', () => {
        const source = readFileSync(
            path.join(rootDir, 'background/control/snapshot/formatter.js'),
            'utf8'
        );

        expect(
            existsSync(path.join(rootDir, 'chrome-devtools-mcp-main/src/McpContext.d.ts'))
        ).toBe(false);
        expect(
            existsSync(
                path.join(
                    rootDir,
                    'chrome-devtools-mcp-main/src/formatters/snapshotFormatter.ts'
                )
            )
        ).toBe(false);
        expect(source).not.toContain('chrome-devtools-mcp src/formatters/snapshotFormatter.ts');
        expect(source).toContain('https://github.com/ChromeDevTools/chrome-devtools-mcp');
    });

    test('formats AX nodes with escaping, states, selection markers, and flattening', () => {
        const nodes = [
            {
                nodeId: 1,
                childIds: [2],
                role: { value: 'generic' },
                properties: [],
            },
            {
                nodeId: 2,
                backendDOMNodeId: 777,
                childIds: [],
                role: { value: 'button' },
                name: { value: 'Button "Click"' },
                description: { value: 'Description "quoted"' },
                properties: [
                    { name: 'checked', value: { value: false } },
                    { name: 'disabled', value: { value: false } },
                    { name: 'focused', value: { value: true } },
                ],
            },
        ];

        const formatter = new SnapshotFormatter({
            snapshotPrefix: 'test',
            selectedBackendNodeId: 777,
        });

        const output = formatter.format(nodes);

        expect(output).toMatch(/^uid=test_1 button/);
        expect(output).toContain('desc="Description \\"quoted\\""');
        expect(output).toContain('checkable');
        expect(output).toContain('disableable');
        expect(output).toContain('focusable focused');
        expect(output).toContain('[selected in the DevTools Elements panel]');
        expect(output).not.toContain('generic');
    });
});
