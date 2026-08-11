/* Sticky thinker TOC + back-to-top for philosophy essays. */
(function () {
  const sections = Array.from(document.querySelectorAll("section.thinker[id]"));
  if (!sections.length) return;

  const wrap = document.querySelector(".wrap.essay");
  if (!wrap) return;

  const SIBLINGS = [
    { href: "/grounding-the-unconscious.html", label: "Grounding the Unconscious" },
    { href: "/genealogies-of-desire.html", label: "Genealogies of Desire" },
    { href: "/constellations-of-history.html", label: "Constellations of History" },
    { href: "/technics-and-time.html", label: "Technics and Time" },
    { href: "/fiction-of-the-maps.html", label: "Fiction of the Maps" },
    { href: "/map-of-maps.html", label: "Thinkers Timeline" },
    { href: "/map-of-maps-currents.html", label: "Browse by current" },
    { href: "/philosophy-booklet.html", label: "Booklet / Print" },
  ];

  const layout = document.createElement("div");
  layout.className = "essay-layout";
  wrap.parentNode.insertBefore(layout, wrap);
  layout.appendChild(wrap);

  const toc = document.createElement("nav");
  toc.className = "essay-toc";
  toc.setAttribute("aria-label", "On this page");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "essay-toc-close";
  closeBtn.setAttribute("aria-label", "Close contents");
  closeBtn.innerHTML = "&times;";
  toc.appendChild(closeBtn);

  const path = (location.pathname || "").replace(/\/+$/, "") || "/";
  const pathBase = path.split("/").pop() || "";

  const more = document.createElement("div");
  more.className = "essay-toc-more";
  const moreLabel = document.createElement("p");
  moreLabel.className = "essay-toc-label";
  moreLabel.textContent = "Maps & essays";
  more.appendChild(moreLabel);
  const moreList = document.createElement("ul");
  SIBLINGS.forEach((item) => {
    const targetBase = item.href.replace(/\/+$/, "").split("/").pop() || "";
    const isCurrent = targetBase && targetBase === pathBase;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    if (isCurrent) {
      a.className = "is-current";
      a.setAttribute("aria-current", "page");
    }
    li.appendChild(a);
    moreList.appendChild(li);
  });
  more.appendChild(moreList);
  toc.appendChild(more);

  const label = document.createElement("p");
  label.className = "essay-toc-label";
  label.textContent = "On this page";
  toc.appendChild(label);

  const list = document.createElement("ol");
  const links = [];

  sections.forEach((section) => {
    const h2 = section.querySelector("h2");
    if (!h2) return;
    const title = (h2.childNodes[0] && h2.childNodes[0].textContent
      ? h2.childNodes[0].textContent
      : h2.textContent
    ).replace(/\s+/g, " ").trim();
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#" + section.id;
    a.textContent = title;
    li.appendChild(a);
    list.appendChild(li);
    links.push({ id: section.id, a, section });
  });

  toc.appendChild(list);

  layout.insertBefore(toc, wrap);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "essay-toc-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "");
  toggle.textContent = "Contents";
  document.body.appendChild(toggle);

  const backdrop = document.createElement("div");
  backdrop.className = "essay-toc-backdrop";
  backdrop.hidden = true;
  document.body.appendChild(backdrop);

  function setOpen(open) {
    toc.classList.toggle("is-open", open);
    backdrop.classList.toggle("is-open", open);
    backdrop.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.style.overflow = open ? "hidden" : "";
  }

  toggle.addEventListener("click", () => setOpen(!toc.classList.contains("is-open")));
  closeBtn.addEventListener("click", () => setOpen(false));
  backdrop.addEventListener("click", () => setOpen(false));
  toc.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "back-to-top";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.innerHTML = "↑";
  document.body.appendChild(topBtn);

  topBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function onScroll() {
    const y = window.scrollY || document.documentElement.scrollTop;
    topBtn.classList.toggle("is-visible", y > window.innerHeight * 0.85);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if ("IntersectionObserver" in window) {
    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visible.set(entry.target.id, entry.isIntersecting && entry.intersectionRatio > 0);
        });
        let activeId = null;
        for (const { id } of links) {
          if (visible.get(id)) {
            activeId = id;
            break;
          }
        }
        if (!activeId) {
          let best = null;
          let bestTop = Infinity;
          links.forEach(({ id, section }) => {
            const top = Math.abs(section.getBoundingClientRect().top);
            if (top < bestTop) {
              bestTop = top;
              best = id;
            }
          });
          activeId = best;
        }
        links.forEach(({ id, a }) => {
          a.classList.toggle("is-active", id === activeId);
        });
      },
      { rootMargin: "-12% 0px -70% 0px", threshold: [0, 0.1, 0.25] }
    );
    links.forEach(({ section }) => observer.observe(section));
  }
})();
