export function createBridgeToken() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `bridge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getOriginFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.origin && parsed.origin !== 'null') {
      return parsed.origin;
    }
    return parsed.protocol && parsed.host ? `${parsed.protocol}//${parsed.host}` : '';
  } catch {
    return '';
  }
}

export function isTrustedBridgeResponse(event, expectedWindow, expectedOrigin, expectedToken) {
  return Boolean(
    expectedWindow &&
    event &&
    event.source === expectedWindow &&
    event.origin === expectedOrigin &&
    event.data &&
    event.data.bridgeToken === expectedToken
  );
}

export function isTrustedRendererRequest(event, expectedWindow, expectedOrigin, expectedToken) {
  const bridgeToken = event && event.data ? event.data.bridgeToken : null;
  return Boolean(
    expectedWindow &&
    event &&
    event.source === expectedWindow &&
    event.origin === expectedOrigin &&
    typeof bridgeToken === 'string' &&
    bridgeToken.length > 0 &&
    (expectedToken == null || bridgeToken === expectedToken)
  );
}

export function isTrustedParentMessage(event, expectedWindow, expectedOrigin) {
  return Boolean(
    expectedWindow &&
    event &&
    event.source === expectedWindow &&
    event.origin === expectedOrigin
  );
}
