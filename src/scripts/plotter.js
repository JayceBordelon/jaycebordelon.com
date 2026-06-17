// The Plotter — on first load the sheet draws itself: the frame strokes in,
// the content inks in in order, and a quiet drafting-status line fills,
// then the overlay lifts away. Progressive enhancement: with no JS the
// existing CSS .draft reveal already shows everything; this only ADDS the
// status-line fill and the timed completion. Bails on reduced-motion.
(function () {
  var root = document.documentElement;
  var overlay = document.getElementById("plot-overlay");
  if (!overlay) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Mark that JS is driving the entrance so CSS can sync to it.
  root.classList.add("js-plot");
  if (reduce) { root.classList.add("plot-done"); return; }

  var fill = overlay.querySelector(".plot-status-fill");
  var DUR = 2800; // total entrance time, ms — matches the CSS timeline.

  // Gentle ease-in-out so the progress line eases off the start and settles
  // into the finish rather than tracking linearly.
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  var start = null;
  function frame(now) {
    if (start === null) start = now;
    var t = Math.min((now - start) / DUR, 1);
    if (fill) fill.style.width = (ease(t) * 100).toFixed(1) + "%";
    if (t < 1) { requestAnimationFrame(frame); return; }
    // Finish: complete the line and retire the overlay.
    if (fill) fill.style.width = "100%";
    root.classList.add("plot-done");
    setTimeout(function () { overlay.remove(); }, 600);
  }
  requestAnimationFrame(frame);
})();
