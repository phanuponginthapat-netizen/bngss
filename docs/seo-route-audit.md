# SEO route audit

Rule: public pages describe their own content in search/share metadata; discovery lists never inventory private school records. No settled records, access policies, module toggles or examples are changed.

## Reviewed surfaces

| Surface | Result |
| --- | --- |
| Homepage and published `/page/:slug` CMS pages | PageMetadata uses the school/page title and content. Loader branding no longer overwrites it. School JSON-LD uses real available CMS values. |
| History, vision, philosophy, personnel, subject groups, news list, calendar, documents, app downloads, FAQ, contact | All use PublicPageLayout metadata. History/subject/news/philosophy section headings follow h1 → h2; public search inputs have names. |
| `/org-chart`, `/about/org-chart` | Removed competing title writes; shared route metadata owns title/description/canonical. |
| `/ar`, `/ar/p/:slug`, `/ar/:code` | Shared/loaded-item titles and descriptions, named gallery search; no competing title writes. Sitemap reads every public active project/experience using existing anonymous policies, rather than capped list RPCs. |
| `/p/:id` | Loaded public profile provides title, description and Person schema. No profile inventory is added to discovery. |
| `/dashboard/news/:id` | Loaded title/content and Article schema for published rows; authentication/draft rules unchanged. Not in sitemap; not advertised as public news details. |
| `/pdpa`, `/install`, `/help` | Distinct shared metadata; help search has an accessible name. Included in public sitemap. |
| `/asset/:id`, `/sdq-assess/:studentId`, `/visit`, `/parent-app` | Generic purpose-specific metadata without personal records. Not inventoried in sitemap. Existing reads/writes/settings unchanged. |
| `/kiosk`, `/face-kiosk`, `/kiosk-tablet`, `/liff` and leave/grades/attendance | Distinct purpose-specific metadata. Scanner and LINE identity flows remain unchanged and excluded from sitemap. |
| Login, signup, setup, link-account, OAuth consent, dashboard and unknown routes | Not in sitemap; global metadata still self-references the current route. No new robots/noindex settings. |
| PublicNavbar, carousel, footer, public personnel/profile/AR/help search | Named controls; public submenu can open with focus/click as well as pointer. Credit footer remains untouched. |

## Background and data functions

- `useSystemSettings`, cached/dynamic manifest branding and initial HTML branding do not replace route titles or search/share descriptions. PWA manifest still retains app identity and icons.
- Notification tab badges retain the page title; notification behavior is unchanged.
- The manifest Cloud function emits PWA installation JSON, not page metadata; reviewed and unchanged.
- `generate-sitemap.mjs` runs before dev/build/build:dev, pages published CMS rows and public active AR rows, fails on unreadable sources, and never uses generation-time lastmod. Canonical public connection comes from the same app source, including in GitHub CI without `.env`.
- Canonical-domain sitemap remains `https://bngss.online/sitemap.xml`; the Lovable-origin mirror is only for the Search Console URL-prefix onboarding.
- Public profile, org-chart, AR, CMS and protected news data readers retain their existing visibility rules. No database functions or permissions were modified.

## Verification and limitations

Verified 40 preview route loads (35 sitemap routes and five service/auth entrypoints): one description, canonical and self-referencing og:url per rendered route. Two sitemap privacy/date tests passed; mobile menu and named AR search were exercised. Google verification requires the exact META tag on the published root and a live same-origin sitemap; do not claim setup complete until verify/add/list-sites/submit succeeds. Public-profile search and AR list RPCs currently report permissions errors for signed-out users; no permission expansion was made as part of SEO. AR detail routes loaded real published item titles through their existing readers. Protected news has no published sample available for a real detail-flow check.