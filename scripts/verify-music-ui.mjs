// Live checks for the /music transport UX: the share-a-moment button,
// the death of ambient ?ts= URL rewriting, deep-link seeking, the song
// popup owning its own scroll (not the net's zoom), and the lyrics
// layout on a phone viewport.
//
// Setup (once per checkout): npm i --no-save playwright-core
// Run against local:  npm run build && npm run serve, then
//   node scripts/verify-music-ui.mjs
// Run against prod:
//   BASE_URL=https://jaycebordelon.com node scripts/verify-music-ui.mjs
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
});
let pass = 0,
  fail = 0;
const check = (ok, name, detail) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " " + detail : ""}`);
};

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], {
  origin: BASE,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/music/creep`, { waitUntil: "load" });

// Six seconds of playback used to rewrite the URL with ?ts=. Not anymore.
const urlAfterPlay = await page.evaluate(async () => {
  const audio = document.getElementById("ambience-track");
  audio.muted = true;
  await audio.play().catch(() => {});
  await new Promise((r) => setTimeout(r, 6200));
  return { search: location.search, path: location.pathname };
});
check(urlAfterPlay.search === "", "URL stays clean while playing", JSON.stringify(urlAfterPlay));

// The share button stamps song + second onto the clipboard.
const share = await page.evaluate(async () => {
  const audio = document.getElementById("ambience-track");
  audio.currentTime = 83;
  document.getElementById("listen-share").click();
  await new Promise((r) => setTimeout(r, 400));
  return {
    copied: await navigator.clipboard.readText(),
    feedback: document.getElementById("listen-share").classList.contains("copied"),
  };
});
check(
  /\/music\/creep\?ts=8[23]$/.test(share.copied) && share.feedback,
  "share button copies moment link",
  JSON.stringify(share)
);

// A ?ts= deep link still seeks on load.
await page.goto(`${BASE}/music/creep?ts=97`, { waitUntil: "load" });
const deep = await page.evaluate(async () => {
  const audio = document.getElementById("ambience-track");
  audio.muted = true;
  await audio.play().catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  return audio.currentTime;
});
check(deep > 95 && deep < 103, "?ts= deep link seeks on load", `t=${deep.toFixed(1)}`);

// The song popup owns its scroll: a wheel over the open list scrolls
// the list instead of zooming the net (regression guard for the
// neural.js exclusion list).
await page.evaluate(() => document.getElementById("np-open").click());
await page.waitForTimeout(300);
const listBox = await page.locator("#song-list").boundingBox();
await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
const scrollBefore = await page.evaluate(() => document.getElementById("song-list").scrollTop);
await page.mouse.wheel(0, 600);
await page.waitForTimeout(250);
const scrollAfter = await page.evaluate(() => document.getElementById("song-list").scrollTop);
await page.keyboard.press("Escape");
check(scrollAfter > scrollBefore, "popup list owns the wheel", `scrolled ${scrollAfter - scrollBefore}px`);

// Phone viewport: the lyric line must be visible above the taller bar.
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 390, height: 844 });
await mob.goto(`${BASE}/music/stick-season`, { waitUntil: "load" });
const mobState = await mob.evaluate(async () => {
  const audio = document.getElementById("ambience-track");
  audio.muted = true;
  await audio.play().catch(() => {});
  audio.currentTime = 40;
  // Poll instead of a fixed sleep: after a cold seek the first line
  // can take a beat over a second to arrive.
  for (let w = 0; w < 30; w++) {
    await new Promise((r) => setTimeout(r, 100));
    const line = document.querySelector("#lyrics .lyrics-line.on");
    if (line && line.textContent.length > 0) break;
  }
  const box = document.getElementById("lyrics").getBoundingClientRect();
  const bar = document.getElementById("listen-bar").getBoundingClientRect();
  return {
    shown: (document.querySelector("#lyrics .lyrics-line.on") || { textContent: "" }).textContent,
    clear: box.bottom <= bar.top + 2,
    on: !!document.querySelector("#lyrics .lyrics-line.on"),
  };
});
check(mobState.on && mobState.shown.length > 0 && mobState.clear, "mobile layout", JSON.stringify(mobState));
await mob.screenshot({ path: "/tmp/lyrics-mobile.png" });

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
