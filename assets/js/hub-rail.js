(function () {
  var DESKTOP_MQ = window.matchMedia("(min-width: 1080px)");
  var host = document.getElementById("split-rail-host");
  var rail = document.getElementById("hub-intro-dock");
  var sentinel = document.getElementById("split-rail-sentinel");
  var spacer = document.getElementById("split-rail-spacer");
  var guidePanel = document.getElementById("hub-guide-panel");
  var cliPanel = document.getElementById("hub-cli-panel");
  var toolbar = document.querySelector(".hub-intro-toolbar");
  var openGuide = document.getElementById("open-hub-guide");
  var openCli = document.getElementById("open-hub-cli");
  var closeGuide = document.getElementById("close-hub-guide");
  var closeCli = document.getElementById("close-hub-cli");
  var expandBtn = document.getElementById("split-rail-expand");
  var shell = document.querySelector(".split-shell");
  var STORAGE_GUIDE = "hub-rail-guide";
  var STORAGE_CLI = "hub-rail-cli";

  if (!host || !rail || !sentinel) return;

  function isDesktop() {
    return DESKTOP_MQ.matches;
  }

  function readVisible(key, defaultOn) {
    try {
      var v = window.localStorage.getItem(key);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) { /* ignore */ }
    return defaultOn;
  }

  function writeVisible(key, on) {
    try {
      window.localStorage.setItem(key, on ? "1" : "0");
    } catch (e) { /* ignore */ }
  }

  function syncPanelControls(guideOn, cliOn) {
    if (guidePanel) guidePanel.hidden = !guideOn;
    if (cliPanel) cliPanel.hidden = !cliOn;
    if (openGuide) openGuide.hidden = guideOn;
    if (openCli) openCli.hidden = cliOn;
    if (closeGuide) closeGuide.hidden = !guideOn;
    if (closeCli) closeCli.hidden = !cliOn;
    if (openGuide) openGuide.setAttribute("aria-expanded", guideOn ? "true" : "false");
    if (openCli) openCli.setAttribute("aria-expanded", cliOn ? "true" : "false");
    if (closeGuide) closeGuide.setAttribute("aria-expanded", guideOn ? "true" : "false");
    if (closeCli) closeCli.setAttribute("aria-expanded", cliOn ? "true" : "false");
  }

  function dockTopOffsetPx() {
    var offset = 0;
    if (expandBtn && !expandBtn.hidden) {
      offset = Math.max(36, expandBtn.offsetHeight + 12);
    } else if (toolbar && toolbar.offsetHeight > 0) {
      offset = Math.max(0, toolbar.offsetHeight + 8);
    }
    return offset;
  }

  function syncMargins() {
    if (!shell || !isDesktop()) return;
    var rect = shell.getBoundingClientRect();
    document.documentElement.style.setProperty(
      "--hub-margin-left",
      Math.max(16, rect.left) + "px"
    );
    document.documentElement.style.setProperty(
      "--hub-margin-right",
      Math.max(16, window.innerWidth - rect.right) + "px"
    );
    document.documentElement.style.setProperty(
      "--hub-intro-toolbar-offset",
      dockTopOffsetPx() + "px"
    );
  }

  function applyPanelVisibility() {
    var guideOn = readVisible(STORAGE_GUIDE, true);
    var cliOn = readVisible(STORAGE_CLI, true);
    host.classList.toggle("is-guide-off", !guideOn);
    host.classList.toggle("is-cli-off", !cliOn);
    host.classList.toggle("has-open-panels", guideOn || cliOn);
    syncPanelControls(guideOn, cliOn);
    if (host.classList.contains("is-docked") && (guideOn || cliOn)) {
      host.classList.add("is-docked-expanded");
    }
    syncExpandedUi();
    syncMargins();
    syncSpacer();
  }

  function railBlockHeight() {
    if (!host.classList.contains("is-docked") || !isDesktop()) return 0;
    var topPad = dockTopOffsetPx() + 20;
    var h = topPad;
    if (!host.classList.contains("is-guide-off") && guidePanel) {
      h = Math.max(h, topPad + guidePanel.offsetHeight);
    }
    if (!host.classList.contains("is-cli-off") && cliPanel) {
      h = Math.max(h, topPad + cliPanel.offsetHeight);
    }
    if (host.classList.contains("is-guide-off") && openGuide) {
      h = Math.max(h, topPad + openGuide.offsetHeight);
    }
    if (host.classList.contains("is-cli-off") && openCli) {
      h = Math.max(h, topPad + openCli.offsetHeight);
    }
    return h;
  }

  function syncSpacer() {
    if (!spacer) return;
    if (!host.classList.contains("is-docked") || !isDesktop()) {
      spacer.style.height = "0px";
      return;
    }
    spacer.style.height = railBlockHeight() + "px";
  }

  function syncExpandedUi() {
    var expanded = host.classList.contains("is-docked-expanded");
    if (expandBtn) {
      expandBtn.hidden = !host.classList.contains("is-docked");
      expandBtn.setAttribute("aria-pressed", expanded ? "true" : "false");
      expandBtn.textContent = expanded ? "Minimise" : "Expand";
    }
  }

  function setDocked(docked) {
    var on = docked && isDesktop();
    host.classList.toggle("is-docked", on);
    if (!on) host.classList.remove("is-docked-expanded");
    syncExpandedUi();
    syncMargins();
    syncSpacer();
    window.dispatchEvent(new CustomEvent("hub-console-layout-change"));
  }

  function bindDockObserver() {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          setDocked(!entry.isIntersecting);
        });
      },
      { root: null, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(sentinel);
  }

  function bindExpand() {
    if (!expandBtn) return;
    expandBtn.addEventListener("click", function () {
      host.classList.toggle("is-docked-expanded");
      syncExpandedUi();
      syncSpacer();
      syncMargins();
    });
    document.addEventListener("click", function (e) {
      if (!host.classList.contains("is-docked") || !host.classList.contains("is-docked-expanded")) return;
      if (rail.contains(e.target)) return;
      host.classList.remove("is-docked-expanded");
      syncExpandedUi();
      syncSpacer();
      syncMargins();
    });
  }

  function bindToggles() {
    if (closeGuide) {
      closeGuide.addEventListener("click", function () {
        writeVisible(STORAGE_GUIDE, false);
        applyPanelVisibility();
      });
    }
    if (closeCli) {
      closeCli.addEventListener("click", function () {
        writeVisible(STORAGE_CLI, false);
        applyPanelVisibility();
      });
    }
    if (openGuide) {
      openGuide.addEventListener("click", function () {
        writeVisible(STORAGE_GUIDE, true);
        applyPanelVisibility();
      });
    }
    if (openCli) {
      openCli.addEventListener("click", function () {
        writeVisible(STORAGE_CLI, true);
        applyPanelVisibility();
      });
    }
  }

  function onLayoutChange() {
    if (!isDesktop()) {
      host.classList.remove("is-docked");
      host.classList.remove("is-docked-expanded");
      if (spacer) spacer.style.height = "0px";
      syncExpandedUi();
      return;
    }
    syncMargins();
    syncSpacer();
  }

  applyPanelVisibility();
  bindDockObserver();
  bindExpand();
  bindToggles();

  window.addEventListener("resize", onLayoutChange, { passive: true });
  window.addEventListener("scroll", syncSpacer, { passive: true });
  if (typeof DESKTOP_MQ.addEventListener === "function") {
    DESKTOP_MQ.addEventListener("change", onLayoutChange);
  } else if (typeof DESKTOP_MQ.addListener === "function") {
    DESKTOP_MQ.addListener(onLayoutChange);
  }

  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(function () {
      syncMargins();
      syncSpacer();
    });
    ro.observe(rail);
    if (guidePanel) ro.observe(guidePanel);
    if (cliPanel) ro.observe(cliPanel);
    if (toolbar) ro.observe(toolbar);
    if (openGuide) ro.observe(openGuide);
    if (openCli) ro.observe(openCli);
    if (expandBtn) ro.observe(expandBtn);
  }
})();
