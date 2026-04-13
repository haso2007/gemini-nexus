const DROP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta']);
const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'button', 'code', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
  'img', 'li', 'ol', 'p', 'pre', 'rect', 'circle', 'line', 'path', 'polygon', 'polyline', 'span',
  'strong', 'svg', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'
]);
const GLOBAL_ATTRS = new Set(['aria-hidden', 'aria-label', 'class', 'role', 'title']);
const TAG_ATTRS = {
  a: new Set(['href', 'rel', 'target']),
  button: new Set(['type']),
  img: new Set(['alt', 'height', 'src', 'width']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  svg: new Set(['fill', 'height', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'viewbox', 'width', 'xmlns']),
  rect: new Set(['fill', 'height', 'rx', 'ry', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'width', 'x', 'y']),
  circle: new Set(['cx', 'cy', 'fill', 'r', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width']),
  line: new Set(['fill', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width', 'x1', 'x2', 'y1', 'y2']),
  path: new Set(['d', 'fill', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width']),
  polygon: new Set(['fill', 'points', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width']),
  polyline: new Set(['fill', 'points', 'stroke', 'stroke-linecap', 'stroke-linejoin', 'stroke-width']),
};
const SAFE_HREF_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const SAFE_SRC_PROTOCOLS = new Set(['blob:', 'data:', 'http:', 'https:']);

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeAttribute(text) {
  return escapeHtml(text);
}

function isSafeUrl(tagName, attrName, value) {
  if (!value) return false;
  if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../') || value.startsWith('#')) {
    return true;
  }
  try {
    const url = new URL(value, 'https://example.invalid');
    if (attrName === 'href') {
      return tagName === 'a' && SAFE_HREF_PROTOCOLS.has(url.protocol);
    }
    if (attrName === 'src') {
      return SAFE_SRC_PROTOCOLS.has(url.protocol);
    }
    return false;
  } catch {
    return false;
  }
}

function sanitizeElement(element) {
  const tagName = element.tagName.toLowerCase();
  if (DROP_CONTENT_TAGS.has(tagName)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    while (element.firstChild) {
      fragment.appendChild(element.firstChild);
    }
    element.replaceWith(fragment);
    return;
  }

  for (const attr of [...element.attributes]) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    const tagAllowed = TAG_ATTRS[tagName] && TAG_ATTRS[tagName].has(name);
    const isGlobal = GLOBAL_ATTRS.has(name);

    if (name.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    if (!isGlobal && !tagAllowed) {
      element.removeAttribute(attr.name);
      continue;
    }

    if ((name === 'href' || name === 'src') && !isSafeUrl(tagName, name, value)) {
      element.removeAttribute(attr.name);
      continue;
    }
  }

  if (tagName === 'a') {
    const href = element.getAttribute('href');
    if (href) {
      element.setAttribute('rel', 'noopener noreferrer');
      if (!element.getAttribute('target')) {
        element.setAttribute('target', '_blank');
      }
    } else {
      element.removeAttribute('target');
      element.removeAttribute('rel');
    }
  }

  for (const child of [...element.children]) {
    sanitizeElement(child);
  }
}

export function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html ?? ''}</body>`, 'text/html');

  for (const child of [...doc.body.children]) {
    sanitizeElement(child);
  }

  return doc.body.innerHTML;
}
