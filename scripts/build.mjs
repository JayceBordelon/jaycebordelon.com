#!/usr/bin/env node
// Generate static pages, posts, and shared assets.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, basename, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { createHighlighter } from "shiki";
import { renderGitHub } from './github.mjs'

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
        const highlighted = highlighter.codeToHtml(text, {
          lang: language,
          themes: { light: "github-light-default", dark: "nord" },
          defaultColor: false,
        });
        // Build-time wrapper: carries the small language label (CSS
        // ::before reads data-lang) and anchors the copy button that
        // copy-code.js appends at runtime.
        const langAttr = language === "text" ? "" : ` data-lang="${language}"`;
        return `<div class="code-block"${langAttr}>${highlighted}</div>\n`;
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
 * Build defaults                                                    *
 * ---------------------------------------------------------------- */

const layoutTemplate = read(join(SRC, "partials/layout.html"));
const postTemplate = read(join(SRC, "partials/post.html"))

function renderPage({ frontmatter, body, slug }) {
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
    content: body,
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
    const body = rel === 'index.html'
      ? applyTemplate(content, { githubContent: renderGitHub(JSON.parse(read(join(SRC, 'data/github.json')))) })
      : content
    const html = renderPage({ frontmatter: data, body, slug });
    write(join(DIST, rel), html);
  }
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

    const readTimeBlock = data.readTime ? `<span>${escapeHTML(data.readTime)}</span>` : ""

    const body = applyTemplate(postTemplate, {
      label: escapeHTML(data.label || ""),
      title: escapeHTML(data.title || ""),
      summary: escapeHTML(data.summary || ""),
      author: escapeHTML(data.author || ""),
      authorDesc: escapeHTML(data.authorDesc || ""),
      published: data.published || "",
      publishedFormatted: formatDate(data.published),
      readTimeBlock,
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

function renderPostEntry(post) {
  return `<article class="post-entry">
    <h2><a class="link link-hover" href="/blog/posts/${post.id}">${escapeHTML(post.title)}</a></h2>
    <p class="muted">${escapeHTML(post.summary || "")}</p>
  </article>`
}

function buildBlogIndex(posts) {
  const { data, content } = parsePageFrontmatter(read(join(SRC, "pages/blog/index.html")))
  const body = applyTemplate(content, {
    postCards: posts.map(renderPostEntry).join("\n") || '<p class="muted">No posts yet.</p>',
  })
  const html = renderPage({ frontmatter: data, body, slug: "/blog" })
  write(join(DIST, "blog/index.html"), html)
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
    themes: ["github-light-default", "nord"],
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
