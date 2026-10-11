const bar = document.querySelector(".sim-controls");
if (bar) {
  bar.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-code]");
    if (!button) return;
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    canvas.dispatchEvent(new KeyboardEvent("keydown", {
      code: button.dataset.code,
      bubbles: true,
    }));
  });
}
