# jaycebordelon.com

Jayce's personal website and writing. Plain HTML, Tailwind CSS, and small vanilla
JavaScript files. Cloudflare Pages publishes `dist/` from `main`.

## Local development

Use Node 22, as specified in `.nvmrc`.

```bash
npm ci
npm run build
npm run serve
```

Open http://localhost:3000. The local server resolves extensionless article URLs.
After editing HTML or JavaScript, run `npm run build` and refresh. For CSS edits,
`npm run watch:css` recompiles the stylesheet on save. Refresh the browser to see
the change.

## Structure

- `src/pages/`: personal scroll story and writing index
- `src/partials/`: shared layout and article template
- `src/posts/`: Markdown articles with YAML frontmatter
- `src/scripts/`: scroll behavior, résumé reader, and code-copy buttons
- `src/data/github.json`: saved public GitHub contribution activity
- `src/styles.css`: layout, typography, colors, and component styling
- `scripts/build.mjs`: generates HTML, highlighted articles, and sitemap
- `public/`: images, résumé, icons, and local font files

## Design

The home page follows Jayce through work and writing. Barlow Condensed lettering,
the original color portrait, and black and white chapters create the editorial
style. Muted blue accents the hero name and progress bar, with a lighter shade
of the same hue on the dark work section. Both shades echo the photograph's sky.
The hero uses mixed-case DM Sans, with a light italic surname and an offset
color photo capped at 440px wide. The name, subtitle, and smaller photo stack
on mobile.
There is no navigation header or visible image caption. The opening subtitle is “RL & Evals”.

GitHub has a blue contribution calendar below the résumé, without project previews.
A LinkedIn profile preview sits beside a rendered résumé, with a reader that
supports zooming and opening the original PDF. The LinkedIn text comes from
Jayce's existing public résumé and site, because LinkedIn blocked profile access.
The closing section provides booking and email links.

The desktop layout uses 12 columns and 40px gutters. Mobile uses 20px gutters
and stacked chapters. Article text stays in a 720px column. DM Sans handles body
text, with IBM Plex Mono for labels and code. Fonts are served locally with
their licenses. DaisyUI provides buttons, links, and the résumé dialog compiled
with Tailwind.

The scroll script uses native scrolling and scheduled animation frames.
The introduction moves the photograph slightly upward. Experience entries use their content
height, with 32px row padding on desktop and 28px on mobile. The section heading
scrolls normally on mobile.
Reduced-motion preferences disable those effects. All content and links work
without JavaScript. No audio is loaded or played.

Design references:

- [Dan Alcaide](https://danalcaide.com/): condensed type and personal chronology
- [Giulia Gartner](https://giuligartner.com/): photographic chapters
- [Lusion](https://lusion.co/): transitions that use scale to connect sections

## Profile content

GitHub data combines the public contribution calendars for `JayceBordelon` and
`jb-taste` by date. Daily counts and totals are added, and cell intensity is
calculated from the combined daily counts. The per-account counts remain in
the data and cell tooltips. Activity hidden by GitHub is not included. Data is saved in
`src/data/github.json`, with the capture time and date range.
Compilation and page visits do not require GitHub requests. Refresh it explicitly:

```bash
npm run refresh:github
npm run build
```

The refresh command validates both calendars before replacing the saved data.
Sources are [JayceBordelon](https://github.com/JayceBordelon) and
[jb-taste](https://github.com/jb-taste).

`public/Resume.pdf` is the original résumé. Its preview is generated with Poppler:

```bash
pdftoppm -f 1 -singlefile -scale-to 1600 -png public/Resume.pdf public/images/resume-preview
```

The preview opens in a native dialog with zoom, keyboard navigation, Escape to
close, and focus restoration. Without JavaScript, the same links open the PDF.
Download links also remain available. Update the preview when replacing the PDF.

## Writing

Add `src/posts/<slug>.md` with `title`, `summary`, `author`, `published`, and
optional `image`, `readTime`, `label`, and `tags` frontmatter. See the existing
post for an example. The generator creates `/blog/posts/<slug>` and adds the
post to `/blog` and the sitemap. Update the featured article in
`src/pages/index.html` when choosing a different home page feature.

Code fences use Shiki. Headings have anchors. Admonitions use `:::note`,
`:::info`, `:::tip`, `:::warning`, or `:::danger`, optionally followed by a title
and closed with `:::`.

## Checks

Run `npm test` and `npm run build` before pushing. CI checks contribution
aggregation and the generated page files. For
layout changes, review the home page at the start, middle, and end of each
scroll chapter on desktop and mobile. Check reduced motion, keyboard links,
article code-copy buttons, missing assets, and horizontal overflow.

For browser checks with installed Google Chrome, install the optional local
dependency using `npm install --no-save playwright-core`.

## Hosting

Use a feature branch and PR. A push to `main` triggers Cloudflare Pages with
`npm run build`, output directory `dist`, and Node 22. Custom domains and the
`jayceb.com` redirect are configured in Cloudflare. Keep those settings intact.

## Logo sources

Experience logos are stored locally in `public/images/logos/` and keep their
original colors. The name beside each logo provides its accessible label.

- [WashU](https://washu.edu/app/themes/antipasto/assets/img/favicon/apple-touch-icon.png)
- [Mastercard](https://upload.wikimedia.org/wikipedia/commons/a/a4/Mastercard_2019_logo.svg), from Wikimedia because the brand-center download returned HTTP 403
- [Mechanize](https://www.mechanize.work/favicon2.svg)
- [Taste Labs](https://engine.tastelabs.com/apple-touch-icon.png), from Taste Engine
