(function () {
  const slides = Array.from(document.querySelectorAll(".slide"));
  if (!slides.length) return;

  const countEl = document.getElementById("deck-count");
  const progress = document.getElementById("deck-progress");
  const live = document.getElementById("deck-live");
  const prevBtn = document.getElementById("deck-prev");
  const nextBtn = document.getElementById("deck-next");
  const outline = document.getElementById("deck-outline");
  const outlineBtn = document.getElementById("deck-outline-toggle");
  const outlineList = document.getElementById("deck-outline-list");
  const total = slides.length;
  let index = 0;
  let touchX = null;

  if (progress) {
    progress.max = total;
    progress.value = 1;
  }

  function titleOf(slide) {
    const h = slide.querySelector("h1, h2");
    return h ? h.textContent.replace(/\s+/g, " ").trim() : slide.dataset.id || "Slide";
  }

  if (outlineList) {
    slides.forEach((slide, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#" + (slide.dataset.id || "s" + (i + 1));
      a.textContent = String(i + 1).padStart(2, "0") + "  " + titleOf(slide);
      a.dataset.index = String(i);
      li.appendChild(a);
      outlineList.appendChild(li);
    });
  }

  function setOutlineOpen(open) {
    if (!outline || !outlineBtn) return;
    outline.classList.toggle("is-open", open);
    outlineBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function go(n, fromHash) {
    const next = Math.max(0, Math.min(total - 1, n));
    slides[index].classList.remove("is-current");
    slides[index].setAttribute("aria-hidden", "true");
    slides[index].inert = true;
    index = next;
    slides[index].classList.add("is-current");
    slides[index].removeAttribute("aria-hidden");
    slides[index].inert = false;
    if (countEl) countEl.textContent = (index + 1) + " / " + total;
    if (progress) progress.value = index + 1;
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;
    if (live) live.textContent = "Slide " + (index + 1) + " of " + total + ": " + titleOf(slides[index]);
    if (outlineList) {
      outlineList.querySelectorAll("a").forEach((a, i) => {
        a.classList.toggle("is-current", i === index);
      });
    }
    if (!fromHash) {
      const id = slides[index].dataset.id;
      history.replaceState(null, "", id ? "#" + id : "#s" + (index + 1));
    }
  }

  function fromHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return 0;
    const byId = slides.findIndex((s) => s.dataset.id === raw);
    if (byId >= 0) return byId;
    const m = raw.match(/^s(\d+)$/i);
    if (m) return Math.max(0, parseInt(m[1], 10) - 1);
    return 0;
  }

  slides.forEach((slide, i) => {
    slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");
    slide.inert = i !== 0;
  });
  go(fromHash(), true);

  window.addEventListener("hashchange", function () {
    go(fromHash(), true);
  });

  function onKey(e) {
    if (e.defaultPrevented) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(total - 1);
    } else if (e.key === "Escape") {
      setOutlineOpen(false);
    }
  }

  document.addEventListener("keydown", onKey);
  if (prevBtn) prevBtn.addEventListener("click", function () { go(index - 1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { go(index + 1); });
  if (outlineBtn) {
    outlineBtn.addEventListener("click", function () {
      setOutlineOpen(!(outline && outline.classList.contains("is-open")));
    });
  }
  if (outlineList) {
    outlineList.addEventListener("click", function (e) {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      go(parseInt(a.dataset.index, 10) || 0);
      setOutlineOpen(false);
    });
  }

  document.addEventListener("touchstart", function (e) {
    if (!e.changedTouches[0]) return;
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  document.addEventListener("touchend", function (e) {
    if (touchX == null || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 50) return;
    go(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
