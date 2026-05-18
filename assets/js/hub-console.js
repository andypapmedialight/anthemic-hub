(function () {
  var MOBILE_MQ = window.matchMedia("(max-width: 1079px)");
  var CAPTIONS = {
    intro: "Skills — stack & links",
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
  var current = "who";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mobileToggle = document.getElementById("console-mobile-toggle");

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function syncMobileToggle() {
    if (!mobileToggle) return;
    var collapsed = document.body.classList.contains("console-mobile-collapsed");
    mobileToggle.textContent = collapsed ? "Expand" : "Collapse";
    mobileToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  if (mobileToggle) {
    mobileToggle.addEventListener("click", function () {
      document.body.classList.toggle("console-mobile-collapsed");
      syncMobileToggle();
    });
    syncMobileToggle();
  }

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
      if (t) {
        t.scrollIntoView({
          behavior: "smooth",
          block: isMobile() ? "start" : "center"
        });
      }
    }
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      setScene(b.getAttribute("data-scene-jump"), false);
    });
  });

  var io = null;
  function ioRootMargin() {
    return isMobile() ? "-18% 0px -52% 0px" : "-35% 0px -40% 0px";
  }
  function bindScrollSync() {
    if (!("IntersectionObserver" in window) || !targets.length) return;
    if (io) io.disconnect();
    io = new IntersectionObserver(
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
      {
        root: null,
        rootMargin: ioRootMargin(),
        threshold: [0, 0.15, 0.35, 0.55, 0.75]
      }
    );
    targets.forEach(function (t) {
      io.observe(t);
    });
  }
  bindScrollSync();
  if (typeof MOBILE_MQ.addEventListener === "function") {
    MOBILE_MQ.addEventListener("change", bindScrollSync);
  }

  setScene("who", true);
})();
