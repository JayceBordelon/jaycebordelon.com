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

  // The analyser: low-band energy, lerped so piano swells read as slow
  // breaths, written to --amp on the root for styles.css to consume.
  // The element runs at full volume into the graph and a gain node does
  // the quieting after the tap, so the analyser sees full-scale signal.
  var ctx, analyser, data, amp = 0, looping = false;
  function analyse() {
    if (still) return;
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        var srcNode = ctx.createMediaElementSource(audio);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;
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
      var target = 0;
      if (!audio.paused && analyser) {
        analyser.getByteFrequencyData(data);
        var sum = 0;
        var n = data.length >> 2;
        for (var i = 0; i < n; i++) sum += data[i];
        target = Math.min(1, sum / n / 70);
      }
      amp += (target - amp) * 0.1;
      document.documentElement.style.setProperty("--amp", amp.toFixed(3));
      if (audio.paused && amp < 0.005) {
        looping = false;
        document.documentElement.style.setProperty("--amp", "0");
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
