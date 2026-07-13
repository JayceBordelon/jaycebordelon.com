// Ambient piano for the site: "the feeling of a first dance" by
// Gabriel Piano (youtube.com/@GabrielPiano1), served locally as a
// looping track at low volume. Playback is on by default and starts
// the moment the browser permits: immediately where autoplay is
// allowed, otherwise on the visitor's first gesture, with retries on
// tab focus. The SND control toggles it, the choice persists across
// pages, and the playhead carries between page loads so navigation
// never restarts the song. While audio plays, an analyser feeds one
// smoothed energy value into the --amp CSS variable and the reward
// surface breathes with the music.
(function () {
  var audio = document.getElementById("ambience-track");
  var chip = document.getElementById("ambience");
  if (!audio) return;
  audio.volume = 0.35;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var off = false;
  try { off = localStorage.getItem("ambience") === "off"; } catch (e) {}

  function paint(playing) {
    if (!chip) return;
    chip.classList.toggle("amb-on", playing);
    chip.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  // The analyser: pitch mapped to individual rings, consistently. A
  // 4096-point FFT gives ~11Hz bins. Four registers own the four
  // summits (bass the convergence summit, then tenor, alto, treble),
  // and each register subdivides into four sub-bands, one per ring
  // depth, lowest at the outer rings and rising toward the core, so
  // ascending pitch climbs the summit. The 16 cells are written as
  // --ampZS (register Z, sub-band S), each normalized against its own
  // rolling peak with fast attack and slow ring-out. --ampZ carries
  // each register's aggregate for the summit halos and the pi ring,
  // --amp the overall energy for the comet bloom. The element runs at
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
  var ctx, analyser, data, looping = false;
  function analyse() {
    if (still) return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var srcNode = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        analyser.smoothingTimeConstant = 0.65;
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
      var style = document.documentElement.style;
      var playing = !audio.paused && analyser;
      if (playing) analyser.getByteFrequencyData(data);
      var overall = 0;
      for (var z = 0; z < 4; z++) {
        var agg = 0;
        for (var s = 0; s < 4; s++) {
          var idx = z * 4 + s;
          var target = 0;
          if (playing) {
            var sum = 0;
            for (var i = SUBS[z][s]; i < SUBS[z][s + 1]; i++) sum += data[i];
            var avg = sum / (SUBS[z][s + 1] - SUBS[z][s]);
            subMax[idx] = Math.max(subMax[idx] * 0.9985, avg, 25);
            target = Math.min(1, Math.max(0, avg - 6) / (subMax[idx] - 6));
          }
          amps[idx] += (target - amps[idx]) * (target > amps[idx] ? 0.35 : 0.07);
          style.setProperty("--amp" + z + s, amps[idx].toFixed(3));
          agg = Math.max(agg, amps[idx]);
        }
        style.setProperty("--amp" + z, agg.toFixed(3));
        overall = Math.max(overall, agg);
      }
      style.setProperty("--amp", overall.toFixed(3));
      if (audio.paused && overall < 0.005) {
        looping = false;
        for (var z2 = 0; z2 < 4; z2++) {
          style.setProperty("--amp" + z2, "0");
          for (var s2 = 0; s2 < 4; s2++) style.setProperty("--amp" + z2 + s2, "0");
        }
        style.setProperty("--amp", "0");
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
      paint(true);
      analyse();
      removeEventListener("pointerdown", gesture);
      removeEventListener("keydown", gesture);
    }).catch(function () {});
  }
  function gesture(e) {
    if (off) return;
    if (e.target && e.target.closest && e.target.closest(".amb")) return;
    start();
  }

  if (chip) {
    chip.addEventListener("click", function () {
      off = !audio.paused;
      try { localStorage.setItem("ambience", off ? "off" : "on"); } catch (e) {}
      if (off) {
        audio.pause();
        paint(false);
      } else {
        start();
      }
    });
  }

  // The loop attribute already restarts the track seamlessly. This is
  // the belt and braces for any browser that drops the loop.
  audio.addEventListener("ended", function () {
    if (!off) {
      audio.currentTime = 0;
      start();
    }
  });

  addEventListener("pagehide", function () {
    try { localStorage.setItem("ambience-t", String(audio.currentTime || 0)); } catch (e) {}
  });

  function retry() {
    if (!off && audio.paused) start();
  }
  addEventListener("focus", retry);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) retry();
  });

  if (off) {
    audio.pause();
  } else {
    addEventListener("pointerdown", gesture);
    addEventListener("keydown", gesture);
    start();
  }
})();
