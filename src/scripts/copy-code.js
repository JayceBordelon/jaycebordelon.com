// Adds a copy button to every Shiki code block in a post. Progressive
// enhancement: the code is fully readable without JS; this only wires up
// the clipboard affordance. Kept deliberately tiny (see CLAUDE.md JS budget).
(function () {
  const blocks = document.querySelectorAll("article .shiki");

  for (const block of blocks) {
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code";
    button.setAttribute("aria-label", "Copy code");
    button.textContent = "Copy";
    wrapper.appendChild(button);

    button.addEventListener("click", async () => {
      const code = block.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied";
        button.classList.add("copied");
        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("copied");
        }, 1600);
      } catch {
        button.textContent = "Failed";
        setTimeout(() => (button.textContent = "Copy"), 1600);
      }
    });
  }
})();
