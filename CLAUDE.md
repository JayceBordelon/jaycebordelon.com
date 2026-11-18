# jaycebordelon.com

Read `README.md` for setup, content authoring, and hosting.

## Development

- Use feature branches and PRs. Never push directly to `main`.
- Run `npm run build` before pushing. Fix errors and unresolved template fields.
- Use Node 22 and the committed npm lockfile.
- Preserve plain HTML and vanilla JavaScript. No JSX runtime, client framework,
  or client routing. Every page must work at its own URL.
- Do not deploy unless the current task authorizes it.

## Design

The home page is a compact single-page profile: all information in one 840px
column with minimal scrolling. Order: name with the italic accent surname, a
role line of exactly "RL & Evals · Taste Labs · San Francisco", a short
summary, a mono stack line, the LinkedIn, résumé, booking, and email links,
then Experience, Writing, and GitHub sections. The portrait sits beside the
intro at about 200px wide in its original colors. There is no navigation
header, no scroll story, no reading progress bar, and no decorative numbering,
image captions, or chapter counters.

Use the tokens in `src/styles.css`. DM Sans is the only display and body face,
and IBM Plex Mono is for labels and code. Section headings are small uppercase
mono labels. Do not reintroduce oversized display headings or full-viewport
scenes. Font files and licenses live in `public/fonts/`. Use the installed
daisyUI buttons and links where applicable. Body copy is at least 18px and
labels are at least 12px. Desktop gutters are 40px and mobile gutters are 20px.

Keep normal browser scrolling with no scroll-driven script. The only home page
script is the résumé modal (`profiles.js`). Pages without JavaScript keep all
content available through ordinary links. Keep visible keyboard focus, real
navigation links, and 44px touch targets. Experience entries are single
compact rows (logo, company and role, location) in reverse chronological
order, sized to their content.

Give GitHub and the résumé real content within the page. GitHub uses saved
public contribution data from JayceBordelon and jb-taste, with no project
previews. Add daily counts across accounts and keep the per-account breakdown
available. Never invent activity hidden by GitHub. The original résumé remains
available as a PDF and the zoomable modal preview. Preserve keyboard focus,
Escape to close, and ordinary PDF links when JavaScript is unavailable.
Contact is the email address and the "Book a call" link in the intro.

The writing index is a plain article list. Articles use a 720px reading column,
colored syntax highlighting, heading links, and code-copy buttons. Keep code
colors independent of the page palette. Preserve the existing
article content when changing its layout. The music catalog and player have
been removed at Jayce's request.

## Hosting

Cloudflare Workers Builds (`wrangler.jsonc`, static assets, the "Workers
Builds: portfolio" check) builds `main` and serves `dist/`. Preserve the
existing Cloudflare configuration and custom-domain redirects. Do not add Docker, nginx,
authentication, or a separate deployment server.
