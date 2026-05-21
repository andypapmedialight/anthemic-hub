(function () {
  "use strict";

  var viewport = document.getElementById("pitch-viewport");
  var root = document.getElementById("pitch-slides");
  var progressEl = document.getElementById("pitch-progress");
  var progressFill = document.getElementById("deck-progress-fill");
  var navEl = document.getElementById("pitch-nav");
  var hintEl = document.getElementById("pitch-hint");
  if (!viewport || !root) return;

  var slides = [];
  var activeIndex = 0;
  var scrollRaf = 0;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSlide(slide, index, total) {
    var section = document.createElement("section");
    section.className = "pitch-slide";
    section.id = "slide-" + slide.id;
    section.setAttribute("data-slide", slide.id);
    section.setAttribute("aria-label", "Slide " + (index + 1) + " of " + total);
    section.setAttribute("tabindex", "-1");

    var inner = '<div class="pitch-slide-inner">';
    if (slide.kicker) {
      inner += '<p class="pitch-kicker">' + escapeHtml(slide.kicker) + "</p>";
    }
    if (slide.headline) {
      inner += '<h2 class="pitch-headline">' + escapeHtml(slide.headline) + "</h2>";
    }
    if (slide.subhead) {
      inner += '<p class="pitch-subhead">' + escapeHtml(slide.subhead) + "</p>";
    }
    if (slide.role) {
      inner += '<p class="pitch-role">' + escapeHtml(slide.role) + "</p>";
    }
    if (slide.meta) {
      inner += '<p class="pitch-meta">' + escapeHtml(slide.meta) + "</p>";
    }
    if (slide.body) {
      inner += '<p class="pitch-body">' + escapeHtml(slide.body) + "</p>";
    }
    if (slide.note) {
      inner += '<p class="pitch-note">' + escapeHtml(slide.note) + "</p>";
    }
    if (slide.stack) {
      inner += '<p class="pitch-stack">' + escapeHtml(slide.stack) + "</p>";
    }

    if (slide.bullets && slide.bullets.length) {
      if (slide.bullets[0] && slide.bullets[0].title) {
        inner += '<ul class="pitch-pillars">';
        slide.bullets.forEach(function (b) {
          inner +=
            '<li class="pitch-pillar"><h3 class="pitch-pillar-title">' +
            escapeHtml(b.title) +
            '</h3><p class="pitch-pillar-text">' +
            escapeHtml(b.text) +
            "</p></li>";
        });
        inner += "</ul>";
      } else {
        inner += '<ul class="pitch-bullets">';
        slide.bullets.forEach(function (b) {
          inner += "<li>" + escapeHtml(typeof b === "string" ? b : b.text || "") + "</li>";
        });
        inner += "</ul>";
      }
    }

    if (slide.skills && slide.skills.length) {
      inner += '<ol class="pitch-skills-list">';
      slide.skills.forEach(function (skill) {
        inner += "<li>" + escapeHtml(skill) + "</li>";
      });
      inner += "</ol>";
    }

    if (slide.projects && slide.projects.length) {
      inner += '<ul class="pitch-projects">';
      slide.projects.forEach(function (p) {
        inner +=
          '<li><a class="pitch-project-link" href="' +
          escapeHtml(p.href) +
          '"><span class="pitch-project-title">' +
          escapeHtml(p.title) +
          '</span><span class="pitch-project-desc">' +
          escapeHtml(p.desc) +
          "</span></a></li>";
      });
      inner += "</ul>";
    }

    if (slide.cta && slide.cta.url) {
      inner +=
        '<a class="pitch-cta-link" href="' +
        escapeHtml(slide.cta.url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(slide.cta.label) +
        " ↗</a>";
    }

    if (slide.links && slide.links.length) {
      inner += '<div class="pitch-actions">';
      slide.links.forEach(function (link) {
        var cls = link.primary ? "pitch-btn pitch-btn--primary" : "pitch-btn";
        var target = link.url.indexOf("http") === 0 ? ' target="_blank" rel="noopener noreferrer"' : "";
        inner +=
          '<a class="' +
          cls +
          '" href="' +
          escapeHtml(link.url) +
          '"' +
          target +
          ">" +
          escapeHtml(link.label) +
          "</a>";
      });
      inner += "</div>";
    }

    inner += "</div>";
    section.innerHTML = inner;
    return section;
  }

  function setActive(index) {
    if (index < 0 || index >= slides.length) return;
    activeIndex = index;
    if (progressEl) {
      progressEl.textContent = index + 1 + " / " + slides.length;
    }
    if (progressFill && slides.length) {
      progressFill.style.width = ((index + 1) / slides.length) * 100 + "%";
    }
    var dots = navEl ? navEl.querySelectorAll(".deck-dot") : [];
    dots.forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === index);
      dot.setAttribute("aria-current", i === index ? "true" : "false");
    });
    if (hintEl && index === slides.length - 1) {
      hintEl.hidden = true;
    }
  }

  function scrollToIndex(index) {
    var el = slides[index];
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setActive(index);
  }

  function nearestIndex() {
    var top = viewport.scrollTop;
    var best = 0;
    var bestDist = Infinity;
    slides.forEach(function (slide, i) {
      var dist = Math.abs(slide.offsetTop - top);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(function () {
      scrollRaf = 0;
      setActive(nearestIndex());
    });
  }

  function buildNav(count) {
    if (!navEl) return;
    navEl.innerHTML = "";
    for (var i = 0; i < count; i++) {
      (function (index) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "deck-dot";
        btn.setAttribute("aria-label", "Go to slide " + (index + 1));
        btn.addEventListener("click", function () {
          scrollToIndex(index);
        });
        navEl.appendChild(btn);
      })(i);
    }
  }

  function mount(data) {
    var list = data.slides || [];
    if (!list.length) {
      root.innerHTML = '<p class="pitch-error">No slides in pitch deck.</p>';
      return;
    }
    if (data.meta && data.meta.title) {
      document.title = data.meta.title + " · Anthemic Developments";
    }
    if (data.meta && data.meta.description) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", data.meta.description);
    }

    root.innerHTML = "";
    list.forEach(function (slide, i) {
      var el = renderSlide(slide, i, list.length);
      root.appendChild(el);
      slides.push(el);
    });
    buildNav(list.length);
    setActive(0);
    viewport.addEventListener("scroll", onScroll, { passive: true });
  }

  document.addEventListener("keydown", function (e) {
    if (!slides.length) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
      e.preventDefault();
      scrollToIndex(Math.min(activeIndex + 1, slides.length - 1));
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
      e.preventDefault();
      scrollToIndex(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollToIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      scrollToIndex(slides.length - 1);
    }
  });

  fetch("/content/pitch.json", { credentials: "same-origin" })
    .then(function (r) {
      if (!r.ok) throw new Error("pitch.json HTTP " + r.status);
      return r.json();
    })
    .then(mount)
    .catch(function (err) {
      root.innerHTML =
        '<p class="pitch-error">Could not load the deck' +
        (err && err.message ? " (" + escapeHtml(err.message) + ")" : "") +
        '. <a href="/">Return to hub</a>.</p>';
    });
})();
