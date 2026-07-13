// The /music page's player. Only /music carries the audio element, so
// music exists nowhere else and leaving the page silences it by
// construction. Two responsibilities: drive the audio (five local
// piano tracks with a picker, scrubber, and rotation when a track
// ends, playing the moment the browser permits with a
// first-gesture fallback and focus retries, track and playhead
// persisted across visits) and publish 16 pitch cells plus a loudness
// signal on window.soundField for the neural machine. Leaving via
// BACK TO HOME or Escape collapses the net first, then navigates.
(function () {
  var audio = document.getElementById("ambience-track");
  if (!audio) return;
  audio.volume = 0.35;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Track metadata is baked into the page at build time from
  // src/tracks.json, one source of truth for the player, the per-song
  // pages at /music/<slug>, and their SEO.
  var TRACKS = window.SITE_TRACKS || [];
  if (!TRACKS.length) return;
  // The song in the url wins and always starts from the top, so a
  // shared /music/let-down link renders with that song cued.
  var trackIdx = 0;
  try { trackIdx = (+localStorage.getItem("ambience-i") || 0) % TRACKS.length; } catch (e) {}
  try {
    var pathMatch = location.pathname.match(/^\/music\/([a-z0-9-]+)/);
    var wanted = window.INITIAL_SONG || (pathMatch && pathMatch[1]) || new URLSearchParams(location.search).get("song");
    for (var wi = 0; wi < TRACKS.length; wi++) {
      if (TRACKS[wi].slug === wanted) {
        trackIdx = wi;
        localStorage.setItem("ambience-t", "0");
        localStorage.setItem("ambience-i", String(wi));
        break;
      }
    }
  } catch (e) {}
  if (trackIdx !== 0) audio.src = TRACKS[trackIdx].src;
  try { history.replaceState(null, "", "/music/" + TRACKS[trackIdx].slug); } catch (e) {}

  var off = false;
  try { off = localStorage.getItem("ambience") === "off"; } catch (e) {}

  var bar = document.getElementById("listen-bar");
  var playBtn = document.getElementById("listen-play");
  var seek = document.getElementById("listen-seek");
  var timeEl = document.getElementById("listen-time");
  var durEl = document.getElementById("listen-dur");
  var pickBtn = document.getElementById("listen-track-btn");
  var pickList = document.getElementById("listen-track-list");
  var exitLink = document.getElementById("listen-exit");
  var seeking = false;

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    var m = (sec / 60) | 0, r = (sec % 60) | 0;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }
  function paintBar() {
    if (!bar) return;
    if (playBtn) {
      playBtn.classList.toggle("playing", !audio.paused);
      playBtn.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
    }
    if (timeEl) timeEl.textContent = fmt(audio.currentTime);
    if (durEl) durEl.textContent = fmt(audio.duration);
    if (seek && !seeking && audio.duration) {
      seek.value = String(((audio.currentTime / audio.duration) * 1000) | 0);
    }
  }
  var pickName = document.getElementById("listen-track-name");
  var optionEls = [];
  function paintPicker() {
    if (pickName) pickName.textContent = TRACKS[trackIdx].name;
    else if (pickBtn) pickBtn.textContent = TRACKS[trackIdx].name;
    for (var li = 0; li < optionEls.length; li++) {
      if (optionEls[li]) optionEls[li].setAttribute("aria-selected", li === trackIdx ? "true" : "false");
    }
  }
  function setTrack(i, playNow) {
    trackIdx = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
    audio.src = TRACKS[trackIdx].src;
    paintPicker();
    try {
      localStorage.setItem("ambience-i", String(trackIdx));
      localStorage.setItem("ambience-t", "0");
      history.replaceState(null, "", "/music/" + TRACKS[trackIdx].slug);
    } catch (e) {}
    if (playNow && !off) start();
    paintBar();
  }

  // The analyser: pitch mapped to 16 cells, consistently. A 4096-point
  // FFT gives ~11Hz bins. Four piano registers (bass, tenor, alto,
  // treble) each subdivide into four sub-bands, lowest first, and every
  // cell normalizes against its own rolling peak (slow decay plus a
  // gamma curve, so mid energy reads mid) with fast attack and quick
  // release. cells are pitch-normalized (which note), loud is the
  // absolute level against its own rolling peak (how hard it is being
  // played), both published on window.soundField. The element runs at
  // full volume into the graph and a gain node does the quieting after
  // the tap, so the analyser sees full-scale signal.
  var SUBS = [
    [4, 6, 8, 10, 12],
    [12, 15, 18, 21, 24],
    [24, 30, 36, 42, 48],
    [48, 64, 84, 104, 130],
  ];
  var subMax = [];
  var amps = [];
  for (var k = 0; k < 16; k++) { subMax.push(30); amps.push(0); }
  var loudMax = 30;
  window.soundField = { cells: amps, overall: 0, loud: 0 };
  var loud = 0;
  var ctx, analyser, data, looping = false;
  function analyse() {
    if (still) return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var srcNode = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.5;
        var gain = ctx.createGain();
        gain.gain.value = 0.35;
        srcNode.connect(analyser);
        analyser.connect(gain);
        gain.connect(ctx.destination);
        audio.volume = 1;
        data = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) { return; }
    }
    if (ctx.state === "suspended") ctx.resume();
    if (looping) return;
    looping = true;
    (function frame() {
      var playing = !audio.paused && analyser;
      if (playing) analyser.getByteFrequencyData(data);
      var overall = 0;
      var rawSum = 0, rawBins = 0;
      for (var z = 0; z < 4; z++) {
        for (var s = 0; s < 4; s++) {
          var idx = z * 4 + s;
          var target = 0;
          if (playing) {
            var sum = 0;
            for (var i = SUBS[z][s]; i < SUBS[z][s + 1]; i++) sum += data[i];
            var width = SUBS[z][s + 1] - SUBS[z][s];
            var avg = sum / width;
            rawSum += sum;
            rawBins += width;
            subMax[idx] = Math.max(subMax[idx] * 0.9992, avg, 25);
            var ratio = Math.min(1, Math.max(0, avg - 6) / (subMax[idx] - 6));
            target = Math.pow(ratio, 1.7);
          }
          amps[idx] += (target - amps[idx]) * (target > amps[idx] ? 0.35 : 0.12);
          overall = Math.max(overall, amps[idx]);
        }
      }
      var rawLoud = rawBins ? rawSum / rawBins : 0;
      loudMax = Math.max(loudMax * 0.9992, rawLoud, 30);
      var loudTarget = Math.pow(Math.min(1, rawLoud / loudMax), 1.6);
      loud += (loudTarget - loud) * (loudTarget > loud ? 0.3 : 0.08);
      window.soundField.overall = overall;
      window.soundField.loud = loud;
      if (audio.paused && overall < 0.005) {
        looping = false;
        for (var r2 = 0; r2 < 16; r2++) amps[r2] = 0;
        loud = 0;
        window.soundField.overall = 0;
        window.soundField.loud = 0;
        return;
      }
      requestAnimationFrame(frame);
    })();
  }

  function start() {
    audio.play().then(function () {
      try {
        var t = +localStorage.getItem("ambience-t") || 0;
        if (t > 0 && t < audio.duration && Math.abs(audio.currentTime - t) > 2) audio.currentTime = t;
      } catch (e) {}
      analyse();
      paintBar();
      removeEventListener("pointerdown", gesture);
      removeEventListener("keydown", gesture);
    }).catch(function () {});
  }
  function gesture(e) {
    if (off) return;
    if (e.target && e.target.closest && e.target.closest(".listen-play, .listen-picker, .listen-exit")) return;
    start();
  }

  if (playBtn) {
    playBtn.addEventListener("click", function () {
      off = !audio.paused;
      try { localStorage.setItem("ambience", off ? "off" : "on"); } catch (e) {}
      if (off) audio.pause();
      else start();
      paintBar();
    });
  }
  if (seek) {
    seek.addEventListener("input", function () { seeking = true; });
    seek.addEventListener("change", function () {
      if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
      seeking = false;
    });
  }
  // The song picker: a themed dropdown that opens upward over the bar.
  function togglePick(open) {
    if (!pickList || !pickBtn) return;
    pickList.hidden = !open;
    pickBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (pickBtn && pickList) {
    // Grouped by category, each entry verbose: the song on one line,
    // its credit on the next.
    // Categories come from the manifest in first-appearance order, so
    // a new category can never silently vanish from the picker.
    var CATS = [];
    TRACKS.forEach(function (tr) {
      if (CATS.indexOf(tr.cat) < 0) CATS.push(tr.cat);
    });
    CATS.forEach(function (cat) {
      var members = [];
      TRACKS.forEach(function (tr, ti) {
        if (tr.cat === cat) members.push(ti);
      });
      if (!members.length) return;
      var head = document.createElement("li");
      head.className = "listen-cat";
      head.setAttribute("role", "presentation");
      head.textContent = cat.toUpperCase();
      pickList.appendChild(head);
      members.forEach(function (ti) {
        var tr = TRACKS[ti];
        var li = document.createElement("li");
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.title = tr.title;
        var nm = document.createElement("span");
        nm.className = "lt-name";
        nm.textContent = tr.name;
        var sb = document.createElement("span");
        sb.className = "lt-sub";
        sb.textContent = tr.sub;
        li.appendChild(nm);
        li.appendChild(sb);
        li.addEventListener("click", function () {
          off = false;
          try { localStorage.setItem("ambience", "on"); } catch (e) {}
          setTrack(ti, true);
          togglePick(false);
        });
        pickList.appendChild(li);
        optionEls[ti] = li;
      });
    });
    pickBtn.addEventListener("click", function () {
      togglePick(pickList.hidden);
    });
    document.addEventListener("pointerdown", function (e) {
      if (!pickList.hidden && e.target && e.target.closest && !e.target.closest(".listen-picker")) togglePick(false);
    });
    paintPicker();
  }

  // Leaving: collapse the machine, fade the bar, then go home.
  var leaving = false;
  function leave(e) {
    if (e) e.preventDefault();
    if (leaving) return;
    leaving = true;
    if (window.neuralField) window.neuralField.stop();
    document.body.classList.add("net-leaving");
    setTimeout(function () { location.href = "/"; }, 650);
  }
  if (exitLink) exitLink.addEventListener("click", leave);
  addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (pickList && !pickList.hidden) {
        togglePick(false);
        return;
      }
      leave();
    }
  });

  // When a track finishes, rotate to the next and keep playing.
  audio.addEventListener("ended", function () {
    setTrack(trackIdx + 1, true);
  });
  audio.addEventListener("timeupdate", paintBar);
  audio.addEventListener("play", paintBar);
  audio.addEventListener("pause", paintBar);
  audio.addEventListener("durationchange", paintBar);

  addEventListener("pagehide", function () {
    try {
      localStorage.setItem("ambience-i", String(trackIdx));
      localStorage.setItem("ambience-t", String(audio.currentTime || 0));
    } catch (e) {}
  });

  function retry() {
    if (!off && audio.paused && !leaving) start();
  }
  addEventListener("focus", retry);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) retry();
  });

  paintBar();
  if (off) {
    audio.pause();
  } else {
    addEventListener("pointerdown", gesture);
    addEventListener("keydown", gesture);
    start();
  }
})();
