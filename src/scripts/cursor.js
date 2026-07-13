// The custom cursor: an accent dot rides the pointer, interactive
// elements get a corner-bracket lock that flies out from the cursor,
// and every click lands a pulse of expanding rings plus a floating
// reward tick. Fine pointers only. Touch devices and reduced motion
// never see any of it.
(function () {
  var fine = window.matchMedia && matchMedia("(pointer: fine)").matches;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || still) return;

  var cur = document.createElement("div");
  cur.className = "cur cur-hidden";
  cur.innerHTML =
    '<div class="cur-dot"></div>' +
    '<div class="cur-frame"><i></i><i></i><i></i><i></i></div>';
  document.body.appendChild(cur);
  document.documentElement.classList.add("cursor-on");

  var dot = cur.children[0], frame = cur.children[1];
  var px = innerWidth / 2, py = innerHeight / 2;
  var lock = null, fx = 0, fy = 0, fw = 0, fh = 0;

  addEventListener("pointermove", function (e) {
    px = e.clientX; py = e.clientY;
    cur.classList.remove("cur-hidden");
  });
  document.documentElement.addEventListener("mouseleave", function () {
    cur.classList.add("cur-hidden");
  });

  addEventListener("pointerover", function (e) {
    var t = e.target.closest("a, button, [role=button], summary, [data-cursor]");
    if (t && !lock) { fx = px; fy = py; fw = 0; fh = 0; }
    lock = t;
    cur.classList.toggle("cur-lock", !!t);
  });

  addEventListener("pointerdown", function (e) {
    cur.classList.add("cur-down");
    var p = document.createElement("div");
    p.className = "cur-pulse";
    p.style.left = e.clientX + "px";
    p.style.top = e.clientY + "px";
    var tick = document.createElement("span");
    tick.textContent = "+" + (0.01 + Math.random() * 0.09).toFixed(2);
    p.appendChild(tick);
    document.body.appendChild(p);
    p.addEventListener("animationend", function (ev) {
      if (ev.target === p && !ev.pseudoElement) p.remove();
    });
  });
  addEventListener("pointerup", function () { cur.classList.remove("cur-down"); });

  (function tick() {
    dot.style.transform = "translate(" + px + "px," + py + "px)";
    if (lock) {
      var b = lock.getBoundingClientRect();
      fx += (b.left - fx) * 0.22;
      fy += (b.top - fy) * 0.22;
      fw += (b.width - fw) * 0.22;
      fh += (b.height - fh) * 0.22;
      frame.style.transform = "translate(" + fx + "px," + fy + "px)";
      frame.style.width = fw + "px";
      frame.style.height = fh + "px";
    }
    requestAnimationFrame(tick);
  })();
})();
