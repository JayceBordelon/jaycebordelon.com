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
  // The signal mix is fixed, tuned per genre so every song arrives
  // with its ideal chemistry: spectrum leads, impact punctuates, and
  // loudness modulates. The modal displays the active values.
  var UNIVERSAL = { sig: 1.4, lam: 0.9, kap: 1.1, phi: 0.8, eta: 0.9 };
  var PRESETS = {
    "Classical": { sig: 1.6, lam: 0.8, kap: 0.8, phi: 1.1, eta: 0.7 },
    "Piano Covers": { sig: 1.6, lam: 0.8, kap: 0.8, phi: 1.1, eta: 0.7 },
    "Originals": { sig: 1.6, lam: 0.8, kap: 0.8, phi: 1.1, eta: 0.7 },
    "Film Scores": { sig: 1.6, lam: 0.8, kap: 0.8, phi: 1.1, eta: 0.7 },
    "Rock": { sig: 1.2, lam: 1.0, kap: 1.4, phi: 0.6, eta: 1.2 },
    "Alternative": { sig: 1.25, lam: 1.0, kap: 1.25, phi: 0.7, eta: 1.1 },
    "Electronic": { sig: 1.1, lam: 1.1, kap: 1.3, phi: 0.9, eta: 0.8 },
    "Hip Hop": { sig: 1.0, lam: 1.0, kap: 1.5, phi: 0.7, eta: 1.0 },
  };
  var WEIGHTS = UNIVERSAL;
  var lastGenre = null;
  function applyPreset(genre) {
    lastGenre = genre;
    WEIGHTS = PRESETS[genre] || UNIVERSAL;
    var ids = { lam: "sw-lam-v", sig: "sw-sig-v", kap: "sw-kap-v", phi: "sw-phi-v", eta: "sw-eta-v" };
    for (var k in ids) {
      var el = document.getElementById(ids[k]);
      if (el) el.textContent = WEIGHTS[k].toFixed(2);
    }
    var gEl = document.getElementById("mix-genre");
    if (gEl) gEl.textContent = genre ? "tuned for " + genre.toLowerCase() : "universal tuning";
  }

  var labelEl = document.getElementById("net-label");
  var labelName = document.getElementById("net-label-name");
  var labelEqn = document.getElementById("net-label-eqn");
  var labelParams = document.getElementById("net-label-params");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;
  var pulses = [];
  var rings = [];
  var lastKick = -9999;

  // A fresh seed every visit: the brain is never the same twice.
  var seed = (Math.random() * 4294967296) | 0;
  function rnd() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  var nodes, edges, incident, cellNodes;
  function cellAt(rad2, my2, ys) {
    var t2 = my2 / (ys * 2);
    var reg = t2 > 0.25 ? 0 : t2 > 0 ? 1 : t2 > -0.25 ? 2 : 3;
    var sub = rad2 > 0.85 ? 0 : rad2 > 0.65 ? 1 : rad2 > 0.45 ? 2 : 3;
    return reg * 4 + sub;
  }
  function generate() {
    // Pure mirrored chaos. No structure pretends to be anything: a
    // uniform scatter through the volume, unevenly weighted clumps
    // wherever they land, a few random-walk wisps, and every point
    // stamped with its reflection through the vertical plane. Twins
    // share a pitch cell and light together.
    function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }
    var YS = 0.52 + rnd() * 0.18;
    nodes = [];
    edges = [];
    function pushMirrored(x, y, z, bias) {
      y = Math.max(-0.7, Math.min(0.7, y));
      // Soft radial compression: outliers get pulled back toward the
      // body instead of dangling far outside it.
      var r0 = Math.hypot(x, z);
      if (r0 > 1.02) {
        var pull = (1.02 + (r0 - 1.02) * 0.22) / r0;
        x *= pull;
        z *= pull;
      }
      var rad = Math.hypot(x, z);
      nodes.push({ x: x, y: y, z: z, cell: cellAt(rad, y, YS), bias: bias, act: 0 });
      nodes.push({ x: x, y: y, z: -z, cell: cellAt(rad, y, YS), bias: bias, act: 0 });
    }

    // The open scatter.
    var SCATTER = 70 + ((rnd() * 40) | 0);
    for (var s0 = 0; s0 < SCATTER; s0++) {
      var sa = rnd() * TAU;
      var sr = Math.pow(rnd(), 0.5) * 0.95;
      pushMirrored(Math.cos(sa) * sr, (rnd() * 2 - 1) * YS, Math.sin(sa) * sr, 0.2 + rnd() * 0.5);
    }

    // Unevenly weighted clumps.
    var K = 4 + ((rnd() * 5) | 0);
    for (var c1 = 0; c1 < K; c1++) {
      var cx1 = (rnd() - 0.5) * 1.7;
      var cy1 = (rnd() * 2 - 1) * YS;
      var cz1 = (rnd() - 0.5) * 1.7;
      var cr1 = 0.07 + rnd() * 0.2;
      var cn1 = 8 + ((rnd() * rnd() * 40) | 0);
      for (var c2 = 0; c2 < cn1; c2++) {
        pushMirrored(cx1 + gauss() * cr1, cy1 + gauss() * cr1, cz1 + gauss() * cr1, 0.2 + rnd() * 0.5);
      }
    }

    // Random-walk wisps.
    var WISPS = 4 + ((rnd() * 5) | 0);
    for (var w0 = 0; w0 < WISPS; w0++) {
      var wx = (rnd() - 0.5) * 1.2, wy = (rnd() * 2 - 1) * YS * 0.9, wz = (rnd() - 0.5) * 1.2;
      var dirx = gauss(), diry = gauss() * 0.95, dirz = gauss();
      var dl = Math.hypot(dirx, diry, dirz) || 1;
      dirx /= dl; diry /= dl; dirz /= dl;
      var steps = 5 + ((rnd() * 8) | 0);
      for (var st0 = 0; st0 < steps; st0++) {
        wx += dirx * (0.08 + rnd() * 0.07);
        wy += diry * (0.09 + rnd() * 0.07);
        wz += dirz * (0.08 + rnd() * 0.07);
        dirx += gauss() * 0.4;
        diry += gauss() * 0.38;
        dirz += gauss() * 0.4;
        dl = Math.hypot(dirx, diry, dirz) || 1;
        dirx /= dl; diry /= dl; dirz /= dl;
        pushMirrored(wx, wy, wz, 0.2 + rnd() * 0.5);
      }
    }

    var label = "MIRRORED CHAOS \u00b7 " + K + " CLUMPS " + WISPS + " WISPS";
    var eqn = "uniform scatter through the volume\nunevenly weighted random clumps\nrandom-walk wisps\nevery point reflected z \u2192 \u2212z";

    // Wiring: three nearest neighbors each, deduped, plus a few long
    // chords straight through the tangle.
    var seen = {};
    nodes.forEach(function (n, ai) {
      var ds = nodes.map(function (q, bi) {
        var dx = n.x - q.x, dy = n.y - q.y, dz = n.z - q.z;
        return { d: dx * dx + dy * dy + dz * dz, i: bi };
      }).sort(function (p1, q1) { return p1.d - q1.d; });
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
  var mmx = -1, mmy = -1;
  var zoom = 1, zoomT = 1;
  var touches = {}, touchCount = 0, pinchLast = 0;
  function clampZoom(v) { return Math.max(0.35, Math.min(3, v)); }
  if (!still) {
    addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest(".listen-bar, header, a, button, input, select")) return;
      touches[e.pointerId] = [e.clientX, e.clientY];
      touchCount++;
      if (touchCount === 2) {
        var ids = Object.keys(touches);
        pinchLast = Math.hypot(touches[ids[0]][0] - touches[ids[1]][0], touches[ids[0]][1] - touches[ids[1]][1]);
        dragging = false;
        return;
      }
      dragging = true;
      dragX = e.clientX;
      dragY = e.clientY;
      yawVel = 0;
      tiltVel = 0;
    });
    addEventListener("pointermove", function (e) {
      mmx = e.clientX;
      mmy = e.clientY;
      if (touches[e.pointerId]) touches[e.pointerId] = [e.clientX, e.clientY];
      if (touchCount === 2) {
        var ids2 = Object.keys(touches);
        var d2p = Math.hypot(touches[ids2[0]][0] - touches[ids2[1]][0], touches[ids2[0]][1] - touches[ids2[1]][1]);
        if (pinchLast > 0 && d2p > 0) zoomT = clampZoom(zoomT * (d2p / pinchLast));
        pinchLast = d2p;
        if (still && active) { zoom = zoomT; draw(0); }
        return;
      }
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
    addEventListener("pointerup", function (e) {
      dragging = false;
      if (touches[e.pointerId]) { delete touches[e.pointerId]; touchCount--; }
      pinchLast = 0;
    });
    addEventListener("pointercancel", function (e) {
      dragging = false;
      if (touches[e.pointerId]) { delete touches[e.pointerId]; touchCount--; }
      pinchLast = 0;
    });
    // Scroll to zoom, except over the scrollable song list and bar.
    addEventListener("wheel", function (e) {
      if (e.target && e.target.closest && e.target.closest(".listen-bar, .listen-tracklist, .net-label")) return;
      e.preventDefault();
      zoomT = clampZoom(zoomT * Math.exp(-e.deltaY * 0.0012));
      if (still && active) { zoom = zoomT; draw(0); }
    }, { passive: false });
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
    var kickV = field ? field.kick || 0 : 0;
    var fluxV = field ? field.flux || 0 : 0;
    var cent = field ? (field.centroid == null ? 0.5 : field.centroid) : 0.5;
    var gnow = field ? field.genre || "" : "";
    if (gnow !== lastGenre) applyPreset(gnow);

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
    // Broadband impact bypasses lateral inhibition: a slammed chord
    // raises every cell at once, which inhibition would otherwise
    // cancel, so kick and flux drive the whole structure directly.
    // Frequency carries real authority: the spectral centroid steers
    // drive toward the register geography that matches the sound's
    // brightness, and each register has its own dynamics, bass
    // blooming slow and heavy while treble sparkles fast.
    var impact = kickV * 0.3 + fluxV * 0.33;
    var ATTACK = [0.2, 0.28, 0.4, 0.55];
    var RELEASE = [0.07, 0.1, 0.15, 0.21];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var reg = n.cell >> 2;
      var raw = cs ? cs[n.cell] || 0 : 0;
      var rel = Math.max(0, raw - mean * 0.45 * WEIGHTS.eta);
      var atk = Math.max(0, raw - cellBase[n.cell]);
      var regN = 1 - reg / 3;
      var freqW = 0.55 + 0.95 * (1 - Math.abs(regN - cent));
      freqW = 1 + WEIGHTS.phi * (freqW - 1);
      var drive = WEIGHTS.sig * rel * (0.45 + 1.6 * atk) * (0.15 + WEIGHTS.lam * loud) * 1.35 * freqW + WEIGHTS.kap * impact * (0.35 + 0.75 * loud);
      var target = drive > n.bias ? Math.min(1, ((drive - n.bias) / (1 - n.bias)) * 1.15) : 0;
      n.act += (target - n.act) * (target > n.act ? ATTACK[reg] : RELEASE[reg]);
    }

    // A rising cell is a struck note: fire pulses from its neurons,
    // more of them the louder the passage. Not during the spawn.
    if (cs && !still && eff > 0.85) {
      var burst = 1 + Math.round(loud * 3 + fluxV * 3);
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
    zoom += (zoomT - zoom) * 0.18;
    var yaw = (still ? 0.6 : t * 0.00008) + (1 - eff) * 1.5 + userYaw;
    var tilt = 0.32 + userTilt;
    var cy1 = Math.cos(yaw), sy1 = Math.sin(yaw);
    var cx1 = Math.cos(tilt), sx1 = Math.sin(tilt);
    var S = Math.min(W, H) * (W < H ? 0.46 : 0.36) * zoom;
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

    // Kick shockwaves: a bass hit throws an expanding ring from the
    // center of the structure.
    if (!still && eff > 0.9 && kickV > 0.45 && t - lastKick > 180) {
      lastKick = t;
      if (rings.length < 8) rings.push({ r: Math.min(W, H) * 0.05, v: 9 + kickV * 12, a: 0.5 });
    }
    for (var rg = rings.length - 1; rg >= 0; rg--) {
      var R0 = rings[rg];
      R0.r += R0.v;
      R0.a *= 0.93;
      if (R0.a < 0.02) { rings.splice(rg, 1); continue; }
      g.strokeStyle = ramp(0.55);
      g.globalAlpha = R0.a;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(CX, CY, R0.r, 0, 6.2832);
      g.stroke();
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
    // Hover: ring the nearest point and print its model coordinates.
    if (!dragging && mmx >= 0 && eff > 0.9) {
      var best = -1, bestD = 144;
      for (var hv = 0; hv < nodes.length; hv++) {
        var hdx = px[hv] - mmx, hdy = py[hv] - mmy;
        var hd = hdx * hdx + hdy * hdy;
        if (hd < bestD) { bestD = hd; best = hv; }
      }
      if (best >= 0) {
        var hn = nodes[best];
        g.strokeStyle = ink;
        g.globalAlpha = 0.85;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(px[best], py[best], 6.5, 0, 6.2832);
        g.stroke();
        g.font = '10px "IBM Plex Mono", Menlo, monospace';
        g.fillStyle = ink;
        g.globalAlpha = 0.9;
        g.fillText("(" + hn.x.toFixed(2) + ", " + hn.y.toFixed(2) + ", " + hn.z.toFixed(2) + ")", px[best] + 12, py[best] - 9);
      }
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

  // The signal mix modal displays the active per-genre tuning.
  var mixWrap = document.getElementById("net-mix");
  var mixBtn = document.getElementById("net-mix-btn");
  if (mixBtn && mixWrap) {
    mixBtn.addEventListener("click", function () {
      var open = mixWrap.classList.toggle("open");
      mixBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mixWrap.classList.contains("open")) {
        mixWrap.classList.remove("open");
        mixBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
  applyPreset("");

  // The scramble badge rolls a fresh structure and replays the spawn.
  var scrambleBtn = document.getElementById("net-scramble");
  if (scrambleBtn) {
    scrambleBtn.addEventListener("click", function () {
      generate();
      if (still) {
        draw(0);
      } else {
        intro = 0;
        mode = 1;
        window.neuralField.start();
      }
    });
  }

  // The canvas only exists on /music, and that page IS the machine, so
  // generate a creature and spawn it the moment the page loads.
  generate();
  window.neuralField.start();
})();
