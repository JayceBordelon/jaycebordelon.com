# CLAUDE.md

Operator notes for this repo. Read before touching the portfolio.

## Development rules

### Always biome check --write before pushing

```bash
npx biome check --write .
```

`biome check` without `--write` is not enough — it reports format errors but doesn't apply them, so the working tree still has CI-failing files when you commit. CI runs Biome with format-as-error semantics; a stray unwrapped string or long line fails the PR even though `biome check` (no `--write`) only "warned" locally.

### Always next build before pushing

```bash
npx next build
```

Catches type errors, broken imports, missing static assets, and MDX frontmatter typos. CI runs this on every PR.

### Always use feature branches

Never push directly to `main`. Open a PR, let CI run, merge.

## Latest documentation, not recalled syntax

When working with Next.js, shadcn/ui, Tailwind CSS, MDX, Framer Motion, or any external library, fetch and read the current documentation before writing code. Don't rely on recalled syntax or API signatures — they may be outdated. This applies even if it takes extra time. Incorrect assumptions about APIs cause more rework than the time saved by skipping docs.

## Design system consistency

CSS variables in `globals.css`, font stack (Plus Jakarta Sans, JetBrains Mono), shadcn/ui configuration (new-york style, neutral base, lucide icons) are shared with sibling projects. Visual changes here should stay consistent with the same tokens used elsewhere.

## Blog content lifecycle

- Posts: `content/posts/*.mdx`. Built into the production sitemap and blog index.
- Drafts: `drafts/*.mdx`. Not built into the production site. Move into `content/posts/` to publish.
- Frontmatter parsed by `lib/mdx.ts`. Required: `title`, `date` (ISO `YYYY-MM-DD`), `description`, `tags` (string array).

## Hostname routing

This service binds `Host(\`jaycebordelon.com\`)` + `www.jaycebordelon.com` + the legacy `jayceb.com` apex (permanent redirect) via Traefik labels in `docker-compose.yml`. The Traefik container itself lives outside this repo on the `app-network` (declared `external`). If you change the labels, the legacy `jayceb.com` redirect needs to keep working — there are still inbound links pointing at it.

## Related services

- [auth.jaycebordelon.com](https://github.com/JayceBordelon/auth.jaycebordelon.com) — OAuth provider for any signed-in surfaces added here.
- [vibetradez.com](https://github.com/JayceBordelon/vibetradez.com) — sibling project on the same droplet.

## Local dev

```bash
npm run dev
# http://localhost:3000
```

Hot reload + MDX changes pick up automatically.
