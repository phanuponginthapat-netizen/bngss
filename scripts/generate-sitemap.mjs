import { readFileSync, writeFileSync } from 'node:fs';

// Only public CMS pages are enumerated. School records, profile inventories,
// auth flows and session-protected news details are deliberately excluded.
const origin = 'https://bngss.online';
const staticPaths = ['/', '/about/history', '/about/vision', '/about/philosophy', '/about/org-chart', '/org-chart', '/personnel', '/subject-groups', '/news', '/calendar', '/downloads', '/download-app', '/faq', '/contact', '/pdpa', '/find', '/ar', '/help'];
const env = { ...process.env };
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^(VITE_SUPABASE_URL|VITE_SUPABASE_PUBLISHABLE_KEY)=["']?([^"'\r]+)["']?$/);
    if (match && !env[match[1]]) env[match[1]] = match[2];
  }
} catch { /* CI can supply these public values directly. */ }
const backend = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!backend || !key) throw new Error('Public CMS connection is required to generate a complete sitemap');
const paths = new Set(staticPaths);
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(`${backend}/rest/v1/cms_pages?select=slug&is_published=eq.true&order=id.asc&offset=${offset}&limit=1000`, {
    headers: { apikey: key }, signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Public CMS sitemap read failed (${response.status})`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error('Invalid public CMS sitemap response');
  for (const row of rows) if (typeof row.slug === 'string' && row.slug) paths.add(`/page/${encodeURIComponent(row.slug)}`);
  if (rows.length < 1000) break;
}
const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
// No lastmod: generation time is not a page content modification timestamp.
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths].map(path => `  <url><loc>${escape(origin + path)}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Generated sitemap for ${paths.size} public pages`);