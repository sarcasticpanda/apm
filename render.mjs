// Shared pieces for rendering JavaScript-only documentation in a headless browser
// (Cloudflare Browser Rendering in worker.mjs, Playwright in server.mjs).
import { publicUrl } from './research.mjs';

export const RENDER_USER_AGENT = 'OAuthPath/2.1 (public OAuth documentation research; https://github.com/sarcasticpanda/apm)';

// Every request the rendered page makes must go to a public web host; images, media, and fonts are skipped.
export function allowSubrequest(url, resourceType) {
  if (/^(data|blob):/i.test(url)) return true;
  try { publicUrl(url); } catch { return false; }
  return !['image', 'media', 'font'].includes(resourceType);
}

// Runs inside the page: the visible text of the main content plus its links.
export function extractPage() {
  const root = document.querySelector('main') || document.querySelector('article') || document.querySelector('[role="main"]') || document.body;
  return {
    url: location.href,
    title: document.title,
    text: root.innerText,
    links: [...document.querySelectorAll('a[href]')].slice(0, 400).map((a) => ({ url: a.href, title: (a.innerText || a.textContent || '').trim().slice(0, 150) })),
  };
}
