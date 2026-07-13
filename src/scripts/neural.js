// The background as a listening brain. A 3d network of neurons turns
// slowly on its axis, rendered on the fixed canvas behind the page.
// Four lobes own the four piano registers (bass at the stem, tenor
// west, alto east, treble at the crown) and every neuron is tuned to
// one of the 16 pitch cells ambience.js publishes on window.soundField,
// with its own sensitivity bias: quiet notes clear only the most
// sensitive neurons, louder playing recruits more of the population,
// so activation density tracks loudness the way real tissue recruits.
// Attacks fire signal pulses down the edges, more and chattier when
// loud, and arrivals can chain-fire in climaxes. Canvas 2d and vanilla
// JS only. Reduced motion gets one static frame.
(function () {
  var cv = document.getElementById("bg-net");
  if (!cv || !cv.getContext) return;
  var g = cv.getContext("2d");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Seeded layout: the same brain on every page and every visit.
  var seed = 0x5eed;
  function rnd() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function gauss() { return (rnd() + rnd() + rnd() - 1.5) / 1.5; }

  var LOBES = [
    { x: 0.02, y: 0.58, z: 0.1, r: 0.4 },
    { x: -0.74, y: -0.04, z: -0.16, r: 0.5 },
    { x: 0.72, y: -0.02, z: 0.18, r: 0.5 },
    { x: 0.0, y: -0.6, z: -0.06, r: 0.46 },
  ];
  // The bias is each neuron's firing threshold: low-bias neurons wake
  // for whispers, high-bias ones only join when the music leans in.
  var nodes = [];
  for (var L = 0; L < 4; L++) {
    for (var i = 0; i < 48; i++) {
      nodes.push({
        x: LOBES[L].x + gauss() * LOBES[L].r,
        y: LOBES[L].y + gauss() * LOBES[L].r * 0.85,
        z: LOBES[L].z + gauss() * LOBES[L].r,
        cell: L * 4 + ((rnd() * 4) | 0),
        bias: 0.12 + rnd() * 0.5,
        act: 0,
      });
    }
  }
  // Bridge neurons near the center stitch the lobes into one organ.
  for (var b = 0; b < 24; b++) {
    nodes.push({ x: gauss() * 0.34, y: gauss() * 0.32, z: gauss() * 0.34, cell: (rnd() * 16) | 0, bias: 0.12 + rnd() * 0.5, act: 0 });
  }

  // Edges: each neuron to its four nearest neighbors, deduped.
  var edges = [], seen = {};
  nodes.forEach(function (n, ai) {
    var ds = nodes.map(function (m, bi) {
      var dx = n.x - m.x, dy = n.y - m.y, dz = n.z - m.z;
      return { d: dx * dx + dy * dy + dz * dz, i: bi };
    }).sort(function (p, q) { return p.d - q.d; });
    for (var k = 1; k <= 4; k++) {
      var key = Math.min(ai, ds[k].i) + ":" + Math.max(ai, ds[k].i);
      if (!seen[key]) { seen[key] = 1; edges.push([ai, ds[k].i]); }
    }
  });
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
    if (still) draw(0);
  }
  addEventListener("resize", size);

  var pulses = [];
  var prevCells = [];
  for (var p = 0; p < 16; p++) prevCells.push(0);
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

    // Drive each neuron with its pitch cell scaled by loudness, then
    // gate through its bias: louder playing recruits deeper into the
    // population, so activation density follows the dynamics.
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var drive = cs ? (cs[n.cell] || 0) * (0.15 + 1.05 * loud) : 0;
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
        nodes[eb].act = Math.min(1, nodes[eb].act + 0.22);
        if (Math.random() < loud * 0.35) firePulse(eb);
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

  size();
  if (still) {
    draw(0);
  } else {
    (function loop(ts) {
      draw(ts || 0);
      requestAnimationFrame(loop);
    })(0);
  }
})();
