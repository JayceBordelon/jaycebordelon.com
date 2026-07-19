#!/usr/bin/env node
/*
 * Fetch time-synced lyrics (LRC) from LRCLIB for the /music catalog.
 *
 * Usage:
 *   node scripts/fetch-lyrics.mjs             # fetch tracks missing src/lyrics/<slug>.lrc
 *   node scripts/fetch-lyrics.mjs <slug> ...  # (re)fetch specific slugs
 *   node scripts/fetch-lyrics.mjs --refresh   # refetch everything
 *   node scripts/fetch-lyrics.mjs --force ... # take the best candidate even
 *                                             # past the duration cap; only
 *                                             # keep it if validation passes
 *
 * Matching: LRCLIB /api/get with the real file duration (probed via
 * ffprobe), falling back to /api/get without duration, then /api/search
 * scored by duration distance. A match more than 8s off is rejected:
 * that is almost always a different edit of the song, and its
 * timestamps would drift badly.
 *
 * Instrumentals are listed in INSTRUMENTAL below and never fetched.
 * Titles/artists that differ from tracks.json display copy live in
 * OVERRIDES. After fetching, validate timing with
 * scripts/validate-lyrics.sh before trusting the sync.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TRACKS = JSON.parse(readFileSync(join(ROOT, "src/tracks.json"), "utf8"));
const LYRICS_DIR = join(ROOT, "src/lyrics");
const UA = "jaycebordelon.com build tooling (https://jaycebordelon.com)";

// Tracks with no sung words: solo piano, classical, film scores, organ.
const INSTRUMENTAL = new Set([
  "first-dance",
  "je-te-laisserai-des-mots",
  "let-down", // the Gabriel Piano cover; the Radiohead original is let-down-radiohead
  "can-you-hear-the-music",
  "comptine",
  "clair-de-lune",
  "experience",
  "swan-lake",
  "passacaglia",
  "fantaisie-impromptu",
  "moonlight-sonata",
  "nocturne-op9-no2",
  "four-seasons",
  "canon-in-d",
  "toccata-and-fugue",
]);

// Vocal tracks LRCLIB has no usable synced lyrics for: every candidate
// is a differently-edited version whose timestamps drift against our
// audio, and STT validation (scripts/validate-lyrics.py) could not
// verify any of them. Do not refetch without checking a new candidate
// actually validates.
const NO_USABLE_MATCH = new Set(["my-old-ways", "end-of-summer", "you-were-right"]);

// tracks.json display copy vs the metadata LRCLIB indexes by.
const OVERRIDES = {
  "street-spirit": { title: "Street Spirit (Fade Out)" },
  "weird-fishes": { title: "Weird Fishes/Arpeggi" },
  "let-down-radiohead": { title: "Let Down" },
  "chicago-freestyle": { artist: "Drake", title: "Chicago Freestyle" },
  wgft: { artist: "Gunna" },
  "northern-attitude": { artist: "Noah Kahan", title: "Northern Attitude (with Hozier)" },
  "electric-love": { artist: "BØRNS" },
  "american-money": { artist: "BØRNS" },
  "ten-thousand-emerald-pools": { artist: "BØRNS", title: "10,000 Emerald Pools" },
  innerbloom: { artist: "RÜFÜS DU SOL" },
  "you-were-right": { artist: "RÜFÜS DU SOL" },
  underwater: { artist: "RÜFÜS DU SOL" },
  "treat-you-better": { artist: "RÜFÜS DU SOL" },
  alive: { artist: "RÜFÜS DU SOL" },
  "on-my-knees": { artist: "RÜFÜS DU SOL" },
  "no-place": { artist: "RÜFÜS DU SOL" },
  "like-an-animal": { artist: "RÜFÜS DU SOL" },
  "say-a-prayer-for-me": { artist: "RÜFÜS DU SOL" },
  "until-the-sun-needs-to-rise": { artist: "RÜFÜS DU SOL" },
};

function fileDuration(track) {
  const path = join(ROOT, "public", track.src);
  const out = execSync(
    `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${path}"`,
    { encoding: "utf8" }
  );
  return parseFloat(out.trim());
}

async function api(path, params) {
  const url = new URL(`https://lrclib.net/api/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

async function findLyrics(artist, title, duration) {
  // Exact match with duration (LRCLIB tolerates ~2s).
  let hit = await api("get", {
    artist_name: artist,
    track_name: title,
    duration: Math.round(duration),
  });
  if (hit?.syncedLyrics) return { hit, via: "get+duration" };

  // The plain get can return a different edit of the song (radio cut,
  // extended mix). Keep it only if it is duration-plausible; otherwise
  // let search rank every synced result by duration distance.
  hit = await api("get", { artist_name: artist, track_name: title });
  if (hit?.syncedLyrics && Math.abs(hit.duration - duration) <= 8) return { hit, via: "get" };
  const fallback = hit?.syncedLyrics ? hit : null;

  const results = await api("search", { artist_name: artist, track_name: title });
  const synced = (results || []).filter((r) => r.syncedLyrics && !r.instrumental);
  if (synced.length) {
    synced.sort(
      (a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration)
    );
    return { hit: synced[0], via: "search" };
  }
  return { hit: fallback, via: "get" };
}

async function main() {
  const argv = process.argv.slice(2);
  const refresh = argv.includes("--refresh");
  const force = argv.includes("--force");
  const only = argv.filter((a) => !a.startsWith("--"));
  mkdirSync(LYRICS_DIR, { recursive: true });

  const report = [];
  for (const track of TRACKS) {
    if (INSTRUMENTAL.has(track.slug) || NO_USABLE_MATCH.has(track.slug)) continue;
    if (only.length && !only.includes(track.slug)) continue;
    const lrcPath = join(LYRICS_DIR, `${track.slug}.lrc`);
    if (!refresh && !only.length && existsSync(lrcPath)) continue;

    const ov = OVERRIDES[track.slug] || {};
    const artist = ov.artist || track.sub;
    const title = ov.title || track.name;
    const duration = fileDuration(track);

    const { hit, via } = await findLyrics(artist, title, duration);
    if (!hit) {
      report.push({ slug: track.slug, status: "MISS" });
      continue;
    }
    const delta = +(hit.duration - duration).toFixed(1);
    if (Math.abs(delta) > 8 && !force) {
      report.push({ slug: track.slug, status: "REJECT", via, delta });
      continue;
    }
    const header = [
      `[ti:${hit.trackName}]`,
      `[ar:${hit.artistName}]`,
      `[source:lrclib:${hit.id}]`,
    ].join("\n");
    writeFileSync(lrcPath, `${header}\n${hit.syncedLyrics.trim()}\n`);
    report.push({ slug: track.slug, status: "OK", via, delta });
  }

  for (const r of report) {
    const extra = r.status === "MISS" ? "" : `  via=${r.via}  duration-delta=${r.delta}s`;
    console.log(`${r.status.padEnd(6)} ${r.slug}${extra}`);
  }
  const misses = report.filter((r) => r.status !== "OK").length;
  console.log(`\n${report.length - misses}/${report.length} fetched`);
}

main();
