#!/usr/bin/env node
/*
 * Static site build.
 * Input: src/ tree (pages with frontmatter + partials + markdown posts).
 * Output: dist/ tree (plain HTML + CSS + images), drop-in for nginx.
 *
 * Pipeline:
 *   1. Render the background SVG once (math-generated, deterministic).
 *   2. Render each src/pages/**.html through the layout partial.
 *   3. Render each src/posts/*.md to a blog post HTML via the post partial.
 *   4. Render the blog index with the list of post cards.
 *   5. Compile Tailwind (separate npm step; not done here).
 *   6. Copy public assets + scripts/ to dist/.
 *   7. Emit sitemap.xml + robots.txt.
 *
 * No JS frameworks, no JSX. marked + gray-matter + the standard library.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { createHighlighter } from "shiki";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const SITE_URL = process.env.SITE_URL || "https://jaycebordelon.com";

/* ---------------------------------------------------------------- *
 * fs helpers                                                        *
 * ---------------------------------------------------------------- */

function read(path) {
  return readFileSync(path, "utf8");
}
function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}
function walk(dir, ext) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (!ext || entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

/* ---------------------------------------------------------------- *
 * Frontmatter-style header on .html source files                    *
 * ---------------------------------------------------------------- */

function parsePageFrontmatter(raw) {
  // src/pages/*.html files start with --- ... --- YAML frontmatter
  // followed by the body. Reuse gray-matter so YAML works.
  if (!raw.startsWith("---")) return { data: {}, content: raw };
  return matter(raw);
}

/* ---------------------------------------------------------------- *
 * Layout rendering                                                  *
 * ---------------------------------------------------------------- */

function applyTemplate(template, vars) {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const re = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    out = out.replace(re, value ?? "");
  }
  // Surface any unreplaced placeholders so typos fail loud instead of
  // shipping a literal `{{ foo }}` to production.
  const unreplaced = out.match(/{{\s*[a-zA-Z][a-zA-Z0-9_]*\s*}}/g);
  if (unreplaced && unreplaced.length > 0) {
    console.warn("warn: unreplaced placeholders:", [...new Set(unreplaced)]);
  }
  return out;
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJSONForScript(obj) {
  // JSON-LD injected as the body of a <script>. JSON.stringify can emit
  // a literal '</script>' inside string fields (author-controlled), which
  // would break out of the script tag and create an XSS surface. Escape
  // '<' to its JSON unicode form so the browser parser can't terminate
  // the script early. Input is the OBJECT, not a pre-stringified string.
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

/* ---------------------------------------------------------------- *
 * Markdown engine config (Shiki highlighting, heading anchors,      *
 * admonitions). All build-time; the rendered HTML ships no JS.      *
 * ---------------------------------------------------------------- */

// Languages the posts actually use, plus a few common ones so future
// posts highlight without a build change. Keep this list tight — each
// grammar adds to build time, not to shipped output.
const SHIKI_LANGS = ["bash", "shell", "protobuf", "typescript", "javascript", "json", "go", "python", "html", "css", "yaml", "diff", "sql", "rust", "c", "cpp"];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, "") // strip any inline HTML tags
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const ADMONITION_META = {
  note: { label: "Note" },
  info: { label: "Info" },
  tip: { label: "Tip" },
  warning: { label: "Warning" },
  danger: { label: "Danger" },
};

// Map a fenced code's language token to a grammar Shiki has loaded,
// falling back to plaintext so an unknown lang never throws the build.
function resolveLang(highlighter, lang) {
  const requested = (lang || "").trim().split(/\s+/)[0].toLowerCase();
  if (requested && highlighter.getLoadedLanguages().includes(requested)) return requested;
  return "text";
}

function configureMarked(highlighter) {
  const usedSlugs = new Map();

  marked.use({
    gfm: true,
    hooks: {
      preprocess(markdown) {
        // Heading-id dedup is per-document, not per-build.
        usedSlugs.clear();
        return markdown;
      },
    },
    extensions: [
      {
        name: "admonition",
        level: "block",
        start(src) {
          const i = src.indexOf("\n:::");
          const head = src.startsWith(":::") ? 0 : -1;
          if (head === 0) return 0;
          return i === -1 ? undefined : i + 1;
        },
        tokenizer(src) {
          const rule = /^:::(\w+)(?:[ \t]+([^\n]*))?\n([\s\S]*?)\n:::[ \t]*(?:\n+|$)/;
          const match = rule.exec(src);
          if (!match) return undefined;
          const [raw, kindRaw, titleRaw, body] = match;
          const kind = kindRaw.toLowerCase();
          if (!ADMONITION_META[kind]) return undefined;
          const token = {
            type: "admonition",
            raw,
            kind,
            title: (titleRaw || "").trim(),
            tokens: [],
          };
          this.lexer.blockTokens(body, token.tokens);
          return token;
        },
        renderer(token) {
          const meta = ADMONITION_META[token.kind];
          const heading = token.title || meta.label;
          const inner = this.parser.parse(token.tokens);
          return `<div class="admonition admonition-${token.kind}">
  <p class="admonition-title">${escapeHTML(heading)}</p>
  <div class="admonition-content">${inner}</div>
</div>\n`;
        },
      },
    ],
    renderer: {
      code({ text, lang }) {
        const language = resolveLang(highlighter, lang);
        return highlighter.codeToHtml(text, {
          lang: language,
          themes: { light: "github-light-default", dark: "github-dark-default" },
          defaultColor: false,
        });
      },
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        if (depth === 1 || depth > 3) return `<h${depth}>${inner}</h${depth}>\n`;
        const base = slugify(inner) || "section";
        const seen = usedSlugs.get(base) ?? 0;
        usedSlugs.set(base, seen + 1);
        const id = seen === 0 ? base : `${base}-${seen}`;
        return `<h${depth} id="${id}" class="scroll-mt-24">${inner}<a href="#${id}" class="heading-anchor" aria-label="Link to this section">#</a></h${depth}>\n`;
      },
    },
  });
}

/* ---------------------------------------------------------------- *
 * Background SVG (deterministic; generated once)                    *
 * ---------------------------------------------------------------- */

function generateBackgroundPaths() {
  // Mirror of the prior Framer Motion background-paths math. 80 paths
  // × 2 mirrored sets = 160 quadratic Bézier curves with staggered
  // offsets. Stroke opacity scales with index so the field looks
  // diffused rather than uniform.
  const out = [];
  for (const position of [1, -1]) {
    const numPaths = 80;
    const spread = 700;
    const diagonalOffset = 350;
    const baseLeftX = -1200 * position;
    const baseLeftY = diagonalOffset;
    const baseMidX = 0;
    const baseMidY = -100;
    const baseRightX = 1200 * position;
    const baseRightY = -diagonalOffset;

    for (let i = 0; i < numPaths; i++) {
      const t = (i / (numPaths - 1)) * 2 - 1;
      const spreadAmount = t * spread;
      const staggerX = t * 150;
      const staggerY = t * 100;

      const pathLeftX = baseLeftX + staggerX;
      const pathLeftY = baseLeftY + staggerY;
      const pathQuarterX = baseLeftX * 0.5 + staggerX * 0.7;
      const pathQuarterY = baseLeftY * 0.6 + baseMidY * 0.4 + staggerY * 0.8;
      const pathMidX = baseMidX + staggerX;
      const pathMidY = baseMidY + staggerY * 0.5;
      const pathRightX = baseRightX + staggerX;
      const pathRightY = baseRightY + staggerY * 1.5;

      const spreadLeftX = (pathLeftX + pathQuarterX) / 2;
      const spreadLeftY = (pathLeftY + pathQuarterY) / 2 - spreadAmount * 0.6;
      const spread1X = (pathQuarterX + pathMidX) / 2;
      const spread1Y = (pathQuarterY + pathMidY) / 2 + spreadAmount;
      const spread2X = (pathMidX + pathRightX) / 2;
      const spread2Y = (pathMidY + pathRightY) / 2 - spreadAmount;

      const d = `M${pathLeftX} ${pathLeftY} Q${spreadLeftX} ${spreadLeftY} ${pathQuarterX} ${pathQuarterY} Q${spread1X} ${spread1Y} ${pathMidX} ${pathMidY} Q${spread2X} ${spread2Y} ${pathRightX} ${pathRightY}`;
      const opacity = 0.08 + i * 0.012;
      // path-draw animation runs once on first paint with a stagger so
      // the field "writes itself in" over a couple seconds; pure CSS,
      // no JS runtime cost. After settling, paths stay drawn.
      const delay = ((t + 1) / 2) * 2; // 0s to 2s
      out.push(`<path d="${d}" stroke="currentColor" stroke-width="0.5" stroke-opacity="${opacity.toFixed(3)}" style="stroke-dasharray:6000;stroke-dashoffset:6000;animation:draw 8s ease-out ${delay.toFixed(2)}s forwards;" />`);
    }
  }
  return out.join("\n      ");
}

/* ---------------------------------------------------------------- *
 * Build defaults                                                    *
 * ---------------------------------------------------------------- */

const layoutTemplate = read(join(SRC, "partials/layout.html"));
const headerHome = read(join(SRC, "partials/header-home.html"));
const headerBlog = read(join(SRC, "partials/header-blog.html"));
const backgroundTemplate = read(join(SRC, "partials/background.html"));
const postTemplate = read(join(SRC, "partials/post.html"));
const backgroundSVG = applyTemplate(backgroundTemplate, { backgroundPaths: generateBackgroundPaths() });

function renderPage({ frontmatter, body, slug }) {
  const header = frontmatter.header === "blog" ? headerBlog : headerHome;
  const jsonLd = frontmatter.jsonLd ?? defaultJsonLd();
  return applyTemplate(layoutTemplate, {
    title: escapeHTML(frontmatter.title || "Jayce Bordelon"),
    description: escapeHTML(frontmatter.description || ""),
    canonical: frontmatter.canonical || `${SITE_URL}${slug}`,
    ogTitle: escapeHTML(frontmatter.ogTitle || frontmatter.title || "Jayce Bordelon"),
    ogType: frontmatter.ogType || "website",
    ogImage: frontmatter.ogImage ? `${SITE_URL}${frontmatter.ogImage}` : `${SITE_URL}/images/dawg.jpg`,
    htmlClass: frontmatter.htmlClass || "",
    bodyClass: frontmatter.bodyClass || "min-h-screen",
    header,
    content: body,
    background: backgroundSVG,
    pageScripts: frontmatter.pageScripts || "",
    jsonLd: escapeJSONForScript(jsonLd),
  });
}

function defaultJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Jayce Bordelon",
    url: SITE_URL,
    jobTitle: "Software Engineer",
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Washington University in St. Louis",
    },
    sameAs: ["https://github.com/JayceBordelon", "https://linkedin.com/in/JayceBordelon"],
  };
}

/* ---------------------------------------------------------------- *
 * Page rendering                                                    *
 * ---------------------------------------------------------------- */

function buildPages() {
  const files = walk(join(SRC, "pages"), ".html");
  for (const file of files) {
    const rel = relative(join(SRC, "pages"), file);
    // blog/index.html is handled by buildBlogIndex after posts have
    // been rendered (it needs the post list to fill in the cards).
    if (rel === "blog/index.html") continue;
    const raw = read(file);
    const { data, content } = parsePageFrontmatter(raw);
    const slug = "/" + (rel === "index.html" ? "" : rel.replace(/\/index\.html$/, "").replace(/\.html$/, ""));
    const html = renderPage({ frontmatter: data, body: content, slug });
    write(join(DIST, rel), html);
  }
}

/* ---------------------------------------------------------------- *
 * Posts                                                             *
 * ---------------------------------------------------------------- */

function authorInitials(name) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function buildPosts() {
  const postsDir = join(SRC, "posts");
  if (!existsSync(postsDir)) return [];

  const posts = [];
  for (const file of readdirSync(postsDir).filter((f) => f.endsWith(".md"))) {
    const id = file.replace(/\.md$/, "");
    const raw = read(join(postsDir, file));
    const { data, content } = matter(raw);
    const html = marked.parse(content);

    const tagBlock =
      data.tags && data.tags.length > 0
        ? `<div class="flex flex-wrap gap-2 pt-2">${data.tags
            .map(
              (t) =>
                `<span class="inline-flex items-center rounded-md border border-input px-2 py-0.5 text-xs font-medium">${escapeHTML(t)}</span>`
            )
            .join("")}</div>`
        : "";

    const readTimeBlock = data.readTime
      ? `<span class="text-muted-foreground">&bull;</span>
         <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
             <circle cx="12" cy="12" r="10" />
             <polyline points="12 6 12 12 16 14" />
           </svg>
           <span>${escapeHTML(data.readTime)}</span>
         </div>`
      : "";

    const body = applyTemplate(postTemplate, {
      label: escapeHTML(data.label || ""),
      title: escapeHTML(data.title || ""),
      summary: escapeHTML(data.summary || ""),
      author: escapeHTML(data.author || ""),
      authorDesc: escapeHTML(data.authorDesc || ""),
      authorInitials: escapeHTML(authorInitials(data.author || "")),
      published: data.published || "",
      publishedFormatted: formatDate(data.published),
      readTimeBlock,
      tagBlock,
      content: html,
    });

    const slug = `/blog/posts/${id}`;
    const canonical = `${SITE_URL}${slug}`;
    const ogImage = data.image ? `${SITE_URL}${data.image}` : `${SITE_URL}/images/dawg.jpg`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: data.title,
      description: data.summary,
      author: { "@type": "Person", name: data.author, url: SITE_URL },
      datePublished: data.published,
      image: ogImage,
      url: canonical,
      publisher: { "@type": "Person", name: "Jayce Bordelon", url: SITE_URL },
    };

    const page = renderPage({
      frontmatter: {
        title: data.title,
        ogTitle: data.title,
        description: data.summary,
        canonical,
        ogType: "article",
        ogImage: data.image,
        header: "blog",
        bodyClass: "min-h-screen",
        pageScripts: '<script src="/scripts/copy-code.js" defer></script>',
        jsonLd,
      },
      body,
      slug,
    });

    write(join(DIST, "blog/posts", `${id}.html`), page);

    posts.push({ id, ...data });
  }
  posts.sort((a, b) => (a.published < b.published ? 1 : -1));
  return posts;
}

/* ---------------------------------------------------------------- *
 * Blog index                                                        *
 * ---------------------------------------------------------------- */

function renderPostCard(post) {
  const initials = authorInitials(post.author || "");
  const tags = (post.tags || [])
    .map((t) => `<span class="tag inline-flex items-center rounded-md border border-input px-2 py-0.5 text-xs font-medium cursor-pointer hover:bg-accent" data-tag="${escapeHTML(t)}">${escapeHTML(t)}</span>`)
    .join("");

  const readTime = post.readTime
    ? `<span>&bull;</span>
       <div class="flex items-center gap-1">
         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
           <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
         </svg>
         <span>${escapeHTML(post.readTime)}</span>
       </div>`
    : "";

  const tagsAttr = (post.tags || []).map((t) => escapeHTML(t)).join("|");

  return `
<a href="/blog/posts/${post.id}" class="group post-card" data-tags="${tagsAttr}">
  <div class="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all hover:shadow-lg">
    <div class="relative aspect-video w-full overflow-hidden">
      <img src="${escapeHTML(post.image)}" alt="${escapeHTML(post.title)}" class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
      <div class="absolute left-4 top-4">
        <span class="inline-flex items-center rounded-md border border-border/50 bg-card/80 px-2.5 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm">${escapeHTML(post.label || "")}</span>
      </div>
    </div>
    <div class="space-y-3 p-6">
      <h3 class="line-clamp-2 text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">${escapeHTML(post.title)}</h3>
      <div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">${initials}</div>
          <span class="font-medium">${escapeHTML(post.author)}</span>
        </div>
        <span>&bull;</span>
        <div class="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
          </svg>
          <time datetime="${escapeHTML(post.published)}">${formatDate(post.published)}</time>
        </div>
        ${readTime}
      </div>
      <div class="flex flex-wrap gap-1.5">${tags}</div>
    </div>
    <div class="flex-1 px-6 pb-2">
      <p class="line-clamp-3 text-muted-foreground">${escapeHTML(post.summary || "")}</p>
    </div>
    <div class="px-6 pb-6 pt-2">
      <span class="inline-flex items-center text-sm font-medium text-primary underline-offset-4 group-hover:underline">
        Read article
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-1 transition-transform group-hover:translate-x-1" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </div>
  </div>
</a>`;
}

function buildBlogIndex(posts) {
  const file = join(SRC, "pages/blog/index.html");
  const raw = read(file);
  const { data, content } = parsePageFrontmatter(raw);

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags || [])));
  const tagButtons = [
    `<button type="button" class="tag-button inline-flex items-center rounded-md bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground cursor-pointer" data-tag="">All Posts</button>`,
    ...allTags.map(
      (t) =>
        `<button type="button" class="tag-button inline-flex items-center rounded-md border border-input px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover:bg-accent" data-tag="${escapeHTML(t)}">${escapeHTML(t)}</button>`
    ),
  ].join("");

  const cards = posts.map(renderPostCard).join("\n");

  const body = applyTemplate(content, {
    tagFilter: tagButtons,
    postCards: cards || `<p class="col-span-full text-center py-12 text-muted-foreground text-lg">No posts yet.</p>`,
  });

  const html = renderPage({ frontmatter: data, body, slug: "/blog" });
  write(join(DIST, "blog/index.html"), html);
}

/* ---------------------------------------------------------------- *
 * Static assets + sitemap + robots                                  *
 * ---------------------------------------------------------------- */

function copyAssets() {
  const publicDir = join(ROOT, "public");
  if (existsSync(publicDir)) cpSync(publicDir, DIST, { recursive: true });
  const scriptsDir = join(SRC, "scripts");
  if (existsSync(scriptsDir)) cpSync(scriptsDir, join(DIST, "scripts"), { recursive: true });
}

function writeSitemap(posts) {
  const urls = ["/", "/blog", ...posts.map((p) => `/blog/posts/${p.id}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join("\n")}
</urlset>
`;
  write(join(DIST, "sitemap.xml"), xml);
}

function writeRobots() {
  write(
    join(DIST, "robots.txt"),
    `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
  );
}

/* ---------------------------------------------------------------- *
 * Run                                                               *
 * ---------------------------------------------------------------- */

async function main() {
  if (existsSync(DIST)) rmSync(DIST, { recursive: true });
  mkdirSync(DIST, { recursive: true });

  const highlighter = await createHighlighter({
    themes: ["github-light-default", "github-dark-default"],
    langs: SHIKI_LANGS,
  });
  configureMarked(highlighter);

  buildPages();
  const posts = buildPosts();
  buildBlogIndex(posts);
  copyAssets();
  writeSitemap(posts);
  writeRobots();

  // Crude size summary so the dev sees how cheap this is at a glance.
  let total = 0;
  for (const f of walk(DIST)) total += statSync(f).size;
  console.log(`build: dist/ ready (${posts.length} posts, ${Math.round(total / 1024)}KB on disk)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
