/* Collapse long masthead NOTE boxes to the first few lines. */
(function () {
  const TOGGLE_MORE = "Expand note";
  const TOGGLE_LESS = "Collapse note";

  function overflowed(el) {
    return el.scrollHeight - el.clientHeight > 8;
  }

  function enhance(note) {
    if (note.dataset.frameReady === "1") return;
    if (note.dataset.collapse === "off") return;
    note.dataset.frameReady = "1";

    const body = document.createElement("div");
    body.className = "frame-note-body";
    while (note.firstChild) body.appendChild(note.firstChild);
    note.appendChild(body);
    note.classList.add("is-collapsible", "is-collapsed");

    const measure = () => {
      if (!overflowed(body)) {
        note.classList.remove("is-collapsed");
        const extra = note.querySelector(".frame-note-toggle");
        if (extra) extra.remove();
        return;
      }
      if (note.querySelector(".frame-note-toggle")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "frame-note-toggle";
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = TOGGLE_MORE;
      btn.addEventListener("click", () => {
        const open = note.classList.toggle("is-collapsed") === false;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? TOGGLE_LESS : TOGGLE_MORE;
      });
      note.appendChild(btn);
    };

    requestAnimationFrame(measure);
  }

  function initFrameNotes(root) {
    const scope = root || document;
    scope.querySelectorAll(".frame-note").forEach(enhance);
  }

  window.initFrameNotes = initFrameNotes;

  function start() {
    const run = () => initFrameNotes();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run);
    } else {
      run();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
