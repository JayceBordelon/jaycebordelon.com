# CLAUDE.md

Operator notes for this repo. Read before touching the portfolio.

## Development rules

### Always run `npm run build` before pushing

```bash
npm run build
```

Runs the HTML generator (`scripts/build.mjs`) then the Tailwind CLI. Catches:

- Markdown frontmatter typos that break a post's metadata
- Unreplaced `{{ placeholders }}` from a partial template (build prints `warn: unreplaced placeholders: [...]`)
- Tailwind class lookup failures (v4 errors loudly on `@apply` of an unknown utility)

CI runs the same command and asserts the expected files exist in `dist/`.

### Always use feature branches

Never push directly to `main`. Open a PR, let CI run, merge.

## Architecture rules

### No JSX runtime, ever

This site is intentionally framework-free. Adding React, Astro, or any JSX runtime is a regression on the scope this site was deliberately reduced to. If a feature needs interactivity:

1. First try CSS (animations, hover states, `:has()` selectors are powerful).
2. Then try ~10-50 LOC of vanilla JS in `src/scripts/` (see `theme.js`, `typing.js`, `blog-filter.js` as the size budget).
3. Only beyond that, reach for a build-time include (a partial in `src/partials/`) or a build-script enhancement.

The whole site, including images, weighs about 18MB. The HTML + CSS without images is about 90KB. Keep it that way.

### No client-side routing

Every page is a real file at a real URL. No SPA shell, no hydration. The browser navigates between pages with normal HTTP.

### Markdown for posts, HTML for layout

Blog posts: `src/posts/*.md` with YAML frontmatter. Rendered by `marked` at build time. If you need MDX-style components in a post, add it as a build-script hook (e.g. a `[[admonition warning]] ... [[/admonition]]` shortcode the script transforms), not by pulling in MDX.

Pages: `src/pages/*.html`. Plain HTML with `{{ placeholders }}` for values the layout fills (title, description, content). The page itself can also have placeholders that the build script fills before wrapping (used for blog/index.html's tag filter + post cards).

## Adding a blog post

1. `src/posts/<slug>.md` with the frontmatter shape used by existing posts (`title`, `summary`, `label`, `author`, `published`, `image`, `readTime`, optional `tags`).
2. Cover image in `public/images/`.
3. `npm run build` → post HTML at `dist/blog/posts/<slug>.html`, card on the blog index, entry in `sitemap.xml`.

## Adding a page

1. `src/pages/<route>.html` with YAML frontmatter at the top (`title`, `description`, `ogImage`, `canonical`, `header: home` or `blog`).
2. Body is plain HTML with Tailwind utility classes.
3. `npm run build`. The page lands at `/<route>` (Nginx `try_files` resolves the `.html` extension).

## Design system

Carried over from the previous shadcn config: same CSS variables in `src/styles.css`, same fonts (Plus Jakarta Sans, JetBrains Mono, Source Serif 4 for serif blog body), same `--radius` and shadow scale. Visual changes should stay consistent with the tokens.

The shadcn React components themselves are gone. What survives is the design tokens + the Tailwind utility-class strings. Re-applying a shadcn-style Card, Badge, etc. means hand-writing the same `class="..."` string used in the original component.

## Hostname routing

This service binds `Host(\`jaycebordelon.com\`)` + `www.jaycebordelon.com` + the legacy `jayceb.com` apex (permanent redirect) via Traefik labels in `docker-compose.yml`. Traefik runs as a sibling service inside this repo's compose with its own letsencrypt volume and bridge network. If you change the labels, the legacy `jayceb.com` redirect needs to keep working — there are still inbound links pointing at it.

## No auth here

This site has no signed-in surfaces and no plan to add them. Google OAuth lives in [vibetradez.com](https://github.com/JayceBordelon/vibetradez.com) only.

## Related repos

- [vibetradez.com](https://github.com/JayceBordelon/vibetradez.com) — separate stack on a separate droplet.

## Local dev

```bash
npm install
npm run build
npm run serve
# http://localhost:3000
```

Edit, re-run `npm run build`, refresh the browser. Or run `npm run watch:css` in one terminal for Tailwind hot-rebuild while you re-run the HTML build manually.
