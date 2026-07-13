/*
 * Reward surface geometry for the page background.
 *
 * Generates a post-training tableau at build time: reward summits
 * plotted as nested isolines, one policy rollout exploring its way to
 * the highest-reward peak, and a scatter of reward readings, emitted as
 * SVG markup for src/partials/background.html. Two compositions come
 * out of one generator: a 1440x900 landscape field and a 480x900
 * portrait field, so phones get the full rollout story instead of a
 * thin crop of the desktop one. The PRNG is seeded, so every build
 * ships byte-identical geometry.
 */

const TAU = Math.PI * 2;

/* Small fast seeded PRNG (mulberry32). Deterministic across builds. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = Math.round;

/* Closed Catmull-Rom loop converted to cubic Beziers. */
function closedPath(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

/* Open Catmull-Rom spline, endpoints clamped. */
function openPath(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, n - 1)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/*
 * A ring's silhouette: low-order harmonics shared by every ring of a
 * summit (so the stack nests without crossing) plus a small absolute
 * per-ring wobble for a hand-surveyed feel. Amplitudes are capped well
 * under the ring gap, which keeps neighbors from ever touching.
 */
function makeShape(rng) {
  const harmonics = [
    { freq: 1, amp: 0.1 + rng() * 0.03, phase: rng() * TAU },
    { freq: 2, amp: 0.06 + rng() * 0.03, phase: rng() * TAU },
    { freq: 3, amp: 0.03 + rng() * 0.02, phase: rng() * TAU },
    { freq: 5, amp: 0.01 + rng() * 0.01, phase: rng() * TAU },
  ];
  return (theta) => harmonics.reduce((s, h) => s + h.amp * Math.sin(h.freq * theta + h.phase), 1);
}

function ringPoints(summit, shape, i, wobblePhase) {
  const r = summit.r0 + summit.gap * i;
  const cx = summit.cx + summit.driftX * i;
  const cy = summit.cy + summit.driftY * i;
  const steps = r < 120 ? 16 : 22;
  const pts = [];
  for (let k = 0; k < steps; k++) {
    const theta = (k / steps) * TAU;
    const wobble = 3 * Math.sin(3 * theta + wobblePhase);
    const radius = r * shape(theta) + wobble;
    pts.push([cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius * summit.squash]);
  }
  return pts;
}

/*
 * Depth band per ring (0 = innermost ring of a stack). Inner rings are
 * the crispest lines in the field, the outermost fade into the low
 * plain. Band 3 is innermost/strongest, band 0 outermost/faintest.
 */
function bandFor(i, rings) {
  const t = rings === 1 ? 0 : i / (rings - 1);
  if (t <= 0.29) return 3;
  if (t <= 0.56) return 2;
  if (t <= 0.81) return 1;
  return 0;
}

/*
 * Each composition: summits (the reward terrain), waypoints (the policy
 * rollout, ending at the global maximum), readings (hand-plotted reward
 * values, rising toward each peak), and the EPISODE 0 stamp where the
 * rollout enters the field.
 *
 * Landscape, viewBox 0 0 1440 900: A upper left and B lower right are
 * high-reward local peaks the policy explores past, C upper right
 * bleeds off the edge, D bottom center is the global maximum, placed
 * clear of the hero portrait card so convergence is never hidden.
 */
const LANDSCAPE = {
  summits: [
    { cx: 350, cy: 260, r0: 46, gap: 30, rings: 8, driftX: -7, driftY: 5, squash: 0.8 },
    { cx: 1085, cy: 640, r0: 40, gap: 30, rings: 6, driftX: 6, driftY: -4, squash: 0.85 },
    { cx: 1300, cy: 150, r0: 34, gap: 26, rings: 5, driftX: -5, driftY: 6, squash: 0.9 },
    { cx: 660, cy: 770, r0: 36, gap: 26, rings: 6, driftX: 5, driftY: -6, squash: 0.78 },
  ],
  waypoints: [
    [-60, 380],
    [130, 420],
    [300, 480],
    [480, 430],
    [640, 500],
    [800, 560],
    [900, 680],
    [760, 735],
    [630, 795],
    [700, 788],
    [660, 770],
  ],
  readings: [
    { x: 322, y: 252, v: "0.47" },
    { x: 470, y: 396, v: "0.31" },
    { x: 160, y: 84, v: "0.12" },
    { x: 1082, y: 630, v: "0.61" },
    { x: 1210, y: 760, v: "0.22" },
    { x: 1296, y: 148, v: "0.51" },
    { x: 1380, y: 288, v: "0.29" },
    { x: 578, y: 752, v: "0.94" },
    { x: 790, y: 892, v: "0.36" },
    { x: 905, y: 210, v: "0.09" },
    { x: 150, y: 640, v: "0.11" },
    { x: 1130, y: 380, v: "0.18" },
    { x: 706, y: 470, v: "0.14" },
  ],
  episodeLabel: [112, 447],
};

/*
 * Portrait, viewBox 0 0 480 900: the same story told vertically. The
 * rollout drops in from the top edge, explores past the two flanking
 * peaks, and converges on the bottom-left summit. Phones see nearly the
 * full frame, portrait tablets center-crop, so the action stays in the
 * middle band.
 */
const PORTRAIT = {
  summits: [
    { cx: 90, cy: 130, r0: 30, gap: 22, rings: 5, driftX: 4, driftY: 6, squash: 0.85 },
    { cx: 430, cy: 420, r0: 34, gap: 24, rings: 6, driftX: -6, driftY: 4, squash: 0.88 },
    { cx: 200, cy: 700, r0: 34, gap: 26, rings: 6, driftX: 5, driftY: -5, squash: 0.8 },
  ],
  waypoints: [
    [310, -40],
    [265, 80],
    [330, 190],
    [245, 290],
    [310, 395],
    [230, 480],
    [300, 565],
    [165, 660],
    [245, 725],
    [180, 690],
    [200, 700],
  ],
  readings: [
    { x: 74, y: 122, v: "0.42" },
    { x: 386, y: 118, v: "0.11" },
    { x: 404, y: 432, v: "0.58" },
    { x: 120, y: 668, v: "0.94" },
    { x: 60, y: 320, v: "0.16" },
    { x: 350, y: 820, v: "0.27" },
    { x: 60, y: 850, v: "0.08" },
  ],
  episodeLabel: [208, 104],
};

function composeField(rng, cfg) {
  const bands = [[], [], [], []];
  for (const summit of cfg.summits) {
    const shape = makeShape(rng);
    for (let i = 0; i < summit.rings; i++) {
      const wobblePhase = rng() * TAU;
      const d = closedPath(ringPoints(summit, shape, i, wobblePhase));
      bands[bandFor(i, summit.rings)].push(`<path d="${d}"/>`);
    }
  }
  const chartBands = bands
    .map((paths, i) => `<g class="chart-band chart-band--${i}">${paths.join("")}</g>`)
    .join("\n    ");

  /* Middle waypoints get a little exploration jitter, the entry point
     and the damped final approach stay exact so the rollout always
     converges on the maximum. */
  const steps = cfg.waypoints.map(([x, y], i) => {
    if (i === 0 || i >= cfg.waypoints.length - 3) return [x, y];
    return [x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 18];
  });
  const traceD = openPath(steps);
  const [mx, my] = cfg.waypoints[cfg.waypoints.length - 1];

  /* Step nodes are the rollout's footprints. The off-canvas entry and
     the maximum itself are skipped, the convergence marker owns the
     end, stamped with the optimal policy. */
  const nodes = steps
    .slice(1, -1)
    .map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="1.7"/>`)
    .join("");
  const rolloutNodes =
    `<g class="chart-steps">${nodes}</g>` +
    `<g class="chart-min" transform="translate(${mx} ${my})">` +
    `<circle class="chart-min-halo" r="9"/>` +
    `<circle class="chart-min-ring" r="9"/>` +
    `<circle class="chart-min-core" r="2.2"/>` +
    `<path class="chart-min-cross" d="M-16 0H-10M10 0H16M0 -16V-10M0 10V16"/>` +
    `<text x="15" y="-11">&#960;*</text>` +
    `</g>`;

  /* The episode zero stamp labels where the rollout enters the field. */
  const rewardReadings =
    cfg.readings.map((s) => `<text x="${s.x}" y="${s.y}">${s.v}</text>`).join("") +
    `<text x="${cfg.episodeLabel[0]}" y="${cfg.episodeLabel[1]}">EPISODE 0</text>`;

  return { chartBands, traceD, rolloutNodes, rewardReadings };
}

/* Template values for background.html, landscape + portrait ("P"). */
export function renderRewardField() {
  const rng = mulberry32(0x0cea11);
  const l = composeField(rng, LANDSCAPE);
  const p = composeField(rng, PORTRAIT);
  return {
    chartBands: l.chartBands,
    traceD: l.traceD,
    rolloutNodes: l.rolloutNodes,
    rewardReadings: l.rewardReadings,
    chartBandsP: p.chartBands,
    traceDP: p.traceD,
    rolloutNodesP: p.rolloutNodes,
    rewardReadingsP: p.rewardReadings,
  };
}
