export const DEFAULT_PROTOCOL_VERSIONS = ['2024-11-05', '2024-10-07', '2024-06-20'];

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function asWsUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  return trimmed;
}

export function asHttpUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed;
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function extractFilesFromContent(content) {
  if (!Array.isArray(content)) return [];
  const files = [];
  for (const part of content) {
    if (!part || part.type !== 'image') continue;
    const mimeType = part.mimeType || 'image/png';
    const data = part.data;
    if (typeof data !== 'string' || data.length === 0) continue;
    const base64 = data.startsWith('data:') ? data : `data:${mimeType};base64,${data}`;
    files.push({
      base64,
      type: mimeType,
      name: `mcp-image-${Date.now()}.${mimeType.includes('png') ? 'png' : 'img'}`,
    });
  }
  return files;
}

export function normalizeMcpToolResult(result) {
  if (typeof result === 'string') return { text: result, files: [] };

  if (result && typeof result === 'object') {
    if (Array.isArray(result.content)) {
      return {
        text: extractTextFromContent(result.content),
        files: extractFilesFromContent(result.content),
      };
    }

    if (typeof result.text === 'string') return { text: result.text, files: [] };
  }

  try {
    return { text: JSON.stringify(result, null, 2), files: [] };
  } catch {
    return { text: String(result), files: [] };
  }
}

export function summarizeInputSchema(schema) {
  if (!schema || typeof schema !== 'object') return '';
  const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  const parts = [];
  for (const key of required) {
    const spec = props[key] && typeof props[key] === 'object' ? props[key] : {};
    const type = typeof spec.type === 'string' ? spec.type : 'any';
    parts.push(`${key}: ${type}`);
  }
  return parts.length ? `{ ${parts.join(', ')} }` : '{}';
}
