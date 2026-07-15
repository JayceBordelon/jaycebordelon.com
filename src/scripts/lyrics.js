// Live lyrics for the listening machine. Each song page inlines its own
// synced lines (window.SITE_LYRICS, built from src/lyrics/<slug>.lrc);
// switching tracks without a page load fetches /lyrics/<slug>.json.
// The current line follows audio.currentTime on a rAF loop while
// playing, so seeks and scrubs land on the right words immediately.
// Every line change is a crossfade between two stacked spans: the
// leaving line drifts up and out while the arriving one rises in.
// Instrumentals have no lyric file and show nothing at all.
(function () {
  var audio = document.getElementById("ambience-track");
  var box = document.getElementById("lyrics");
  var spanA = document.getElementById("lyrics-a");
  var spanB = document.getElementById("lyrics-b");
  if (!audio || !box || !spanA || !spanB) return;

  var TRACKS = window.SITE_TRACKS || [];
  var cache = {}; // slug -> [[t, text], ...] | null (fetched, none)
  var lines = null;
  var slug = null;
  var lineIdx = -1;
  var cur = null; // the span currently holding the visible line
  var raf = 0;

  if (window.SITE_LYRICS && window.SITE_LYRICS.lines) {
    cache[window.SITE_LYRICS.slug] = window.SITE_LYRICS.lines;
  }

  // The audio element is no slug oracle: ambience.js hot-swaps it onto
  // a blob: URL once the full file is down. The URL path is the source
  // of truth (ambience.js rewrites it to /music/<slug> on init and on
  // every track change), with the baked INITIAL_SONG and the pre-blob
  // src path as fallbacks for the instant before that rewrite.
  function currentTrack() {
    var seg = location.pathname.split("/").pop();
    var srcPath = (audio.currentSrc || audio.src || "").replace(location.origin, "");
    var i;
    for (i = 0; i < TRACKS.length; i++) if (TRACKS[i].slug === seg) return TRACKS[i];
    for (i = 0; i < TRACKS.length; i++) if (TRACKS[i].slug === window.INITIAL_SONG) return TRACKS[i];
    for (i = 0; i < TRACKS.length; i++) if (TRACKS[i].src === srcPath) return TRACKS[i];
    return null;
  }

  // Last line whose timestamp has passed; -1 before the first line.
  function lineAt(t) {
    var lo = 0,
      hi = lines.length - 1,
      ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lines[mid][0] <= t) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  function clearLines() {
    spanA.className = spanB.className = "lyrics-line";
    spanA.textContent = spanB.textContent = "";
    cur = null;
  }

  function render(idx) {
    if (idx === lineIdx) return;
    lineIdx = idx;
    var text = idx >= 0 ? lines[idx][1] : "";
    if (cur) {
      cur.classList.remove("on");
      cur.classList.add("out");
    }
    if (!text) {
      // An instrumental gap: the old line fades out and nothing replaces
      // it until the next timestamped words arrive.
      cur = null;
      return;
    }
    var next = cur === spanA ? spanB : spanA;
    next.classList.remove("on");
    next.classList.remove("out");
    next.textContent = text;
    // Double rAF so the reset state paints before .on lands, otherwise
    // the browser coalesces both and the fade-in never runs. If an even
    // faster line change already marked this span as leaving again,
    // let it leave.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (!next.classList.contains("out")) next.classList.add("on");
      });
    });
    cur = next;
  }

  function tick() {
    raf = 0;
    if (!lines) return;
    render(lineAt(audio.currentTime));
    if (!audio.paused) raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function load() {
    var track = currentTrack();
    // The blob hot-swap refires loadstart mid-song for the same track;
    // reloading would blink the line for no reason.
    if (track && track.slug === slug && lines) return;
    lines = null;
    lineIdx = -1;
    clearLines();
    if (!track || !track.lyr) {
      slug = track ? track.slug : null;
      box.hidden = true;
      return;
    }
    slug = track.slug;
    box.hidden = false;
    if (slug in cache) {
      lines = cache[slug];
      if (!lines) box.hidden = true;
      kick();
      return;
    }
    var want = slug;
    fetch("/lyrics/" + want + ".json")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        cache[want] = data && data.lines ? data.lines : null;
        if (want !== slug) return; // the user has moved on
        lines = cache[want];
        if (!lines) box.hidden = true;
        else kick();
      })
      .catch(function () {
        cache[want] = null;
        if (want === slug) box.hidden = true;
      });
  }

  audio.addEventListener("loadstart", load); // fires on every src swap
  audio.addEventListener("play", kick);
  audio.addEventListener("seeked", kick);
  audio.addEventListener("timeupdate", kick); // paused scrubs still update
  load();
})();
