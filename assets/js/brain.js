(function () {
  var key = "anthemic-hub-theme";
  var root = document.documentElement;
  function syncThemeButtons() {
    var t = root.getAttribute("data-theme") || "dark";
    var d = document.getElementById("theme-dark");
    var l = document.getElementById("theme-light");
    if (d) d.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
    if (l) l.setAttribute("aria-pressed", t === "light" ? "true" : "false");
  }
  function setTheme(theme) {
    if (theme !== "light" && theme !== "dark") return;
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem(key, theme); } catch (e) {}
    syncThemeButtons();
  }
  var td = document.getElementById("theme-dark");
  var tl = document.getElementById("theme-light");
  if (td) td.addEventListener("click", function () { setTheme("dark"); });
  if (tl) tl.addEventListener("click", function () { setTheme("light"); });
  syncThemeButtons();
})();

(function () {
  var mv = document.getElementById("brain");
  if (!mv) return;

  var errEl = document.getElementById("brain-load-error");
  var loadingEl = document.getElementById("brain-loading");
  var progressBar = document.getElementById("brain-loading-progress");
  var pctEl = document.getElementById("brain-loading-pct");
  var loadingDismissed = false;
  var modelReadyHandled = false;
  var stuckTimer = null;
  var pollTimer = null;

  function clearStuckTimer() {
    if (stuckTimer) {
      clearTimeout(stuckTimer);
      stuckTimer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function dismissLoading() {
    if (loadingDismissed) return;
    loadingDismissed = true;
    clearStuckTimer();
    if (loadingEl) {
      loadingEl.classList.add("is-done");
      loadingEl.setAttribute("aria-busy", "false");
      loadingEl.setAttribute("aria-label", "3D model ready");
    }
    var wrap = document.querySelector(".viewer-wrap");
    if (wrap) wrap.setAttribute("aria-busy", "false");
  }

  function showLoadError(msg) {
    dismissLoading();
    if (!errEl) return;
    errEl.hidden = false;
    errEl.textContent = msg;
  }

  mv.addEventListener("progress", function (e) {
    if (!progressBar || !pctEl) return;
    var d = e.detail;
    var p = d && typeof d.totalProgress === "number" ? d.totalProgress : 0;
    p = Math.max(0, Math.min(1, p));
    progressBar.style.width = Math.round(p * 100) + "%";
    if (p < 0.02) {
      pctEl.textContent = "Downloading mesh…";
    } else if (p < 0.98) {
      pctEl.textContent = Math.round(p * 100) + "%";
    } else {
      pctEl.textContent = "Almost ready…";
    }
  });

  mv.addEventListener("error", function () {
    showLoadError(
      "The GLB could not be loaded. Use an HTTP server with the site root at the anthemic-hub folder (not only the brain folder), then open /brain/ — for example: cd anthemic-hub && python3 -m http.server 8765"
    );
  });

  var orbits = {
    gigs: "35deg 65deg 88%",
    work: "20deg 55deg 95%",
    reading: "-40deg 60deg 90%",
    writing: "15deg 70deg 92%"
  };

  function setActive(zone) {
    document.querySelectorAll(".zone").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-zone") === zone);
    });
  }

  ["gigs", "work", "reading", "writing"].forEach(function (zone) {
    var z = document.getElementById("zone-" + zone);
    if (z) {
      z.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        setActive(zone);
        if (orbits[zone]) mv.cameraOrbit = orbits[zone];
      });
    }
  });

  /**
   * This GLB reads as a flat dark mass under normal PBR lighting because
   * base colours / roughness are authored very dark. model-viewer cannot
   * invent surface detail, but lifting materials + exposure makes folds
   * and lobes readable in the browser.
   */
  function liftMaterialsForClarity() {
    var model = mv.model;
    if (!model || !model.materials || !model.materials.length) return;
    var mul = 3.4;
    var add = 0.24;
    for (var i = 0; i < model.materials.length; i++) {
      var material = model.materials[i];
      if (!material || !material.pbrMetallicRoughness) continue;
      var pbr = material.pbrMetallicRoughness;
      var c = null;
      var r = 0;
      var g = 0;
      var b = 0;
      try {
        c = pbr.baseColorFactor;
        if (c && (typeof c.length === "number" || Array.isArray(c))) {
          r = c[0] != null ? c[0] : 0;
          g = c[1] != null ? c[1] : 0;
          b = c[2] != null ? c[2] : 0;
        }
        var avg = (r + g + b) / 3;
        /* Dark tint in the glTF: multiply toward visible greys. */
        if (avg < 0.45) {
          var a = c && c.length > 3 && c[3] != null ? c[3] : 1;
          pbr.setBaseColorFactor([
            Math.min(1, r * mul + add),
            Math.min(1, g * mul + add),
            Math.min(1, b * mul + add),
            a
          ]);
        }
        if (typeof pbr.setRoughnessFactor === "function") {
          var r0 = typeof pbr.roughnessFactor === "number" ? pbr.roughnessFactor : 1;
          /* Already-light materials: do not crush roughness or they clip to white under high exposure. */
          var rough =
            avg >= 0.75 ? Math.max(0.4, Math.min(1, r0 * 0.92)) : Math.max(0.06, Math.min(1, r0 * 0.5));
          pbr.setRoughnessFactor(rough);
        }
        if (typeof pbr.setMetallicFactor === "function") {
          pbr.setMetallicFactor(0);
        }
      } catch (e) {}
      try {
        if (typeof material.setEmissiveFactor === "function") {
          /* Strong emissive on already-bright albedo (e.g. TestBrain) blows the whole mesh to white. */
          var em =
            avg < 0.45 ? [0.06, 0.058, 0.07] : [0, 0, 0];
          material.setEmissiveFactor(em);
        }
      } catch (e2) {}
    }
  }

  /**
   * model-viewer retargets hotspot hits (shadow / 3D DOM), so listeners on
   * <model-viewer> + target.closest() often never see the control. Use
   * capture on document and composedPath() to find the real hotspot node.
   */
  function pathIndexOfBrain(e) {
    var path = typeof e.composedPath === "function" ? e.composedPath() : [e.target];
    for (var i = 0; i < path.length; i++) {
      if (path[i] === mv) return i;
    }
    return -1;
  }

  function zoneFromHotspotEl(el) {
    if (!el || !el.getAttribute) return null;
    var z = el.getAttribute("data-zone");
    if (z) return z;
    var slot = el.getAttribute("slot");
    if (slot && slot.indexOf("hotspot-") === 0) return slot.replace("hotspot-", "");
    return null;
  }

  function findBrainHotspotInComposedPath(e) {
    var path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (!path || !path.length) path = [e.target];
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!el || !el.classList || !el.classList.contains("brain-hotspot")) continue;
      return el;
    }
    return null;
  }

  var lastHotspotActivate = 0;
  function activateHotspotZone(zone) {
    var now = Date.now();
    if (now - lastHotspotActivate < 220) return;
    lastHotspotActivate = now;
    setActive(zone);
    if (orbits[zone]) {
      try {
        mv.cameraOrbit = orbits[zone];
      } catch (err) {}
    }
    var panel = document.getElementById("zone-" + zone);
    if (panel) {
      try {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch (err2) {
        panel.scrollIntoView();
      }
    }
    try {
      history.replaceState(null, "", "#zone-" + zone);
    } catch (err3) {}
  }

  document.addEventListener(
    "click",
    function (e) {
      if (pathIndexOfBrain(e) === -1) return;
      var t = findBrainHotspotInComposedPath(e);
      if (!t) return;
      var zone = zoneFromHotspotEl(t);
      if (!zone) return;
      e.preventDefault();
      activateHotspotZone(zone);
    },
    true
  );

  var hotspotButtonsWired = new WeakSet();
  function wireHotspotButtonsDirect() {
    mv.querySelectorAll("button.brain-hotspot[data-zone]").forEach(function (btn) {
      if (hotspotButtonsWired.has(btn)) return;
      hotspotButtonsWired.add(btn);
      var zone = btn.getAttribute("data-zone");
      if (!zone) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        activateHotspotZone(zone);
      });
    });
  }

  function onBrainModelReady() {
    if (modelReadyHandled) return;
    modelReadyHandled = true;
    dismissLoading();
    try {
      liftMaterialsForClarity();
    } catch (e1) {}
    try {
      mv.cameraOrbit = orbits.work;
    } catch (e2) {}
    wireHotspotButtonsDirect();
    setTimeout(wireHotspotButtonsDirect, 400);
  }

  function tryLoadedFromState() {
    if (modelReadyHandled) return;
    try {
      if (mv.loaded === true) {
        onBrainModelReady();
      }
    } catch (e) {}
  }

  mv.addEventListener("load", onBrainModelReady);

  /* load can fire before this deferred script runs; poll mv.loaded for a short window. */
  tryLoadedFromState();
  [0, 32, 100, 250, 600, 1200, 2500].forEach(function (ms) {
    setTimeout(tryLoadedFromState, ms);
  });
  pollTimer = setInterval(tryLoadedFromState, 400);
  setTimeout(function () {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }, 8000);

  stuckTimer = setTimeout(function () {
    if (!loadingDismissed) {
      showLoadError(
        "The model is taking too long or the 3D viewer did not start. Confirm /assets/TestBrain.glb is deployed, disable strict blockers for ajax.googleapis.com (model-viewer), then refresh."
      );
    }
  }, 45000);

  if (window.customElements && typeof customElements.whenDefined === "function") {
    customElements.whenDefined("model-viewer").then(function () {
      tryLoadedFromState();
    }).catch(function () {});
  }
})();
