# jaycebordelon.com

Personal portfolio and blog. Next.js 16 App Router, Tailwind CSS v4, shadcn/ui (new-york), MDX, Framer Motion.

## Related repos

- [auth.jaycebordelon.com](https://github.com/JayceBordelon/auth.jaycebordelon.com) — centralized OAuth identity provider. Any signed-in surface here brokers through it.
- [vibetradez.com](https://github.com/JayceBordelon/vibetradez.com) — sibling project deployed on the same droplet (AI-powered options trading service).

## What's here

- `app/` — Next.js App Router pages (home, blog index, blog post template, legacy redirects)
- `components/` — React components + the shadcn primitive layer
- `content/` — MDX blog posts (one file per post, frontmatter-driven)
- `lib/` — utilities (date formatting, MDX helpers, theme tokens)
- `Dockerfile` — multi-stage Node.js build for production deploys
- `docker-compose.yml` — single-service compose slice with Traefik labels for `jaycebordelon.com` + `www` + `jayceb.com` legacy redirect
- `.github/workflows/` — PR checks (Biome lint, Next build, actionlint on workflows)

## Tech stack

| Component | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS v4, shadcn/ui (new-york style, neutral base) |
| Content | MDX (one post per file in `content/`) |
| Animation | Framer Motion |
| Lint / format | Biome (configured at the repo root) |
| Container | Multi-stage Node.js Dockerfile, deployed via Docker Compose behind Traefik |

## Local development

```bash
npm install
npm run dev
# http://localhost:3000
```

Hot reload, MDX changes pick up automatically.

## Building

```bash
npx next build
```

CI runs this on every PR. The build catches type errors, broken imports, missing static assets, and the kind of MDX frontmatter typo that 404s a post in production.

## Linting

```bash
npx biome check --write .
```

`biome check` without `--write` is not enough — it reports format errors but doesn't apply them, so the working tree still has CI-failing files when you commit. Always use `--write`. CI runs Biome with format-as-error semantics.

## Hostname routing

Production binds the canonical domain plus the `www` subdomain plus the legacy `jayceb.com` apex (permanent redirect). All three resolve to one container. Traefik labels in `docker-compose.yml` declare:

- `jaycebordelon.com` / `www.jaycebordelon.com` → this container, port 3000
- `jayceb.com` / `www.jayceb.com` → 301 redirect to `jaycebordelon.com`

The Traefik container itself is not in this repo; it's expected to be running on the same Docker network (`app-network`, declared `external`) alongside this service.

## Design system

Shared with the operator's other projects: same design tokens (CSS variables in `globals.css`), font stack (Plus Jakarta Sans, JetBrains Mono), shadcn/ui configuration (new-york style, neutral base, lucide icons). Visual changes here should stay consistent with anywhere else those tokens land.

## Blog content

Posts live in `content/posts/` as MDX files. Frontmatter is parsed by `lib/mdx.ts`. Each post needs:

- `title` — the post title
- `date` — ISO date (`YYYY-MM-DD`)
- `description` — meta description for OG / search
- `tags` — array of strings for filtering on the blog index

Drafts live in `drafts/` and are not built into the production site.

## CI / CD

`.github/workflows/pr-checks.yml` runs:

1. Biome check on the full repo (lint + format)
2. `next build` (production build)
3. actionlint on the workflow files themselves

Production deploy lives in the operator's deploy pipeline (separate from this repo).
