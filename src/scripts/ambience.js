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

  // The analyser: pitch registers mapped to summits, consistently. A
  // 4096-point FFT gives ~11Hz bins, fine enough to separate piano
  // registers: bass under ~130Hz is slot 0 (the convergence summit),
  // tenor 130-260Hz slot 1, alto 260-520Hz slot 2, treble above slot 3.
  // The same note always lands on the same summit, chords light their
  // component summits together. Each register normalizes against its
  // own rolling peak so soft treble lights as fully as heavy bass, with
  // a fast attack and slow decay so notes strike and ring out. --amp
  // carries the overall energy for the comet bloom. The element runs at
  // full volume into the graph and a gain node does the quieting after
  // the tap, so the analyser sees full-scale signal.
  var REG = [[4, 12], [12, 24], [24, 48], [48, 130]];
  var regMax = [40, 40, 40, 40];
  var ctx, analyser, data, looping = false;
  var amps = [0, 0, 0, 0];
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
        var target = 0;
        if (playing) {
          var sum = 0;
          for (var i = REG[z][0]; i < REG[z][1]; i++) sum += data[i];
          var avg = sum / (REG[z][1] - REG[z][0]);
          regMax[z] = Math.max(regMax[z] * 0.9985, avg, 30);
          target = Math.min(1, Math.max(0, avg - 6) / (regMax[z] - 6));
        }
        amps[z] += (target - amps[z]) * (target > amps[z] ? 0.35 : 0.07);
        style.setProperty("--amp" + z, amps[z].toFixed(3));
        overall = Math.max(overall, amps[z]);
      }
      style.setProperty("--amp", overall.toFixed(3));
      if (audio.paused && overall < 0.005) {
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
