// Theme toggle. Reads system preference on first visit, persists user
// override to localStorage. Synchronously applied in layout.html <head>
// before paint to avoid the wrong-theme flash; this file handles the
// click handler + propagates changes to other open tabs.
(function () {
  function apply(mode) {
    if (mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }
  function current() {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  function toggle() {
    var next = current() === "dark" ? "light" : "dark";
    try { localStorage.setItem("theme", next); } catch (e) {}
    apply(next);
  }
  var btn = document.getElementById("theme-toggle");
  if (btn) btn.addEventListener("click", toggle);
  // Sync across tabs: storage event fires on OTHER tabs when localStorage changes.
  window.addEventListener("storage", function (e) {
    if (e.key === "theme" && e.newValue) apply(e.newValue);
  });
})();
