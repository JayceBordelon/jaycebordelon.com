// Ambient piano for the site, two Gabriel Piano tracks
// (youtube.com/@GabrielPiano1) served locally at low volume and
// rotated when one ends. Playback is on by default and starts the
// moment the browser permits: immediately where autoplay is allowed,
// otherwise on the visitor's first gesture, with retries on tab
// focus. The SND control toggles it, the choice persists across
// pages, and the current track and playhead carry between page loads
// so navigation never restarts the song. While audio plays, the
// analyser publishes 16 pitch cells on window.soundField for the
// neural background to listen to.
(function () {
  var audio = document.getElementById("ambience-track");
  var chip = document.getElementById("ambience");
  if (!audio) return;
  audio.volume = 0.35;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var TRACKS = [
    { src: "/audio/first-dance.m4a", title: "the feeling of a first dance by Gabriel Piano" },
    { src: "/audio/let-down.m4a", title: "Let down (Radiohead) by Gabriel Piano" },
  ];
  var trackIdx = 0;
  try { trackIdx = (+localStorage.getItem("ambience-i") || 0) % TRACKS.length; } catch (e) {}
  if (trackIdx !== 0) audio.src = TRACKS[trackIdx].src;
  if (chip) chip.title = TRACKS[trackIdx].title;

  var off = false;
  try { off = localStorage.getItem("ambience") === "off"; } catch (e) {}

  function paint(playing) {
    if (!chip) return;
    chip.classList.toggle("amb-on", playing);
    chip.setAttribute("aria-pressed", playing ? "true" : "false");
  }

  // The analyser: pitch mapped to 16 cells, consistently. A 4096-point
  // FFT gives ~11Hz bins. Four piano registers (bass, tenor, alto,
  // treble) each subdivide into four sub-bands, lowest first, and every
  // cell normalizes against its own rolling peak with fast attack and
  // slow ring-out, so soft treble reads as fully as heavy bass and the
  // same note always lands in the same cell. The cells are published
  // on window.soundField for the neural background renderer. The
  // element runs at full volume into the graph and a gain node does
  // the quieting after the tap, so the analyser sees full-scale signal.
  var SUBS = [
    [4, 6, 8, 10, 12],
    [12, 15, 18, 21, 24],
    [24, 30, 36, 42, 48],
    [48, 64, 84, 104, 130],
  ];
  var subMax = [];
  var amps = [];
  for (var k = 0; k < 16; k++) { subMax.push(30); amps.push(0); }
  // cells are pitch-normalized (which note), loud is the absolute level
  // (how hard it is being played), published separately so the neural
  // background can recruit more neurons for louder passages.
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
            subMax[idx] = Math.max(subMax[idx] * 0.9985, avg, 25);
            target = Math.min(1, Math.max(0, avg - 6) / (subMax[idx] - 6));
          }
          amps[idx] += (target - amps[idx]) * (target > amps[idx] ? 0.35 : 0.07);
          overall = Math.max(overall, amps[idx]);
        }
      }
      var loudTarget = rawBins ? Math.min(1, rawSum / rawBins / 55) : 0;
      loud += (loudTarget - loud) * (loudTarget > loud ? 0.25 : 0.06);
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

  // When a track finishes, rotate to the next and keep playing.
  audio.addEventListener("ended", function () {
    trackIdx = (trackIdx + 1) % TRACKS.length;
    audio.src = TRACKS[trackIdx].src;
    if (chip) chip.title = TRACKS[trackIdx].title;
    try {
      localStorage.setItem("ambience-i", String(trackIdx));
      localStorage.setItem("ambience-t", "0");
    } catch (e) {}
    if (!off) start();
  });

  addEventListener("pagehide", function () {
    try {
      localStorage.setItem("ambience-i", String(trackIdx));
      localStorage.setItem("ambience-t", String(audio.currentTime || 0));
    } catch (e) {}
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
