# Extension Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the current security, build, and type-checking defects so the repository produces a loadable Chrome extension and closes the reported XSS and message-validation gaps.

**Architecture:** Keep the current extension structure, but introduce a small tested sanitization layer for sandbox-rendered HTML, tighten iframe message validation, and replace the partial Vite build with a packaging step that emits a complete extension directory. Add lightweight tests around the new helper logic and use command-level verification for the final packaged output.

**Tech Stack:** Vite, TypeScript, vanilla JS modules, Vitest, Node packaging script.

---

### Task 1: Add Test Harness

**Files:**
- Modify: `gemini-nexus/package.json`
- Create: `gemini-nexus/vitest.config.ts`
- Create: `gemini-nexus/tests/setup/test-dom.js`

- [ ] Add Vitest-based unit test support for browser-like modules.
- [ ] Verify the new test command runs.

### Task 2: Secure Sandbox Rendering

**Files:**
- Create: `gemini-nexus/sandbox/render/sanitize.js`
- Modify: `gemini-nexus/sandbox/render/pipeline.js`
- Modify: `gemini-nexus/sandbox/render/content.js`
- Modify: `gemini-nexus/sandbox/boot/renderer.js`
- Test: `gemini-nexus/tests/sandbox/sanitize.test.js`

- [ ] Write failing tests for dangerous HTML stripping while preserving expected markdown output structure.
- [ ] Implement sanitization and raw-text escaping fallback.
- [ ] Re-run targeted tests.

### Task 3: Tighten postMessage Bridges

**Files:**
- Create: `gemini-nexus/content/toolbar/security.js`
- Modify: `gemini-nexus/content/toolbar/bridge.js`
- Modify: `gemini-nexus/sidepanel/core/bridge.js`
- Modify: `gemini-nexus/sandbox/boot/messaging.js`
- Modify: `gemini-nexus/sandbox/ui/settings.js`
- Test: `gemini-nexus/tests/messaging/bridge-security.test.js`

- [ ] Write failing tests for trusted message checks.
- [ ] Implement source/origin validation and keep existing functionality working.
- [ ] Re-run targeted tests.

### Task 4: Repair Build Packaging

**Files:**
- Create: `gemini-nexus/scripts/package-extension.mjs`
- Modify: `gemini-nexus/package.json`
- Modify: `gemini-nexus/vite.config.ts`
- Modify: `gemini-nexus/sandbox/index.html`
- Modify: `gemini-nexus/README.md`
- Modify: `gemini-nexus/manifest.json`

- [ ] Add a packaging step that copies manifest, background, content, services, static assets, and sandbox helper files into dist after Vite finishes.
- [ ] Ensure the packaged dist directory is directly loadable by Chrome.
- [ ] Update docs to match the real workflow.

### Task 5: Restore Type Safety and Reduce Permission Surface

**Files:**
- Create: `gemini-nexus/chrome-devtools-mcp-main/src/McpContext.d.ts`
- Modify: `gemini-nexus/manifest.json`
- Test/Verify: `npx tsc --noEmit`

- [ ] Add the missing type declaration so typecheck succeeds.
- [ ] Remove only the manifest scope that is demonstrably unnecessary while preserving extension features.
- [ ] Re-run typecheck.

### Task 6: Final Verification

**Files:**
- Verify only

- [ ] Run targeted unit tests.
- [ ] Run full `npm test`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build` and inspect `dist` for a loadable extension layout.
- [ ] Run `npm audit` and confirm whether the build dependency advisories are reduced.
