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

  // The analyser: four log-spaced spectral zones (bass, low-mid, mid,
  // high), each normalized and lerped on its own, written to --amp0
  // through --amp3 for styles.css to light the summit ring structures
  // zone by zone. --amp carries the overall energy for the comet bloom.
  // The element runs at full volume into the graph and a gain node does
  // the quieting after the tap, so the analyser sees full-scale signal.
  var ZONES = [[1, 4], [4, 9], [9, 19], [19, 41]];
  var NORM = [95, 85, 70, 45];
  var ctx, analyser, data, looping = false;
  var amps = [0, 0, 0, 0];
  function analyse() {
    if (still) return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var srcNode = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
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
      var overall = 0;
      for (var z = 0; z < 4; z++) {
        var target = 0;
        if (!audio.paused && analyser) {
          if (z === 0) analyser.getByteFrequencyData(data);
          var sum = 0;
          for (var i = ZONES[z][0]; i < ZONES[z][1]; i++) sum += data[i];
          target = Math.min(1, sum / (ZONES[z][1] - ZONES[z][0]) / NORM[z]);
        }
        amps[z] += (target - amps[z]) * 0.12;
        style.setProperty("--amp" + z, amps[z].toFixed(3));
        overall += amps[z];
      }
      style.setProperty("--amp", (overall / 4).toFixed(3));
      if (audio.paused && overall < 0.01) {
        looping = false;
        for (var r = 0; r < 4; r++) style.setProperty("--amp" + r, "0");
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
