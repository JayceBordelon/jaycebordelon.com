// Live-sync proof for the /music lyrics display. Drives real Chrome:
// plays each song muted, jumps to sampled timestamps, and asserts the
// DOM shows exactly the line the synced data says should be up at
// audio.currentTime. Also opens the song popup, searches, and switches
// tracks in place to exercise the fetch path.
//
// Setup (once per checkout): npm i --no-save playwright-core
// Run against local:  npm run build && npm run serve, then
//   node scripts/verify-lyrics-live.mjs [slug ...]
// Run against prod:
//   BASE_URL=https://jaycebordelon.com node scripts/verify-lyrics-live.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SLUGS = process.argv.slice(2);
if (!SLUGS.length) SLUGS.push("creep", "stick-season", "innerbloom", "exit-music");

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let pass = 0,
  fail = 0;

for (const slug of SLUGS) {
  await page.goto(`${BASE}/music/${slug}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.SITE_LYRICS && window.SITE_LYRICS.lines.length > 0);

  // Sample five sung lines spread through the song. Target the middle
  // of each line's window so a correct display is unambiguous.
  const samples = await page.evaluate(() => {
    const L = window.SITE_LYRICS.lines.filter((l) => l[1]);
    const picks = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.round(f * (L.length - 1)));
    return [...new Set(picks)].map((i) => {
      const all = window.SITE_LYRICS.lines;
      const k = all.findIndex((l) => l === L[i]);
      const next = k + 1 < all.length ? all[k + 1][0] : L[i][0] + 4;
      return { t: L[i][0] + Math.min(2, (next - L[i][0]) / 2), want: L[i][1] };
    });
  });

  for (const { t, want } of samples) {
    const got = await page.evaluate(async (time) => {
      const audio = document.getElementById("ambience-track");
      audio.muted = true;
      if (audio.paused) await audio.play().catch(() => {});
      audio.currentTime = time;
      await new Promise((r) => setTimeout(r, 700)); // fade + rAF settle
      // The engine's contract: at any instant, show the line whose
      // window contains currentTime. Densely stacked lines can turn
      // over during the settle wait, so compute the expectation at the
      // moment we read the DOM, not at the seek target.
      const now = audio.currentTime;
      const L = window.SITE_LYRICS.lines;
      let exp = "";
      for (const [lt, lx] of L) if (lt <= now) exp = lx;
      return {
        shown: (document.querySelector("#lyrics .lyrics-line.on") || { textContent: "" }).textContent,
        expectedAtNow: exp,
        visible: !document.getElementById("lyrics").hidden && !!document.querySelector("#lyrics .lyrics-line.on"),
        now,
      };
    }, t);
    const ok = got.visible && got.shown === got.expectedAtNow && Math.abs(got.now - t) < 1.5;
    ok ? pass++ : fail++;
    console.log(
      `${ok ? "PASS" : "FAIL"} ${slug} @${t.toFixed(1)}s now=${got.now.toFixed(1)}s\n` +
        `     want: "${want}"\n     shown: "${got.shown}" (visible=${got.visible})`
    );
  }
  await page.screenshot({ path: `/tmp/lyrics-${slug}.png` });
}

// In-place track switch through the song popup: open it from the
// now-playing title, search, pick the match. The new song's lines
// must arrive over fetch(/lyrics/<slug>.json) without a page load.
await page.goto(`${BASE}/music/creep`, { waitUntil: "load" });
const switched = await page.evaluate(async () => {
  const audio = document.getElementById("ambience-track");
  audio.muted = true;
  document.getElementById("np-open").click();
  const modalShown = !document.getElementById("song-modal").hidden;
  const search = document.getElementById("song-search");
  search.value = "stick seas";
  search.dispatchEvent(new Event("input"));
  const visibleOpts = [...document.querySelectorAll('#song-list li[role="option"]:not([hidden])')];
  const filteredToOne = visibleOpts.length === 1;
  search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const modalClosed = document.getElementById("song-modal").hidden;
  await new Promise((r) => setTimeout(r, 1500)); // fetch + first render
  if (audio.paused) await audio.play().catch(() => {});
  audio.currentTime = 40;
  await new Promise((r) => setTimeout(r, 700));
  return {
    modalShown,
    filteredToOne,
    modalClosed,
    pathOk: location.pathname.endsWith("stick-season"),
    shown: (document.querySelector("#lyrics .lyrics-line.on") || { textContent: "" }).textContent,
    visible: !document.getElementById("lyrics").hidden,
  };
});
const swOk =
  switched.modalShown && switched.filteredToOne && switched.modalClosed &&
  switched.pathOk && switched.visible && switched.shown.length > 0;
swOk ? pass++ : fail++;
console.log(`${swOk ? "PASS" : "FAIL"} popup search + track-switch fetch path:`, JSON.stringify(switched));
await page.screenshot({ path: "/tmp/lyrics-switch.png" });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
