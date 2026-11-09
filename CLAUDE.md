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

The home page is a personal scroll story with a professional black-and-white
layout, muted sky-blue accents, condensed display type, and Jayce's
selected portrait in its original colors. The hero uses mixed-case DM Sans
with an indented italic surname and an offset photograph capped at 440px wide.
The opening subtitle is exactly “RL & Evals”. Keep the content focused
on work and writing. There is no navigation header. Keep the scroll progress bar,
and omit image captions, sports references, up-right arrow icons, small section
labels, chapter counters, and decorative numbering.

Use the tokens in `src/styles.css`. Barlow Condensed 800 is the display face,
DM Sans is the body face, and IBM Plex Mono is for labels and code. Font files
and licenses live in `public/fonts/`. Use the installed daisyUI buttons and links
where applicable. Body copy is at least 18px and labels are at least 12px.
Desktop gutters are 40px and mobile gutters are 20px.

Keep normal browser scrolling. The home script updates transforms and a progress line. It must not intercept wheel or touch input.
Reduced motion and pages without JavaScript use normal document flow.
Keep visible keyboard focus, real navigation links, and all content available.
Check narrow screens, short viewports, and the reduced-motion layout after
changing sticky positioning or display type. Keep experience entries sized to
their content, with consistent gaps between headings, descriptions, and dividers.
Do not give each entry a viewport-based minimum height or a scroll transform.
The experience heading scrolls normally on mobile.

Give GitHub, LinkedIn, and the résumé real content within the page. GitHub uses
saved public contribution data from JayceBordelon and jb-taste below the résumé,
with no project previews. Add daily counts across accounts and keep the
per-account breakdown available. Never invent activity hidden by GitHub.
The LinkedIn preview uses verified
résumé and site details, without claiming to be a live feed. The original résumé
remains available as a PDF and a zoomable page preview. Preserve keyboard focus,
Escape to close, and ordinary PDF links when JavaScript is unavailable.
Keep the final contact section compact, with a pale-blue background, a “Say hello.”
heading, a clearly named “Book a call” link, and Jayce's public contact email.

The writing index is a plain article list. Articles use a 720px reading column,
colored syntax highlighting, heading links, and code-copy buttons. Keep code
colors independent of the page palette. Preserve the existing
article content when changing its layout. The music catalog and player have
been removed at Jayce's request.

## Hosting

Cloudflare Pages builds `main` and serves `dist/`. Preserve the existing
Cloudflare configuration and custom-domain redirects. Do not add Docker, nginx,
authentication, or a separate deployment server.
