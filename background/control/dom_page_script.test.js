// @vitest-environment jsdom

import { beforeAll, describe, expect, it } from 'vitest';

describe('DOM page control script', () => {
    beforeAll(async () => {
        await import('./dom_page_script.js');
    });

    it('builds an accessibility snapshot that includes a button', async () => {
        document.body.innerHTML = '<button type="button">Go</button>';
        const payload = await globalThis.__geminiNexusDomPage.handleDomCommand(
            'Accessibility.getFullAXTree'
        );
        const button = payload.result.nodes.find((node) => node.role.value === 'button');

        expect(button.name.value).toBe('Go');
        expect(button.backendDOMNodeId).toBeGreaterThan(0);
    });

    it('runs a function against the snapshotted element', async () => {
        document.body.innerHTML = '<button type="button">Go</button>';
        const button = document.querySelector('button');
        let clicked = false;
        button.addEventListener('click', () => {
            clicked = true;
        });
        const snapshot = await globalThis.__geminiNexusDomPage.handleDomCommand(
            'Accessibility.getFullAXTree'
        );
        const node = snapshot.result.nodes.find((item) => item.role.value === 'button');

        await globalThis.__geminiNexusDomPage.handleDomCommand('Runtime.callFunctionOn', {
            objectId: String(node.backendDOMNodeId),
            functionDeclaration: 'function () { this.click(); }',
        });

        expect(clicked).toBe(true);
    });

    it('inserts text through the native value setter', async () => {
        document.body.innerHTML = '<input id="name" />';
        const input = document.getElementById('name');
        const snapshot = await globalThis.__geminiNexusDomPage.handleDomCommand(
            'Accessibility.getFullAXTree'
        );
        const node = snapshot.result.nodes.find((item) => item.role.value === 'textbox');

        await globalThis.__geminiNexusDomPage.handleDomCommand('Runtime.callFunctionOn', {
            objectId: String(node.backendDOMNodeId),
            functionDeclaration: 'function () { this.focus(); }',
        });
        await globalThis.__geminiNexusDomPage.handleDomCommand('Input.insertText', { text: 'Ada' });

        expect(input.value).toBe('Ada');
    });

    it('evaluates a main-world expression', async () => {
        const payload = await globalThis.__geminiNexusDomPage.handleDomCommand('Runtime.evaluate', {
            expression: '1 + 2',
        });

        expect(payload.result.result.value).toBe(3);
    });

    it('refuses to attach local file paths', async () => {
        await expect(
            globalThis.__geminiNexusDomPage.handleDomCommand('DOM.setFileInputFiles', {
                files: ['C:/secret.txt'],
            })
        ).rejects.toThrow(/file picker/i);
    });

    it('records alert dialogs without calling the native dialog', async () => {
        globalThis.alert('Need a name');
        expect(globalThis.__geminiNexusDomPage.getDialog()).toMatchObject({
            type: 'alert',
            message: 'Need a name',
        });
    });
});
