// The background as a listening neural machine. Four flat layers turn
// slowly in 3d, one per piano register (bass on the west face, treble
// east), each layer four concentric rings of neurons, one ring per
// pitch sub-band with pitch rising toward the ring core. Rings close
// into circles, parallel struts link matching rings across layers,
// and radial spokes tie neighboring rings inside each layer, so the
// architecture reads deliberate and symmetric. Every neuron keeps its
// own sensitivity bias: quiet notes clear only the most sensitive,
// louder playing recruits deeper into the population. Attacks fire
// signal pulses down the wiring, more and chattier when loud, and
// arrivals can chain-fire in climaxes. The machine only exists in
// listening mode: ambience.js calls window.neuralField.start/stop
// with the mode toggle, and nothing renders outside it. Canvas 2d and
// vanilla JS only. Reduced motion gets one static frame.
(function () {
  var cv = document.getElementById("bg-net");
  if (!cv || !cv.getContext) return;
  var g = cv.getContext("2d");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;

  // Seeded biases: the same temperament on every page and every visit.
  var seed = 0x5eed;
  function rnd() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var LAYER_X = [-0.9, -0.3, 0.3, 0.9];
  var RINGS = [
    { n: 20, r: 0.68 },
    { n: 16, r: 0.5 },
    { n: 12, r: 0.32 },
    { n: 6, r: 0.14 },
  ];
  var nodes = [];
  var ringStart = [];
  for (var L = 0; L < 4; L++) {
    ringStart.push([]);
    for (var k = 0; k < 4; k++) {
      ringStart[L].push(nodes.length);
      for (var j = 0; j < RINGS[k].n; j++) {
        var th = (TAU * j) / RINGS[k].n + k * 0.13;
        nodes.push({
          x: LAYER_X[L],
          y: Math.cos(th) * RINGS[k].r * 0.95,
          z: Math.sin(th) * RINGS[k].r,
          cell: L * 4 + k,
          bias: 0.12 + rnd() * 0.5,
          act: 0,
        });
      }
    }
  }

  // Wiring: ring circles, inter-layer struts, intra-layer spokes.
  var edges = [];
  for (var L2 = 0; L2 < 4; L2++) {
    for (var k2 = 0; k2 < 4; k2++) {
      var n0 = RINGS[k2].n;
      var s0 = ringStart[L2][k2];
      for (var j2 = 0; j2 < n0; j2++) {
        edges.push([s0 + j2, s0 + ((j2 + 1) % n0)]);
        if (L2 < 3) edges.push([s0 + j2, ringStart[L2 + 1][k2] + j2]);
        if (k2 < 3) {
          var n1 = RINGS[k2 + 1].n;
          edges.push([s0 + j2, ringStart[L2][k2 + 1] + (Math.round((j2 * n1) / n0) % n1)]);
        }
      }
    }
  }
  var incident = nodes.map(function () { return []; });
  edges.forEach(function (e, ei) { incident[e[0]].push(ei); incident[e[1]].push(ei); });
  var cellNodes = [];
  for (var c = 0; c < 16; c++) cellNodes.push([]);
  nodes.forEach(function (n, ni) { cellNodes[n.cell].push(ni); });

  // Palette from the live theme tokens, re-read when the theme flips.
  var ink = "#808080";
  function palette() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
    if (v) ink = v;
  }
  palette();
  if (window.MutationObserver) {
    new MutationObserver(palette).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  var W = 0, H = 0;
  function size() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (still && active) draw(0);
  }
  addEventListener("resize", size);

  var pulses = [];
  var prevCells = [], cellBase = [];
  for (var p = 0; p < 16; p++) { prevCells.push(0); cellBase.push(0); }
  var px = [], py = [], pz = [];

  function firePulse(ni) {
    var inc = incident[ni];
    if (!inc.length || pulses.length >= 150) return;
    var ei = inc[(Math.random() * inc.length) | 0];
    pulses.push({ e: ei, t: 0, sp: 0.02 + Math.random() * 0.025, from: edges[ei][0] === ni ? 0 : 1 });
  }

  function draw(t) {
    g.clearRect(0, 0, W, H);
    var field = window.soundField;
    var cs = field && field.cells ? field.cells : null;
    var loud = field ? field.loud || 0 : 0;

    // Two separators keep loud polyphony granular. Lateral inhibition:
    // a neuron's drive is its cell's energy above the mean of all
    // cells, so a dense wash suppresses itself and struck notes stand
    // out of it. Transient weighting: each cell also tracks its own
    // slow baseline, and energy above it (a fresh strike) multiplies
    // the drive, so every note in a loud chord pops its own neurons at
    // its own strike and then settles. Loudness still scales
    // recruitment depth through each neuron's bias.
    var mean = 0;
    if (cs) {
      for (var mc = 0; mc < 16; mc++) {
        var cv2 = cs[mc] || 0;
        mean += cv2;
        cellBase[mc] += (cv2 - cellBase[mc]) * 0.06;
      }
      mean /= 16;
    }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var raw = cs ? cs[n.cell] || 0 : 0;
      var rel = Math.max(0, raw - mean * 0.45);
      var atk = Math.max(0, raw - cellBase[n.cell]);
      var drive = rel * (0.45 + 1.6 * atk) * (0.4 + 0.9 * loud) * 1.5;
      var target = drive > n.bias ? Math.min(1, ((drive - n.bias) / (1 - n.bias)) * 1.4) : 0;
      n.act += (target - n.act) * (target > n.act ? 0.3 : 0.09);
    }

    // A rising cell is a struck note: fire pulses from its neurons,
    // more of them the louder the passage.
    if (cs && !still) {
      var burst = 1 + Math.round(loud * 4);
      var thresh = Math.max(0.07, 0.16 - loud * 0.08);
      for (var c = 0; c < 16; c++) {
        var v = cs[c] || 0;
        if (v - prevCells[c] > thresh) {
          var members = cellNodes[c];
          for (var q = 0; q < burst && members.length; q++) {
            firePulse(members[(Math.random() * members.length) | 0]);
          }
        }
        prevCells[c] = v;
      }
    }

    // Project the cloud: slow yaw, a hint of tilt, gentle perspective.
    var yaw = still ? 0.6 : t * 0.00012;
    var tilt = 0.32 + (still ? 0 : Math.sin(t * 0.00005) * 0.1);
    var cy1 = Math.cos(yaw), sy1 = Math.sin(yaw);
    var cx1 = Math.cos(tilt), sx1 = Math.sin(tilt);
    var S = Math.min(W, H) * 0.42;
    var CX = W * 0.5, CY = H * 0.46;
    for (var j = 0; j < nodes.length; j++) {
      var m = nodes[j];
      var xr = m.x * cy1 + m.z * sy1;
      var zr = -m.x * sy1 + m.z * cy1;
      var yr = m.y * cx1 - zr * sx1;
      var z2 = m.y * sx1 + zr * cx1;
      var per = 2.6 / (2.6 + z2);
      px[j] = CX + xr * S * per;
      py[j] = CY + yr * S * per;
      pz[j] = per;
    }

    // Edges: quiet wiring that brightens when both ends are lit, with
    // the whole loom lifting slightly in loud passages.
    g.strokeStyle = ink;
    g.lineCap = "round";
    for (var e2 = 0; e2 < edges.length; e2++) {
      var a = edges[e2][0], d2 = edges[e2][1];
      var act = Math.min(nodes[a].act, nodes[d2].act);
      var depth = (pz[a] + pz[d2]) * 0.5;
      g.globalAlpha = (0.04 + loud * 0.04 + act * 0.42) * depth;
      g.lineWidth = (0.6 + act * 1.2) * depth;
      g.beginPath();
      g.moveTo(px[a], py[a]);
      g.lineTo(px[d2], py[d2]);
      g.stroke();
    }

    // Signal pulses race along the wiring and excite their targets.
    // In loud passages an arrival can chain-fire onward, so climaxes
    // cascade through the whole organ.
    g.fillStyle = ink;
    for (var u = pulses.length - 1; u >= 0; u--) {
      var pu = pulses[u];
      pu.t += pu.sp;
      var ea = edges[pu.e][pu.from], eb = edges[pu.e][1 - pu.from];
      if (pu.t >= 1) {
        nodes[eb].act = Math.min(1, nodes[eb].act + 0.15);
        if (Math.random() < loud * 0.25) firePulse(eb);
        pulses.splice(u, 1);
        continue;
      }
      var lx = px[ea] + (px[eb] - px[ea]) * pu.t;
      var ly = py[ea] + (py[eb] - py[ea]) * pu.t;
      var pd = pz[ea] + (pz[eb] - pz[ea]) * pu.t;
      g.globalAlpha = 0.22 * pd;
      g.beginPath();
      g.arc(lx, ly, 3.6 * pd, 0, 6.2832);
      g.fill();
      g.globalAlpha = 0.85 * pd;
      g.beginPath();
      g.arc(lx, ly, 1.4 * pd, 0, 6.2832);
      g.fill();
    }

    // Neurons: a soft halo when excited, a firm core always.
    for (var w2 = 0; w2 < nodes.length; w2++) {
      var nn = nodes[w2];
      var per2 = pz[w2];
      if (nn.act > 0.2) {
        g.globalAlpha = nn.act * 0.16 * per2;
        g.beginPath();
        g.arc(px[w2], py[w2], (5 + nn.act * 9) * per2, 0, 6.2832);
        g.fill();
      }
      g.globalAlpha = (0.2 + nn.act * 0.65) * per2;
      g.beginPath();
      g.arc(px[w2], py[w2], (1.15 + nn.act * 1.9) * per2, 0, 6.2832);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // The brain exists only in listening mode: ambience.js starts and
  // stops it with the mode toggle. No frame is ever drawn outside it.
  var active = false, rafId = 0;
  function loop(ts) {
    draw(ts || 0);
    if (active && !still) rafId = requestAnimationFrame(loop);
  }
  window.neuralField = {
    start: function () {
      if (active) return;
      active = true;
      size();
      if (still) draw(0);
      else rafId = requestAnimationFrame(loop);
    },
    stop: function () {
      active = false;
      cancelAnimationFrame(rafId);
    },
  };
})();
