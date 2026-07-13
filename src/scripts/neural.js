// The background as a listening neural machine shaped as a tesseract.
// A hypercube has sixteen vertices and the analyser publishes sixteen
// pitch cells, so every 4d vertex IS a note cell, hosting a wheel of
// neurons around a hub. Registers pick the xy quadrant, sub-bands the
// zw pair, and hypercube edges join cells that differ by one bit, so
// the wiring is the geometry of the pitch space itself. The whole
// structure double-rotates through the fourth dimension while slowly
// yawing in 3d, cubes turning inside out through one another. Every
// neuron keeps its own sensitivity bias: quiet notes clear only the
// most sensitive, louder playing recruits deeper. Attacks fire signal
// pulses down the wiring, more and chattier when loud, and arrivals
// can chain-fire in climaxes. The machine only exists in listening
// mode: ambience.js calls window.neuralField.start/stop with the mode
// toggle, and nothing renders outside it. Canvas 2d and vanilla JS
// only. Reduced motion gets one static frame.
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

  // Geometry: 16 hypercube vertices at (±1, ±1, ±1, ±1) scaled, each
  // a neuron wheel: a hub at the vertex plus a ring of 13 around it,
  // the ring lying in a seeded 2-plane of 4d space so every wheel
  // deforms differently as the structure turns through w.
  var VS = 0.5, RN = 13, RR = 0.15, P4 = 3.2;
  var nodes = [], edges = [], centers = [];
  function rv() {
    var v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    var l = Math.hypot(v[0], v[1], v[2], v[3]);
    return [v[0] / l, v[1] / l, v[2] / l, v[3] / l];
  }
  for (var c = 0; c < 16; c++) {
    var r = c >> 2, s = c & 3;
    var vert = [
      (r & 1 ? 1 : -1) * VS,
      (r & 2 ? 1 : -1) * VS,
      (s & 1 ? 1 : -1) * VS,
      (s & 2 ? 1 : -1) * VS,
    ];
    var U = rv();
    var V0 = rv();
    var d0 = U[0] * V0[0] + U[1] * V0[1] + U[2] * V0[2] + U[3] * V0[3];
    var V = [V0[0] - d0 * U[0], V0[1] - d0 * U[1], V0[2] - d0 * U[2], V0[3] - d0 * U[3]];
    var vl = Math.hypot(V[0], V[1], V[2], V[3]);
    V = [V[0] / vl, V[1] / vl, V[2] / vl, V[3] / vl];

    var base = nodes.length;
    centers.push(base);
    nodes.push({ p: vert, cell: c, bias: 0.1 + rnd() * 0.35, act: 0 });
    for (var j = 0; j < RN; j++) {
      var th = (TAU * j) / RN;
      var cu = Math.cos(th) * RR, sv = Math.sin(th) * RR;
      nodes.push({
        p: [vert[0] + cu * U[0] + sv * V[0], vert[1] + cu * U[1] + sv * V[1], vert[2] + cu * U[2] + sv * V[2], vert[3] + cu * U[3] + sv * V[3]],
        cell: c,
        bias: 0.12 + rnd() * 0.5,
        act: 0,
      });
      edges.push([base + 1 + j, base + 1 + ((j + 1) % RN)]);
      if (j % 2 === 0) edges.push([base, base + 1 + j]);
    }
  }
  // Hypercube wiring: an edge wherever two cells differ by one bit.
  for (var a2 = 0; a2 < 16; a2++) {
    for (var b2 = a2 + 1; b2 < 16; b2++) {
      var x2 = a2 ^ b2;
      if (!(x2 & (x2 - 1))) edges.push([centers[a2], centers[b2]]);
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

    // Turn the tesseract: a double rotation through the xw and yz
    // planes (the genuinely 4d motion), then a slow 3d yaw under a
    // fixed tilt, then perspective. Depth cues blend both projections
    // so near-in-w wheels read larger and brighter.
    var a4 = still ? 0.5 : t * 0.00009;
    var b4 = still ? 0.3 : t * 0.000063;
    var ca4 = Math.cos(a4), sa4 = Math.sin(a4);
    var cb4 = Math.cos(b4), sb4 = Math.sin(b4);
    var yaw = still ? 0.6 : t * 0.00005;
    var cy1 = Math.cos(yaw), sy1 = Math.sin(yaw);
    var cx1 = Math.cos(0.3), sx1 = Math.sin(0.3);
    var S = Math.min(W, H) * 0.3;
    var CX = W * 0.5, CY = H * 0.47;
    for (var j = 0; j < nodes.length; j++) {
      var p = nodes[j].p;
      var X4 = p[0] * ca4 - p[3] * sa4;
      var W4 = p[0] * sa4 + p[3] * ca4;
      var Y4 = p[1] * cb4 - p[2] * sb4;
      var Z4 = p[1] * sb4 + p[2] * cb4;
      var s3 = P4 / (P4 - W4);
      var X = X4 * s3, Y = Y4 * s3, Z = Z4 * s3;
      var xr = X * cy1 + Z * sy1;
      var zr = -X * sy1 + Z * cy1;
      var yr = Y * cx1 - zr * sx1;
      var z2 = Y * sx1 + zr * cx1;
      var per = 3.4 / (3.4 + z2);
      px[j] = CX + xr * S * per;
      py[j] = CY + yr * S * per;
      pz[j] = per * (0.55 + 0.45 * Math.min(1, Math.max(0, (s3 - 0.82) / 0.47)));
    }

    // Edges: quiet wiring that brightens when both ends are lit, with
    // the whole loom lifting slightly in loud passages.
    g.strokeStyle = ink;
    g.lineCap = "round";
    for (var e2 = 0; e2 < edges.length; e2++) {
      var a = edges[e2][0], d2 = edges[e2][1];
      var act = Math.min(nodes[a].act, nodes[d2].act);
      var depth = (pz[a] + pz[d2]) * 0.5;
      g.globalAlpha = (0.11 + loud * 0.05 + act * 0.42) * depth;
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
      g.globalAlpha = (0.34 + nn.act * 0.6) * per2;
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
