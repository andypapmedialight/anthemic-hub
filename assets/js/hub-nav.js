(function () {
  var MOBILE_MQ = window.matchMedia("(max-width: 1079px)");
  var toggle = document.getElementById("hub-nav-toggle");
  var list = document.getElementById("hub-site-nav-list");
  if (!list) return;

  function closeNav() {
    document.body.classList.remove("hub-nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("hub-nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      var label = toggle.querySelector(".hub-nav-toggle-label");
      if (label) label.textContent = open ? "Close" : "Sections";
    });
  }

  function scrollNavLink(link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return;
    var target = document.querySelector(href);
    if (!target) return;
    var anchor = typeof window.hubResolveScrollAnchor === "function"
      ? window.hubResolveScrollAnchor(target)
      : target;
    if (typeof window.hubScrollToAnchor === "function") {
      window.hubScrollToAnchor(anchor);
      return;
    }
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  list.addEventListener("click", function (e) {
    var link = e.target.closest("a[data-scene-jump]");
    if (!link) return;
    e.preventDefault();
    if (MOBILE_MQ.matches) closeNav();
    var id = link.getAttribute("data-scene-jump");
    var consoleBtn = document.querySelector('.console-scene-btn[data-scene-jump="' + id + '"]');
    if (consoleBtn) {
      requestAnimationFrame(function () {
        consoleBtn.click();
      });
    } else {
      requestAnimationFrame(function () {
        scrollNavLink(link);
      });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });

  if (typeof MOBILE_MQ.addEventListener === "function") {
    MOBILE_MQ.addEventListener("change", function () {
      if (!MOBILE_MQ.matches) closeNav();
    });
  }

  function syncNavActive(sceneId) {
    list.querySelectorAll("a[data-scene-jump]").forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-scene-jump") === sceneId);
    });
  }

  window.syncHubSiteNavActive = syncNavActive;

  document.addEventListener("DOMContentLoaded", function () {
    var active = document.querySelector(".console-scene-btn.is-active");
    if (active) syncNavActive(active.getAttribute("data-scene-jump"));
  });
})();
