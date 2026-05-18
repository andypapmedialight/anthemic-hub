(function () {
  var CAPTIONS = {
    intro: "What — skills & links",
    who: "Who — profile & QA",
    lens: "Your lens — interest filter",
    projects: "01 — anthemic projects",
    music: "02 — music & gigs",
    bio: "03 — music bio",
    reading: "04 — reading list",
    work: "05 — professional work"
  };
  var scenes = document.querySelectorAll(".console-scene");
  var caption = document.getElementById("console-caption");
  var btns = document.querySelectorAll("[data-scene-jump]");
  var targets = document.querySelectorAll("[data-console-scene]");
  var current = "intro";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setScene(id, fromScroll) {
    if (!CAPTIONS[id]) id = "intro";
    current = id;
    scenes.forEach(function (el) {
      var on = el.getAttribute("data-scene") === id;
      el.classList.toggle("is-active", on);
      el.hidden = !on;
    });
    btns.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-scene-jump") === id);
    });
    if (caption) caption.textContent = CAPTIONS[id];
    targets.forEach(function (t) {
      t.classList.toggle("console-target-active", t.getAttribute("data-console-scene") === id);
    });
    if (!fromScroll && !reduced) {
      var t = document.querySelector('[data-console-scene="' + id + '"]');
      if (t) t.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      setScene(b.getAttribute("data-scene-jump"), false);
    });
  });

  if ("IntersectionObserver" in window && targets.length) {
    var io = new IntersectionObserver(
      function (entries) {
        var best = null;
        var bestRatio = 0;
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio >= bestRatio) {
            bestRatio = e.intersectionRatio;
            best = e.target;
          }
        });
        if (best) {
          var id = best.getAttribute("data-console-scene");
          if (id && id !== current) setScene(id, true);
        }
      },
      { root: null, rootMargin: "-35% 0px -40% 0px", threshold: [0, 0.15, 0.35, 0.55, 0.75] }
    );
    targets.forEach(function (t) {
      io.observe(t);
    });
  }

  setScene("intro", true);
})();
