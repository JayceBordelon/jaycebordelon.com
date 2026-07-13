// The background as a listening neural machine, symmetrically random.
// Every load seeds a fresh cloud of motif neurons and stamps each one
// eight times through the D4 symmetry group (four rotations about the
// vertical axis, then the mirror of each), so the machine is different
// on every visit yet always reads deliberate. Pitch maps onto the
// symmetric field itself: registers stack bottom (bass) to top
// (treble), sub-bands ring from the rim (low) to the core (high), and
// all eight copies of a motif share a pitch cell, so every note lights
// a symmetric constellation. Neurons keep sensitivity biases (quiet
// notes wake the sensitive few, loud playing recruits deeper), attacks
// fire pulses down the wiring, and arrivals chain-fire in climaxes.
// The machine exists only in listening mode: ambience.js calls
// window.neuralField.start/stop, spawn-in erupts from a singularity
// with a decelerating spin, stop collapses it back. Canvas 2d and
// vanilla JS only. Reduced motion gets one static frame.
(function () {
  var cv = document.getElementById("bg-net");
  if (!cv || !cv.getContext) return;
  var g = cv.getContext("2d");
  var labelEl = document.getElementById("net-label");
  var labelName = document.getElementById("net-label-name");
  var labelEqn = document.getElementById("net-label-eqn");
  var labelParams = document.getElementById("net-label-params");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;
  var pulses = [];

  // A fresh seed every visit: the brain is never the same twice.
  var seed = (Math.random() * 4294967296) | 0;
  function rnd() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Every generation traces beautiful randomness: strange attractors,
  // random Fourier knots, Chladni resonance clouds, Pickover dust, or
  // DLA coral. Cell comes from where a neuron lives: register by
  // height, sub-band by radius, so pitch geography survives every
  // roll.
  var nodes, edges, incident, cellNodes;
  function cellAt(rad2, my2, ys) {
    var t2 = my2 / (ys * 2);
    var reg = t2 > 0.25 ? 0 : t2 > 0 ? 1 : t2 > -0.25 ? 2 : 3;
    var sub = rad2 > 0.85 ? 0 : rad2 > 0.65 ? 1 : rad2 > 0.45 ? 2 : 3;
    return reg * 4 + sub;
  }
  function generate() {
    // The beautifully random gallery: every generation rolls one of
    // five structures the generative-art canon holds sacred. Strange
    // attractors (Lorenz, Halvorsen, Thomas, Aizawa) traced through
    // their chaos, random Fourier knots, Chladni resonance clouds
    // sampled on the nodal surfaces of random standing waves, Pickover
    // iterated-map dust, and diffusion-limited aggregation coral grown
    // particle by particle. All get centered, normalized to frame, and
    // wired, so pitch geography (register by height, sub-band by
    // radius) spans whatever grows.
    function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
    var YS = 0.5 + rnd() * 0.3;
    var N = 380 + ((rnd() * 90) | 0);
    var pts = [];
    var label = "";
    var eqn = "";
    var shape = (rnd() * 5) | 0;

    if (shape === 0) {
      // A strange attractor, integrated through its transient and
      // sampled along the orbit.
      var sys = (rnd() * 4) | 0;
      var x = 0.1, y = 0.12, z = 0.05, dt, every, dx, dy, dz;
      var p1 = 0, p2 = 0, p3 = 0;
      if (sys === 0) {
        p1 = 10; p2 = 24 + rnd() * 8; p3 = 8 / 3; dt = 0.006; every = 3;
        label = "LORENZ ATTRACTOR \u00b7 \u03c3=10 \u03c1=" + p2.toFixed(1) + " \u03b2=8/3";
        eqn = "dx/dt = \u03c3(y \u2212 x)\ndy/dt = x(\u03c1 \u2212 z) \u2212 y\ndz/dt = xy \u2212 \u03b2z";
      } else if (sys === 1) {
        p1 = 1.3 + rnd() * 0.4; dt = 0.006; every = 3;
        label = "HALVORSEN ATTRACTOR \u00b7 a=" + p1.toFixed(2);
        eqn = "dx/dt = \u2212ax \u2212 4y \u2212 4z \u2212 y\u00b2\ncyclic in x \u2192 y \u2192 z";
      } else if (sys === 2) {
        p1 = 0.17 + rnd() * 0.05; dt = 0.05; every = 4;
        label = "THOMAS ATTRACTOR \u00b7 b=" + p1.toFixed(3);
        eqn = "dx/dt = sin(y) \u2212 bx\ncyclic in x \u2192 y \u2192 z";
      } else {
        p1 = 0.95; p2 = 0.7; p3 = 3.5 + rnd() * 0.4; dt = 0.01; every = 3;
        label = "AIZAWA ATTRACTOR \u00b7 d=" + p3.toFixed(2);
        eqn = "dx/dt = (z \u2212 b)x \u2212 dy\ndy/dt = dx + (z \u2212 b)y\ndz/dt = c + az \u2212 z\u00b3/3 \u2212 (x\u00b2+y\u00b2)(1 + ez) + fzx\u00b3";
      }
      var steps = 400 + N * every;
      for (var s0 = 0; s0 < steps; s0++) {
        if (sys === 0) {
          dx = p1 * (y - x);
          dy = x * (p2 - z) - y;
          dz = x * y - p3 * z;
        } else if (sys === 1) {
          dx = -p1 * x - 4 * y - 4 * z - y * y;
          dy = -p1 * y - 4 * z - 4 * x - z * z;
          dz = -p1 * z - 4 * x - 4 * y - x * x;
        } else if (sys === 2) {
          dx = Math.sin(y) - p1 * x;
          dy = Math.sin(z) - p1 * y;
          dz = Math.sin(x) - p1 * z;
        } else {
          dx = (z - p2) * x - p3 * y;
          dy = p3 * x + (z - p2) * y;
          dz = 0.6 + 0.95 * z - (z * z * z) / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
        }
        x += dx * dt;
        y += dy * dt;
        z += dz * dt;
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { x = 0.1; y = 0.12; z = 0.05; }
        if (s0 > 400 && s0 % every === 0 && pts.length < N) pts.push([x, y, z]);
      }
      // Chaos has a preferred orientation: give it a random one.
      var ry = rnd() * TAU, rx = rnd() * Math.PI - Math.PI / 2;
      var cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      for (var r0 = 0; r0 < pts.length; r0++) {
        var ax = pts[r0][0] * cy + pts[r0][2] * sy;
        var az = -pts[r0][0] * sy + pts[r0][2] * cy;
        var ay = pts[r0][1] * cx - az * sx;
        pts[r0] = [ax, pts[r0][1] * sx + az * cx, ay];
      }
    } else if (shape === 1) {
      // A random Fourier knot: decaying random harmonics per axis
      // close into a smooth tangled loop, different every time.
      var K = 3 + ((rnd() * 4) | 0);
      label = "RANDOM FOURIER KNOT \u00b7 " + K + " HARMONICS PER AXIS";
      eqn = "x(t) = \u03a3 a_k cos(kt + \u03c6_k)\nindependent a_k, \u03c6_k per axis\na_k ~ random / k^1.1, k = 1.." + K;
      var coef = [];
      for (var a1 = 0; a1 < 3; a1++) {
        var row = [];
        for (var k1 = 1; k1 <= K; k1++) {
          row.push([(rnd() * 2 - 1) / Math.pow(k1, 1.1), rnd() * TAU]);
        }
        coef.push(row);
      }
      for (var i1 = 0; i1 < N; i1++) {
        var t1 = (i1 / N) * TAU;
        var v = [0, 0, 0];
        for (var a2 = 0; a2 < 3; a2++) {
          for (var k2 = 1; k2 <= K; k2++) {
            v[a2] += coef[a2][k2 - 1][0] * Math.cos(k2 * t1 + coef[a2][k2 - 1][1]);
          }
        }
        pts.push([v[0] + gauss() * 0.03, v[1] + gauss() * 0.03, v[2] + gauss() * 0.03]);
      }
    } else if (shape === 2) {
      // A Chladni cloud: points settle on the nodal surfaces of a
      // random superposition of standing waves, the shapes of
      // resonance itself.
      var M = 3 + ((rnd() * 3) | 0);
      label = "CHLADNI NODAL FIELD \u00b7 " + M + " STANDING WAVES";
      eqn = "\u03a3 sin(f_i \u03c0 (k_i \u00b7 p) + \u03c6_i) \u2248 0\npoints settle on the nodal set\nof " + M + " random standing waves";
      var waves = [];
      for (var w0 = 0; w0 < M; w0++) {
        var kx = gauss(), ky = gauss(), kz = gauss();
        var kl = Math.hypot(kx, ky, kz) || 1;
        waves.push([kx / kl, ky / kl, kz / kl, 1 + rnd() * 2.4, rnd() * TAU]);
      }
      var tries = 0;
      while (pts.length < N && tries < 60000) {
        tries++;
        var qx = rnd() * 2 - 1, qy = rnd() * 2 - 1, qz = rnd() * 2 - 1;
        var f = 0;
        for (var w1 = 0; w1 < M; w1++) {
          var wv = waves[w1];
          f += Math.sin(wv[3] * Math.PI * (wv[0] * qx + wv[1] * qy + wv[2] * qz) + wv[4]);
        }
        if (Math.abs(f) < 0.22) pts.push([qx, qy, qz]);
      }
      while (pts.length < N) pts.push([gauss() * 0.6, gauss() * 0.6, gauss() * 0.6]);
    } else if (shape === 3) {
      // Pickover dust: a chaotic iterated map settling into ghostly
      // filaments.
      var pa = (rnd() * 2 - 1) * 2.4, pb = (rnd() * 2 - 1) * 2.4;
      var pc = (rnd() * 2 - 1) * 2.4, pd = (rnd() * 2 - 1) * 2.4;
      label = "PICKOVER MAP \u00b7 a=" + pa.toFixed(2) + " b=" + pb.toFixed(2) + " c=" + pc.toFixed(2) + " d=" + pd.toFixed(2);
      eqn = "x' = sin(ay) \u2212 z cos(bx)\ny' = z sin(cx) \u2212 cos(dy)\nz' = sin(x)";
      var mx = 0.1, my = 0.1, mz = 0;
      for (var m0 = 0; m0 < N + 120; m0++) {
        var nx = Math.sin(pa * my) - mz * Math.cos(pb * mx);
        var ny = mz * Math.sin(pc * mx) - Math.cos(pd * my);
        var nz = Math.sin(mx);
        mx = nx; my = ny; mz = nz;
        if (m0 > 120) pts.push([mx, my, mz]);
      }
    } else {
      // Diffusion-limited aggregation: coral grown one wandering
      // particle at a time, sticking where it touches.
      var STICK = 0.085, STEP = 0.06;
      var cluster = [[0, 0, 0]];
      var gridmap = {};
      function keyOf(px2, py2, pz2) {
        return ((px2 / STICK) | 0) + ":" + ((py2 / STICK) | 0) + ":" + ((pz2 / STICK) | 0);
      }
      function addTo(px2, py2, pz2) {
        cluster.push([px2, py2, pz2]);
        var kk = keyOf(px2, py2, pz2);
        (gridmap[kk] = gridmap[kk] || []).push([px2, py2, pz2]);
      }
      function nearCluster(px2, py2, pz2) {
        var gx = (px2 / STICK) | 0, gy = (py2 / STICK) | 0, gz = (pz2 / STICK) | 0;
        for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) for (var oz = -1; oz <= 1; oz++) {
          var cell = gridmap[(gx + ox) + ":" + (gy + oy) + ":" + (gz + oz)];
          if (!cell) continue;
          for (var ci = 0; ci < cell.length; ci++) {
            var ddx = cell[ci][0] - px2, ddy = cell[ci][1] - py2, ddz = cell[ci][2] - pz2;
            if (ddx * ddx + ddy * ddy + ddz * ddz < STICK * STICK) return true;
          }
        }
        return false;
      }
      addTo(0, 0, 0);
      var radius = 0.15;
      while (cluster.length < N) {
        var th5 = rnd() * TAU, ph5 = Math.acos(rnd() * 2 - 1);
        var wx = Math.sin(ph5) * Math.cos(th5) * radius;
        var wy = Math.cos(ph5) * radius;
        var wz = Math.sin(ph5) * Math.sin(th5) * radius;
        var alive = 3000;
        while (alive-- > 0) {
          wx += gauss() * STEP; wy += gauss() * STEP; wz += gauss() * STEP;
          var rr5 = Math.hypot(wx, wy, wz);
          if (rr5 > radius + 0.5) { alive = 0; break; }
          if (nearCluster(wx, wy, wz)) {
            addTo(wx, wy, wz);
            if (rr5 > radius - 0.12) radius = rr5 + 0.12;
            break;
          }
        }
      }
      pts = cluster;
      label = "DIFFUSION LIMITED AGGREGATION \u00b7 " + cluster.length + " PARTICLES";
      eqn = "particles random-walk from a sphere\nand stick where they first touch\nthe growing cluster";
    }

    // A breath of scatter around the form.
    var FREE = 26 + ((rnd() * 26) | 0);
    for (var f1 = 0; f1 < FREE; f1++) {
      var fa = rnd() * TAU;
      var fr = 0.2 + Math.pow(rnd(), 0.55) * 0.9;
      pts.push([Math.cos(fa) * fr, gauss() * 0.8, Math.sin(fa) * fr]);
    }

    // Center on the centroid, then normalize radius and height so the
    // register bands always span the structure.
    var cx0 = 0, cy0 = 0, cz0 = 0;
    for (var n0 = 0; n0 < pts.length; n0++) { cx0 += pts[n0][0]; cy0 += pts[n0][1]; cz0 += pts[n0][2]; }
    cx0 /= pts.length; cy0 /= pts.length; cz0 /= pts.length;
    var maxR = 0.001, maxY = 0.001;
    for (var n1 = 0; n1 < pts.length; n1++) {
      pts[n1] = [pts[n1][0] - cx0, pts[n1][1] - cy0, pts[n1][2] - cz0];
      maxR = Math.max(maxR, Math.hypot(pts[n1][0], pts[n1][2]));
      maxY = Math.max(maxY, Math.abs(pts[n1][1]));
    }
    nodes = [];
    edges = [];
    for (var n2 = 0; n2 < pts.length; n2++) {
      var fx2 = (pts[n2][0] / maxR) * 0.95;
      var fy2 = (pts[n2][1] / maxY) * YS;
      var fz2 = (pts[n2][2] / maxR) * 0.95;
      nodes.push({ x: fx2, y: fy2, z: fz2, cell: cellAt(Math.hypot(fx2, fz2), fy2, YS), bias: 0.2 + rnd() * 0.5, act: 0 });
    }

    // Wiring: three nearest neighbors each, deduped, plus a few long
    // chords straight through the form.
    var seen = {};
    nodes.forEach(function (n, ai) {
      var ds = nodes.map(function (q, bi) {
        var dx2 = n.x - q.x, dy2 = n.y - q.y, dz2 = n.z - q.z;
        return { d: dx2 * dx2 + dy2 * dy2 + dz2 * dz2, i: bi };
      }).sort(function (u1, u2) { return u1.d - u2.d; });
      for (var k = 1; k <= 3; k++) {
        var key = Math.min(ai, ds[k].i) + ":" + Math.max(ai, ds[k].i);
        if (!seen[key]) { seen[key] = 1; edges.push([ai, ds[k].i]); }
      }
    });
    var CHORDS = 6 + ((rnd() * 8) | 0);
    for (var c0 = 0; c0 < CHORDS; c0++) {
      var a0 = (rnd() * nodes.length) | 0;
      var b2 = (rnd() * nodes.length) | 0;
      if (a0 !== b2) edges.push([Math.min(a0, b2), Math.max(a0, b2)]);
    }
    incident = nodes.map(function () { return []; });
    edges.forEach(function (e, ei) { incident[e[0]].push(ei); incident[e[1]].push(ei); });
    cellNodes = [];
    for (var c = 0; c < 16; c++) cellNodes.push([]);
    nodes.forEach(function (n, ni) { cellNodes[n.cell].push(ni); });
    pulses.length = 0;
    if (labelEl) {
      var sep = label.indexOf("\u00b7");
      var nm = sep > -1 ? label.slice(0, sep).trim() : label;
      var pr = sep > -1 ? label.slice(sep + 1).trim() : "";
      if (labelName) labelName.textContent = nm;
      if (labelEqn) labelEqn.textContent = eqn;
      if (labelParams) {
        labelParams.textContent = pr;
        labelParams.style.display = pr ? "" : "none";
      }
    }
  }

  // Palette from the live theme tokens, re-read when the theme flips.
  // Activation climbs a cold-to-warm thermal ramp: resting cool slate
  // through indigo, violet, magenta, crimson, orange, and gold to warm
  // white at full recruitment (deepened variants on the light theme).
  // The input maps linearly, so color is earned by real activation
  // and near-silence stays slate.
  var ink = "#808080";
  var DARK_STOPS = [
    [70, 85, 120],
    [64, 80, 210],
    [130, 60, 220],
    [200, 60, 180],
    [240, 80, 100],
    [255, 140, 50],
    [255, 200, 80],
    [255, 245, 225],
  ];
  var LIGHT_STOPS = [
    [100, 112, 132],
    [58, 70, 180],
    [110, 45, 185],
    [168, 38, 140],
    [196, 50, 70],
    [205, 105, 20],
    [170, 120, 10],
    [80, 40, 5],
  ];
  var POS = [0, 0.14, 0.28, 0.42, 0.58, 0.72, 0.86, 1];
  var stops = DARK_STOPS;
  function ramp(a) {
    a = Math.max(0, Math.min(1, a));
    var i = 1;
    while (i < POS.length - 1 && a > POS[i]) i++;
    var t2 = Math.max(0, Math.min(1, (a - POS[i - 1]) / (POS[i] - POS[i - 1])));
    var s0 = stops[i - 1], s1 = stops[i];
    return "rgb(" + ((s0[0] + (s1[0] - s0[0]) * t2) | 0) + "," + ((s0[1] + (s1[1] - s0[1]) * t2) | 0) + "," + ((s0[2] + (s1[2] - s0[2]) * t2) | 0) + ")";
  }
  function palette() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
    if (v) ink = v;
    stops = document.documentElement.classList.contains("dark") ? DARK_STOPS : LIGHT_STOPS;
  }
  palette();
  if (window.MutationObserver) {
    new MutationObserver(palette).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  // Grab and tumble: dragging anywhere off the controls throws the
  // net in both axes, momentum carries it and decays, and the slow
  // automatic turn never stops underneath.
  var userYaw = 0, yawVel = 0, userTilt = 0, tiltVel = 0;
  var dragging = false, dragX = 0, dragY = 0;
  if (!still) {
    addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest(".listen-bar, header, a, button, input, select")) return;
      dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      yawVel = 0;
      tiltVel = 0;
    });
    addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - dragX;
      var dy = e.clientY - dragY;
      dragX = e.clientX;
      dragY = e.clientY;
      var d = -dx * 0.005;
      var d2 = -dy * 0.004;
      userYaw += d;
      userTilt += d2;
      yawVel = d;
      tiltVel = d2;
    });
    addEventListener("pointerup", function () { dragging = false; });
    addEventListener("pointercancel", function () { dragging = false; });
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

  var prevCells = [], cellBase = [];
  for (var p = 0; p < 16; p++) { prevCells.push(0); cellBase.push(0); }
  var px = [], py = [], pz = [];

  function firePulse(ni) {
    var inc = incident[ni];
    if (!inc.length || pulses.length >= 150) return;
    var ei = inc[(Math.random() * inc.length) | 0];
    pulses.push({ e: ei, t: 0, sp: 0.02 + Math.random() * 0.025, from: edges[ei][0] === ni ? 0 : 1 });
  }

  // Spawn choreography: intro runs 0..1. Each neuron gets a staggered
  // start and eases out from the singularity with a little overshoot,
  // the whole structure spinning down as it forms. Leaving reverses it.
  var active = false, rafId = 0;
  var mode = 0, intro = 0;
  function easeBack(t2) {
    var u = t2 - 1;
    return 1 + 2.7 * u * u * u + 1.7 * u * u;
  }
  function stagger(i) {
    return ((i * 0.61803) % 1) * 0.35;
  }

  function draw(t) {
    g.clearRect(0, 0, W, H);
    var eff = still ? 1 : intro;
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
      var drive = rel * (0.45 + 1.6 * atk) * (0.25 + 1.05 * loud) * 1.5;
      var target = drive > n.bias ? Math.min(1, ((drive - n.bias) / (1 - n.bias)) * 1.15) : 0;
      n.act += (target - n.act) * (target > n.act ? 0.3 : 0.13);
    }

    // A rising cell is a struck note: fire pulses from its neurons,
    // more of them the louder the passage. Not during the spawn.
    if (cs && !still && eff > 0.85) {
      var burst = 1 + Math.round(loud * 4);
      var thresh = Math.max(0.07, 0.16 - loud * 0.08);
      for (var c2 = 0; c2 < 16; c2++) {
        var v = cs[c2] || 0;
        if (v - prevCells[c2] > thresh) {
          var members = cellNodes[c2];
          for (var q = 0; q < burst && members.length; q++) {
            firePulse(members[(Math.random() * members.length) | 0]);
          }
        }
        prevCells[c2] = v;
      }
    }

    // Turn the cloud: a slow yaw under a fixed tilt, sped up into a
    // decelerating birth-spin while the machine forms, then
    // perspective.
    if (!dragging) {
      userYaw += yawVel;
      yawVel *= 0.95;
      userTilt += tiltVel;
      tiltVel *= 0.95;
    }
    var yaw = (still ? 0.6 : t * 0.00008) + (1 - eff) * 1.5 + userYaw;
    var tilt = 0.32 + userTilt;
    var cy1 = Math.cos(yaw), sy1 = Math.sin(yaw);
    var cx1 = Math.cos(tilt), sx1 = Math.sin(tilt);
    var S = Math.min(W, H) * (W < H ? 0.46 : 0.36);
    var CX = W * 0.5, CY = H * 0.47;
    var prog = [];
    for (var j = 0; j < nodes.length; j++) {
      var m = nodes[j];
      var st = stagger(j);
      var np = Math.min(1, Math.max(0, (eff * 1.35 - st) / 0.65));
      prog[j] = np;
      var sc = easeBack(np);
      var xr = m.x * sc * cy1 + m.z * sc * sy1;
      var zr = -m.x * sc * sy1 + m.z * sc * cy1;
      var yr = m.y * sc * cx1 - zr * sx1;
      var z2 = m.y * sc * sx1 + zr * cx1;
      var per = 3.4 / (3.4 + z2);
      px[j] = CX + xr * S * per;
      py[j] = CY + yr * S * per;
      pz[j] = per;
    }

    // Edges: quiet wiring that brightens and heats up when both ends
    // are lit, with the whole loom lifting slightly in loud passages.
    // Threads only exist once both endpoints have arrived.
    g.lineCap = "round";
    for (var e2 = 0; e2 < edges.length; e2++) {
      var a = edges[e2][0], d2 = edges[e2][1];
      var knit = Math.min(prog[a], prog[d2]);
      if (knit <= 0.02) continue;
      var act = Math.min(nodes[a].act, nodes[d2].act);
      var depth = (pz[a] + pz[d2]) * 0.5;
      g.strokeStyle = act > 0.03 ? ramp(act) : ink;
      g.globalAlpha = (0.11 + loud * 0.05 + act * 0.42) * depth * knit * knit;
      g.lineWidth = (0.6 + act * 1.2) * depth;
      g.beginPath();
      g.moveTo(px[a], py[a]);
      g.lineTo(px[d2], py[d2]);
      g.stroke();
    }

    // Signal pulses race along the wiring and excite their targets.
    // In loud passages an arrival can chain-fire onward, so climaxes
    // cascade through the whole organ.
    g.fillStyle = ramp(0.75);
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

    // Neurons: a soft halo when excited, a firm core always, both
    // climbing the thermal ramp with activation.
    for (var w2 = 0; w2 < nodes.length; w2++) {
      var nn = nodes[w2];
      var per2 = pz[w2];
      var born = prog[w2];
      if (born <= 0) continue;
      g.fillStyle = nn.act > 0.03 ? ramp(nn.act) : ink;
      if (nn.act > 0.2) {
        g.globalAlpha = nn.act * 0.18 * per2 * born;
        g.beginPath();
        g.arc(px[w2], py[w2], (5 + nn.act * 9) * per2, 0, 6.2832);
        g.fill();
      }
      g.globalAlpha = (0.34 + nn.act * 0.6) * per2 * born;
      g.beginPath();
      g.arc(px[w2], py[w2], (1.15 + nn.act * 1.9) * per2, 0, 6.2832);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  function loop(ts) {
    intro += ((mode === 1 ? 1 : 0) - intro) * (mode === 1 ? 0.03 : 0.08);
    if (mode === 1 && intro > 0.999) intro = 1;
    if (mode !== 1 && intro < 0.005) {
      intro = 0;
      active = false;
      g.clearRect(0, 0, W, H);
      return;
    }
    draw(ts || 0);
    if (active && !still) rafId = requestAnimationFrame(loop);
  }

  window.neuralField = {
    start: function () {
      mode = 1;
      if (active) return;
      active = true;
      size();
      if (still) draw(0);
      else rafId = requestAnimationFrame(loop);
    },
    stop: function () {
      mode = 0;
      if (still) {
        active = false;
        cancelAnimationFrame(rafId);
        g.clearRect(0, 0, W, H);
      }
    },
  };

  // The canvas only exists on /music, and that page IS the machine, so
  // generate a creature and spawn it the moment the page loads.
  generate();
  window.neuralField.start();
})();
