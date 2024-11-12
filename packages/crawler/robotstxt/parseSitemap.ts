import { JSDOM } from 'jsdom';

export default function parseSitemap(content: string): string[] {
  const dom = new JSDOM(content);
  const urls: string[] = [];
  const locs = dom.window.document.querySelectorAll('loc');
  locs.forEach((loc) => {
    urls.push(loc.textContent);
  });
  return urls;
}