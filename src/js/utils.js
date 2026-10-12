import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Escape any text before inserting it into innerHTML.
 * All AI output and user input must pass through this.
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) links in href attributes. */
export function safeUrl(url) {
  return /^https?:\/\//i.test(url || '') ? esc(url) : '#';
}

/** Escape text and highlight [VERIFY] markers. */
export function escWithVerify(text) {
  return esc(text).replace(/\[VERIFY[^\]]*\]/gi, m => `<mark class="verify-mark">${m}</mark>`);
}

/**
 * Render AI-generated Markdown safely.
 * AI output can echo scraped web content, so HTML is always sanitised.
 * [VERIFY] markers are highlighted after sanitising (they contain no HTML).
 */
export function renderMarkdown(text) {
  if (!text) return '';
  const html = DOMPurify.sanitize(marked.parse(String(text), { gfm: true, breaks: true }));
  return html.replace(/\[VERIFY[^\]<]*\]/gi, m => `<mark class="verify-mark">${m}</mark>`);
}

/** JSON fetch helper that surfaces server error messages. */
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`伺服器回應格式錯誤（HTTP ${res.status}）`);
  }
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    throw err;
  }
  return data;
}

export const CITATION_STATUS = {
  trusted: { label: '信任清單', cls: 'cite-ok', icon: '⭐' },
  verified: { label: '已查證', cls: 'cite-ok', icon: '✅' },
  corrected: { label: '已更正', cls: 'cite-warn', icon: '✏️' },
  not_found: { label: '查無此文獻', cls: 'cite-bad', icon: '⚠️' },
  unverified: { label: '未能查證', cls: 'cite-bad', icon: '⚠️' }
};
