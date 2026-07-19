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

Blog posts: `src/posts/*.md` with YAML frontmatter. Rendered by `marked` at build time. The renderer is configured in `scripts/build.mjs` (`configureMarked`); all rendering enhancements run at build time and ship as plain HTML + CSS (no client framework). If you need a new MDX-style component in a post, add it as a `marked` extension there, not by pulling in MDX.

Authoring features the renderer supports today:

- **Syntax highlighting** via Shiki (build-time, a `devDependency`, never shipped to the browser). Fence a code block with a language (` ```bash `, ` ```typescript `, etc.) and it gets dual light/dark highlighting that follows the `.dark` theme toggle through CSS variables, zero client JS. Supported languages are the `SHIKI_LANGS` array in `build.mjs`; add to it for a new language. Unknown languages fall back to plaintext rather than failing the build.
- **Admonitions**: `:::note`, `:::info`, `:::tip`, `:::warning`, `:::danger`, optionally with an inline title (`:::warning Heads up`), closed by a line containing only `:::`. Styled in `styles.css` under `.admonition-*`.
- **Heading anchors**: `##` and `###` headings auto-get a slug `id` and a hover `#` link. Slug dedup is per-post.
- **Copy button**: post pages load `src/scripts/copy-code.js`, which adds a hover copy-to-clipboard button to each code block. Progressive enhancement — code is fully readable without JS.

Pages: `src/pages/*.html`. Plain HTML with `{{ placeholders }}` for values the layout fills (title, description, content). The page itself can also have placeholders that the build script fills before wrapping (used for blog/index.html's tag filter + post cards).

## Adding a blog post

1. `src/posts/<slug>.md` with the frontmatter shape used by existing posts (`title`, `summary`, `label`, `author`, `published`, `image`, `readTime`, optional `tags`).
2. Cover image in `public/images/`.
3. `npm run build` → post HTML at `dist/blog/posts/<slug>.html`, card on the blog index, entry in `sitemap.xml`.

## Adding a song to the /music player

The song list is `src/tracks.json`, the single source of truth. The build injects it into the music page and generates a shareable per-song page at `/music/<slug>` for every entry. Nothing else needs editing.

1. Get the audio as `public/audio/<slug>.m4a`. Library convention is AAC around 96 kbps, 48 kHz stereo (the whole catalog was captured this way). From a YouTube link, with `yt-dlp` and `ffmpeg` already on PATH via Homebrew:

   ```bash
   yt-dlp --no-playlist -f bestaudio -x --audio-format m4a --audio-quality 96K \
     -o "public/audio/<slug>.%(ext)s" "<youtube-url>"
   ```

2. Add an entry to `src/tracks.json`:
   - `slug`: unique, kebab-case. Heads up: `let-down` is the Gabriel Piano cover, the original Radiohead track lives at `let-down-radiohead`.
   - `src`: `/audio/<slug>.m4a`
   - `name`: display name in the player
   - `cat`: genre bucket, drives the picker grouping and the neural net's per-genre tuning. Existing values: Originals, Piano Covers, Alternative, Rock, Pop, Folk, Hip Hop, Electronic, Classical, Film Scores. Reuse one before inventing a new one.
   - `sub`: artist line shown under the name (e.g. "Radiohead" or "Chopin, played by Rousseau")
   - `title`: full sentence-ish title used for the per-song page metadata
   Keep entries grouped with their artist/category neighbors in the file.

3. `npm run build`, then check `dist/music/<slug>.html` and `dist/audio/<slug>.m4a` exist.

4. If the song has words, fetch its synced lyrics: `node scripts/fetch-lyrics.mjs <slug>` (see below). If it is an instrumental, add the slug to INSTRUMENTAL in that script instead.

5. Render the song's OG card (every `/music/<slug>` page points at `/images/og/<slug>.png`, and there is no build-time check that it exists, so this is easy to forget):

   ```bash
   npx -y -p http-server@14 http-server . -p 4980 &
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
     --window-size=1200,630 --virtual-time-budget=4000 \
     --screenshot=public/images/og/<slug>.png \
     "http://localhost:4980/scripts/og-template.html?name=<url-encoded name>&sub=<url-encoded sub>"
   ```

## Synced lyrics on /music

Every vocal track can show live lyrics: the current line rides above the transport bar and follows `audio.currentTime`. The pieces:

- `src/lyrics/<slug>.lrc` is the data, standard LRC (`[mm:ss.xx] line`), one file per vocal track. No file means no lyrics UI (that is how instrumentals opt out).
- `scripts/fetch-lyrics.mjs` pulls synced lyrics from LRCLIB, matching by artist, title, and real file duration (via ffprobe). Artist/title spelling quirks (BØRNS, RÜFÜS DU SOL, parenthesized titles) live in its OVERRIDES map, instrumentals in its INSTRUMENTAL set, and vocal tracks where LRCLIB only has wrong-edit timestamps in NO_USABLE_MATCH (those ship without lyrics on purpose). `--force` accepts the best candidate past the 8s duration cap, but only keep such a file if validation passes.
- `scripts/build.mjs` parses the LRC at build time, inlines each song's own lines into its `/music/<slug>` page as `window.SITE_LYRICS`, emits `dist/lyrics/<slug>.json` for in-place track switches, and marks `lyr: 1` on `window.SITE_TRACKS`.
- `src/scripts/lyrics.js` renders the line. It identifies the current track from the URL path, NEVER from `audio.src`: ambience.js hot-swaps the element onto a `blob:` URL once the full file has downloaded, so the src tells you nothing. ambience.js rewrites the path to `/music/<slug>` on init and on every track change, which is exactly the signal to trust.
- Timing correction: put `[offset:±ms]` at the top of an .lrc file. Positive shifts the words later. Applied at build time, so re-run `npm run build` after editing.

Validate that lyrics really sync to the words being sung:

```bash
uv run --with mlx-whisper python scripts/validate-lyrics.py [slug ...]
```

It cuts audio around sampled lyric timestamps, transcribes with whisper (word timestamps on), fuzzy-locates each expected line, and reports SYNCED, OFFSET (with the suggested `[offset:]` tag), or UNVERIFIED per track. UNVERIFIED means whisper could not hear the vocals clearly (dense mix), not that the sync is wrong. Full sample detail lands in `/tmp/lyrics-validation.json`. First run downloads the whisper model from Hugging Face.

## Verifying /music in a real browser

Two headless-Chrome harnesses live in `scripts/`. They need `npm i --no-save playwright-core` once per checkout (kept out of package.json on purpose: CI cannot run them, they need Chrome and real playback) and use the system Chrome via `channel: "chrome"`.

```bash
npm run build && npm run serve   # or point BASE_URL at prod
node scripts/verify-lyrics-live.mjs [slug ...]   # lyric lines match audio.currentTime, popup search + track switch
node scripts/verify-music-ui.mjs                 # share button, clean URLs, ?ts= deep links, popup scroll, mobile layout
BASE_URL=https://jaycebordelon.com node scripts/verify-music-ui.mjs
```

Run both after touching ambience.js, lyrics.js, neural.js, or the /music markup, and once more against prod after the deploy.

## Overlay UI on /music: two traps

Any new panel or popup that floats over the neural net needs BOTH of these, or its scroll and drag get eaten by the machine:

1. `neural.js` has two exclusion lists (one in the `pointerdown` drag handler, one in the `wheel` zoom handler). Add the new panel's selector to both, or wheel events zoom the net instead of scrolling the panel and drags spin it.
2. `body.music-page` sets `touch-action: none` for the net's drag-to-spin, so a scrollable region inside an overlay must set `touch-action: pan-y` (plus `overscroll-behavior: contain`) to be scrollable by touch at all.

The song popup (`.song-panel`) is the reference implementation of both.

## Sharing a moment on /music

The address bar stays clean at `/music/<slug>`. Deep links with `?ts=<seconds>` still seek on load, but they are only ever created intentionally: the link button in the transport bar copies the current song and second to the clipboard. Do not reintroduce ambient URL rewriting with timestamps.

## Adding a page

1. `src/pages/<route>.html` with YAML frontmatter at the top (`title`, `description`, `ogImage`, `canonical`, `header: home` or `blog`).
2. Body is plain HTML with Tailwind utility classes.
3. `npm run build`. The page lands at `/<route>` (Cloudflare Pages resolves the `.html` extension automatically for pretty URLs).

## Design system

Ocean Breeze (palette from [tweakcn](https://tweakcn.com/r/themes/ocean-breeze.json); layout language inspired by tastelabs.com). The site is a calm two-tone field with a single emerald accent. Light theme is a cool alice-blue field (`#F0F8FF`, `oklch(0.9751 0.0127 244.25)`) with dark slate-blue ink text (`oklch(0.3729 0.0306 259.73)`); dark theme is a deep navy field (`#0F172A`) with light-grey text (`oklch(0.8717 0.0093 258.34)`). Muted text is slate-grey. The one accent is emerald green (`#22C55E`, slightly brighter `#34D399` in dark), used sparingly: the brand blob, hover states, the active tag, link underlines. Layout corners use a `0.5rem` radius (`--radius`); imagery is masked into soft squircle tiles (`--radius-tile`); hairlines are a light slate `--border`. A section can flip to the opposite tone with `.section-ink`. Signature elements: the morphing-blob mark (`.blob`), two-tone statement text (`.statement` emphasis plus `.ctx` context), mono HUD meta labels, and scramble-on-hover (`scramble.js`). Motion is CSS plus tiny vanilla JS only: no GSAP, Lenis, or WebGL.

Fonts: DM Sans for display, headings, and body; IBM Plex Mono for nav, labels, meta, and code; Lora available as the serif (`--font-serif`). Visual changes should stay consistent with the tokens in `src/styles.css`.

The favicon mark (navy tile + emerald blob) lives in `public/favicon.svg`. The bitmap icons (`favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) are regenerated from that mark by `node scripts/gen-icons.mjs` — re-run it after any palette change so the bitmaps stay in sync.

## Hosting

This site lives on **Cloudflare Pages**, not a droplet. Every push to `main` triggers a build in Cloudflare's CI (`npm run build`) and publishes `dist/` to their global CDN. Settings (production branch, build command, output dir, Node version) are configured one-time in the Cloudflare dashboard.

There is no Dockerfile, no nginx config, no compose, no SSH deploy. Don't add any. If you find yourself wanting to "containerize this for deploy," stop — the entire deploy is `git push`.

## Hostname routing

Custom domains are set in the Cloudflare Pages dashboard under the project's "Custom domains" tab:

- `jaycebordelon.com` (apex) and `www.jaycebordelon.com` both resolve to the Pages project. Cloudflare auto-provisions Let's Encrypt certs.
- The legacy `jayceb.com` permanent redirect is configured via a Cloudflare Page Rule (or Bulk Redirect) pointing at `https://jaycebordelon.com`. There are still inbound links to `jayceb.com`, so the redirect must keep working.

## No auth here

This site has no signed-in surfaces and no plan to add them.

## Local dev

```bash
npm install
npm run build
npm run serve
# http://localhost:3000
```

Edit, re-run `npm run build`, refresh the browser. Or run `npm run watch:css` in one terminal for Tailwind hot-rebuild while you re-run the HTML build manually.
