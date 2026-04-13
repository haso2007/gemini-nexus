export function parseStreamableHttpResponse(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && parsed.error) throw new Error(parsed.error.message || 'MCP error');
    if (parsed && parsed.result !== undefined) return parsed.result;
    return parsed;
  } catch (parseError) {
    const trimmed = (text || '').trim();
    const lastBrace = trimmed.lastIndexOf('}');
    const firstBrace = trimmed.indexOf('{');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.slice(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && parsed.error) throw new Error(parsed.error.message || 'MCP error');
        if (parsed && parsed.result !== undefined) return parsed.result;
        return parsed;
      } catch {}
    }

    return { content: [{ type: 'text', text: trimmed }] };
  }
}
