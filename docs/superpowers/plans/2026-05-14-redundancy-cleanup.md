# Redundancy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the highest-confidence duplicated runtime code without changing extension behavior.

**Architecture:** Keep the existing Chrome extension split between ESM sandbox/background code and classic content scripts. Share browser-only crop logic through a small global-safe core, centralize repeated message/listener helpers locally, and avoid removing compatibility wrappers guarded by structure tests.

**Tech Stack:** Chrome MV3, Vite, Vitest, JavaScript modules plus classic content scripts.

---

### Task 1: Share Crop Logic

**Files:**

- Create: `shared/dom/crop_core.js`
- Modify: `shared/dom/crop_utils.js`
- Modify: `content/toolbar/crop.js`
- Modify: `manifest.json`
- Test: `shared/dom/crop_utils.test.js`
- Test: `scripts/manifest.test.js`

- [x] Add tests for the shared crop core export and content-script load order.
- [x] Verify the crop/load-order tests fail before implementation.
- [x] Move canvas crop behavior into a classic-script-safe global core.
- [x] Make the ESM crop utility and content cropper delegate to the same core.
- [x] Run focused crop and manifest tests.

### Task 2: Remove Small Repeated Helpers

**Files:**

- Modify: `background/handlers/session/quick_ask_handler.js`
- Test: `background/handlers/session/quick_ask_handler.test.js`
- Modify: `background/control/wait_helper.js`
- Test: `background/control/wait_helper.test.js`

- [x] Add tests that pin Quick Ask stream update/done messages.
- [x] Add tests that pin listener cleanup in wait helper timeouts.
- [x] Confirm the characterization tests pass before refactoring existing behavior.
- [x] Extract local helper methods for repeated message sending and wait-event logic.
- [x] Run focused background tests.

### Task 3: Verify

**Files:**

- No new production files beyond the tasks above.

- [x] Run `npm test -- shared/dom/crop_utils.test.js scripts/manifest.test.js background/handlers/session/quick_ask_handler.test.js background/control/wait_helper.test.js background/managers/session/request_dispatcher.test.js`.
- [x] Run `npm run build`.
- [x] Run duplication scan excluding generated/vendor/dependency folders.
- [x] Run `npm run package:extension`.
