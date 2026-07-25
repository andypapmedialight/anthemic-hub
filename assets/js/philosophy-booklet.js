/* Assemble printable philosophy booklet from live essay pages + timeline nodes. */
(function () {
  const ESSAYS = [
    {
      url: "/grounding-the-unconscious.html",
      prefix: "gtu-",
      slug: "grounding",
      title: "Grounding the Unconscious"
    },
    {
      url: "/genealogies-of-desire.html",
      prefix: "god-",
      slug: "genealogies",
      title: "Genealogies of Desire"
    },
    {
      url: "/constellations-of-history.html",
      prefix: "coh-",
      slug: "constellations",
      title: "Constellations of History"
    }
  ];

  const statusEl = document.getElementById("booklet-status");
  const root = document.getElementById("booklet-root");
  const tocEl = document.getElementById("booklet-toc");
  const printBtn = document.getElementById("booklet-print");

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.toggle("is-error", !!isError);
  }

  function prefixIds(rootEl, prefix) {
    const idMap = new Map();
    rootEl.querySelectorAll("[id]").forEach((el) => {
      if (el.id.startsWith("bmap-")) return;
      const old = el.id;
      const neu = prefix + old;
      idMap.set(old, neu);
      el.id = neu;
    });
    rootEl.querySelectorAll("a[href^='#']").forEach((a) => {
      const raw = a.getAttribute("href").slice(1);
      const hash = decodeURIComponent(raw);
      if (idMap.has(hash)) a.setAttribute("href", "#" + idMap.get(hash));
    });
    rootEl.querySelectorAll("use").forEach((use) => {
      ["href", "xlink:href"].forEach((attr) => {
        const val = use.getAttribute(attr);
        if (!val || !val.startsWith("#")) return;
        const hash = val.slice(1);
        if (hash.startsWith("bmap-")) return;
        if (idMap.has(hash)) use.setAttribute(attr, "#" + idMap.get(hash));
      });
    });
  }

  function essayTitleText(h2) {
    if (!h2) return "Section";
    const first = h2.childNodes[0];
    const raw = first && first.textContent ? first.textContent : h2.textContent;
    return raw.replace(/\s+/g, " ").trim();
  }

  async function loadEssay(spec) {
    const res = await fetch(spec.url);
    if (!res.ok) throw new Error("Failed to load " + spec.url + " (" + res.status + ")");
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const wrap = doc.querySelector(".wrap.essay");
    if (!wrap) throw new Error("No essay body in " + spec.url);
    wrap.querySelector(".site-bar")?.remove();
    const style = doc.querySelector("head style");
    const defsSvg = doc.body.querySelector(":scope > svg");
    prefixIds(wrap, spec.prefix);
    if (defsSvg) prefixIds(defsSvg, spec.prefix);
    return { spec, wrap, styleText: style ? style.textContent : "", defsSvg };
  }

  function formatYear(y, approx) {
    if (window.THINKERS_TIMELINE && typeof window.THINKERS_TIMELINE.formatYear === "function") {
      return window.THINKERS_TIMELINE.formatYear(y, approx);
    }
    const core = y < 0 ? Math.abs(y) + " BCE" : String(y);
    return approx ? "c. " + core : core;
  }

  function buildTimelineSection() {
    const data = window.THINKERS_TIMELINE;
    const section = document.createElement("section");
    section.className = "booklet-chapter booklet-timeline";
    section.id = "booklet-timeline";

    const header = document.createElement("header");
    header.className = "masthead";
    header.innerHTML =
      '<div class="eyebrow"><span class="dot">●</span> index</div>' +
      "<h1>Thinkers Timeline</h1>" +
      '<p class="dek">Chronological index of every thinker and key concept across the three essays. ' +
      'Years are floruit / key-work markers, not biographical precision. ' +
      'For the interactive diagram, see <a href="/map-of-maps.html">map-of-maps.html</a>.</p>';
    section.appendChild(header);

    if (!data || !Array.isArray(data.NODES)) {
      const p = document.createElement("p");
      p.className = "frame-note";
      p.textContent = "Timeline data unavailable.";
      section.appendChild(p);
      return section;
    }

    const groups = data.GROUP_LABELS || {};
    const ol = document.createElement("ol");
    ol.className = "timeline-print-list";

    data.NODES.forEach((n) => {
      const li = document.createElement("li");
      li.dataset.group = n.group;
      const year = document.createElement("span");
      year.className = "tl-year";
      year.textContent = formatYear(n.year, n.approx);
      const name = document.createElement("span");
      name.className = "tl-name";
      if (n.href) {
        const a = document.createElement("a");
        a.href = n.href;
        a.textContent = n.name;
        name.appendChild(a);
      } else {
        name.textContent = n.name;
      }
      const meta = document.createElement("span");
      meta.className = "tl-meta";
      const bits = [];
      if (n.sub) bits.push(n.sub);
      if (groups[n.group]) bits.push(groups[n.group]);
      meta.textContent = bits.join(" · ");
      li.appendChild(year);
      li.appendChild(name);
      if (bits.length) li.appendChild(meta);
      ol.appendChild(li);
    });

    section.appendChild(ol);
    return section;
  }

  function buildCover(tocEntries) {
    const cover = document.createElement("header");
    cover.className = "booklet-cover masthead";
    cover.id = "booklet-cover";
    const date = new Date().toISOString().slice(0, 10);
    cover.innerHTML =
      '<div class="eyebrow"><span class="dot">●</span> Anthemic Developments <span class="dot2">●</span> printable booklet</div>' +
      "<h1>Genealogies &amp; Constellations</h1>" +
      '<p class="dek">Three linked essays on the unconscious, desire, and historical form — with genealogy maps and a chronological thinkers index.</p>' +
      '<div class="frame-note">Assembled from the live site pages. Print from this view (Ctrl/Cmd+P). Interactive maps and the pan/zoom timeline remain on their source pages.</div>' +
      '<p class="booklet-date mono">Generated ' + date + "</p>";

    const toc = document.createElement("nav");
    toc.className = "booklet-contents";
    toc.setAttribute("aria-label", "Booklet contents");
    const h2 = document.createElement("h2");
    h2.textContent = "Contents";
    toc.appendChild(h2);
    const ol = document.createElement("ol");
    tocEntries.forEach((entry) => {
      const li = document.createElement("li");
      if (entry.level === 1) li.className = "toc-chapter";
      else li.className = "toc-section";
      const a = document.createElement("a");
      a.href = "#" + entry.id;
      a.textContent = entry.title;
      li.appendChild(a);
      ol.appendChild(li);
    });
    toc.appendChild(ol);
    cover.appendChild(toc);
    return cover;
  }

  function injectStyles(styleText, key) {
    if (!styleText) return;
    const el = document.createElement("style");
    el.dataset.bookletEssay = key;
    el.textContent = styleText;
    document.head.appendChild(el);
  }

  async function assemble() {
    setStatus("Loading essays…");
    if (printBtn) printBtn.disabled = true;

    try {
      const loaded = await Promise.all(ESSAYS.map(loadEssay));
      const tocEntries = [];
      const fragment = document.createDocumentFragment();

      loaded.forEach(({ spec, wrap, styleText, defsSvg }) => {
        injectStyles(styleText, spec.slug);
        if (defsSvg) fragment.appendChild(document.importNode(defsSvg, true));

        const chapter = document.createElement("section");
        chapter.className = "booklet-chapter";
        chapter.id = "chapter-" + spec.slug;
        chapter.dataset.source = spec.url;

        Array.from(wrap.childNodes).forEach((child) => {
          chapter.appendChild(document.importNode(child, true));
        });

        tocEntries.push({ id: chapter.id, title: spec.title, level: 1 });
        chapter.querySelectorAll("section.thinker[id]").forEach((sec) => {
          tocEntries.push({
            id: sec.id,
            title: essayTitleText(sec.querySelector("h2")),
            level: 2
          });
        });

        fragment.appendChild(chapter);
      });

      const timeline = buildTimelineSection();
      tocEntries.push({ id: "booklet-timeline", title: "Thinkers Timeline", level: 1 });
      fragment.appendChild(timeline);

      root.replaceChildren();
      root.appendChild(buildCover(tocEntries));
      root.appendChild(fragment);

      if (tocEl) {
        tocEl.replaceChildren();
        const screenOl = document.createElement("ol");
        tocEntries.filter((e) => e.level === 1).forEach((entry) => {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = "#" + entry.id;
          a.textContent = entry.title;
          li.appendChild(a);
          screenOl.appendChild(li);
        });
        tocEl.appendChild(screenOl);
      }

      setStatus("Ready — " + loaded.length + " essays + timeline. Use Print booklet when you want a PDF or paper copy.");
      if (printBtn) printBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Could not assemble booklet.", true);
    }
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", assemble);
  } else {
    assemble();
  }
})();
