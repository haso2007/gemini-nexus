import { describe, expect, test } from 'vitest';
import {
  createBridgeToken,
  getOriginFromUrl,
  isTrustedBridgeResponse,
  isTrustedRendererRequest,
  isTrustedParentMessage,
} from '../../lib/message_security.js';

describe('message bridge security helpers', () => {
  test('validates bridge responses against source origin and token', () => {
    const token = createBridgeToken();
    const childWindow = {};
    const trustedEvent = {
      source: childWindow,
      origin: 'chrome-extension://abc123',
      data: { bridgeToken: token },
    };

    expect(isTrustedBridgeResponse(trustedEvent, childWindow, 'chrome-extension://abc123', token)).toBe(true);
    expect(isTrustedBridgeResponse({ ...trustedEvent, origin: 'https://example.com' }, childWindow, 'chrome-extension://abc123', token)).toBe(false);
    expect(isTrustedBridgeResponse({ ...trustedEvent, data: { bridgeToken: 'wrong' } }, childWindow, 'chrome-extension://abc123', token)).toBe(false);
    expect(isTrustedBridgeResponse({ ...trustedEvent, source: {} }, childWindow, 'chrome-extension://abc123', token)).toBe(false);
  });

  test('validates parent messages for extension iframe communication', () => {
    const parentWindow = {};
    const trustedEvent = {
      source: parentWindow,
      origin: 'chrome-extension://abc123',
    };

    expect(isTrustedParentMessage(trustedEvent, parentWindow, 'chrome-extension://abc123')).toBe(true);
    expect(isTrustedParentMessage({ ...trustedEvent, origin: 'https://example.com' }, parentWindow, 'chrome-extension://abc123')).toBe(false);
    expect(isTrustedParentMessage({ ...trustedEvent, source: {} }, parentWindow, 'chrome-extension://abc123')).toBe(false);
  });

  test('validates renderer requests against source origin and token', () => {
    const parentWindow = {};
    const trustedEvent = {
      source: parentWindow,
      origin: 'https://example.com',
      data: { bridgeToken: 'token-1' },
    };

    expect(isTrustedRendererRequest(trustedEvent, parentWindow, 'https://example.com', null)).toBe(true);
    expect(isTrustedRendererRequest(trustedEvent, parentWindow, 'https://example.com', 'token-1')).toBe(true);
    expect(isTrustedRendererRequest({ ...trustedEvent, origin: 'https://evil.example' }, parentWindow, 'https://example.com', 'token-1')).toBe(false);
    expect(isTrustedRendererRequest({ ...trustedEvent, data: { bridgeToken: 'wrong' } }, parentWindow, 'https://example.com', 'token-1')).toBe(false);
    expect(isTrustedRendererRequest({ ...trustedEvent, data: {} }, parentWindow, 'https://example.com', null)).toBe(false);
  });

  test('extracts origins safely from urls', () => {
    expect(getOriginFromUrl('chrome-extension://abc123/sandbox/index.html')).toBe('chrome-extension://abc123');
    expect(getOriginFromUrl('not-a-url')).toBe('');
  });
});
