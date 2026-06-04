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

  /* Orbit + target match hotspot data-position in brain/index.html */
  var zoneCamera = {
    gigs: { orbit: "40deg 68deg 88%", target: "0.28m 0.08m -0.14m" },
    work: { orbit: "185deg 62deg 94%", target: "0.04m 0.2m -0.2m" },
    reading: { orbit: "-42deg 64deg 90%", target: "-0.24m 0.1m -0.1m" },
    writing: { orbit: "175deg 72deg 92%", target: "0.1m -0.14m -0.3m" }
  };

  function syncZoneCameraFromHotspots() {
    mv.querySelectorAll("button.brain-hotspot[data-zone][data-position]").forEach(function (btn) {
      var zone = btn.getAttribute("data-zone");
      var pos = btn.getAttribute("data-position");
      if (!zone || !pos || !zoneCamera[zone]) return;
      var p = pos.trim().split(/\s+/);
      if (p.length < 3) return;
      zoneCamera[zone].target = p[0] + "m " + p[1] + "m " + p[2] + "m";
    });
  }

  var lockedCameraZone = null;

  function focusZoneCamera(zone) {
    var cam = zoneCamera[zone];
    if (!cam) return;
    lockedCameraZone = zone;
    try {
      mv.autoRotate = false;
      mv.removeAttribute("auto-rotate");
    } catch (e0) {}
    try {
      if (cam.target) mv.cameraTarget = cam.target;
      if (cam.orbit) mv.cameraOrbit = cam.orbit;
    } catch (e1) {}
  }

  var zoneMaterialNames = {
    gigs: "zone-gigs",
    work: "zone-work",
    reading: "zone-reading",
    writing: "zone-writing"
  };

  var zoneEmissive = {
    gigs: [0.1, 0.07, 0.01],
    work: [0.03, 0.05, 0.12],
    reading: [0.02, 0.08, 0.06],
    writing: [0.1, 0.03, 0.07]
  };
  var zoneEmissivePeak = {
    gigs: [0.42, 0.3, 0.06],
    work: [0.14, 0.22, 0.45],
    reading: [0.1, 0.32, 0.22],
    writing: [0.38, 0.14, 0.28]
  };
  var zoneColorPeak = {
    gigs: [1, 0.88, 0.22, 1],
    work: [0.45, 0.68, 1, 1],
    reading: [0.22, 0.92, 0.72, 1],
    writing: [0.98, 0.5, 0.82, 1]
  };
  var zoneBaseColors = {};
  var zoneMaterials = {};
  var activePulseZone = null;
  var pulseRaf = null;
  var pulseStart = 0;
  var reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function lerp4(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      a[3] != null && b[3] != null ? a[3] + (b[3] - a[3]) * t : 1
    ];
  }

  function pulseWave(ts) {
    if (!pulseStart) pulseStart = ts;
    var phase = (ts - pulseStart) * 0.0035;
    var s = (Math.sin(phase) + 1) * 0.5;
    return s * s * (3 - 2 * s);
  }

  function requestModelRender() {
    try {
      if (typeof mv.requestUpdate === "function") mv.requestUpdate();
    } catch (e) {}
  }

  function zoneKeyForMaterial(name) {
    for (var z in zoneMaterialNames) {
      if (zoneMaterialNames[z] === name) return z;
    }
    return null;
  }

  function restoreBaseColor(material) {
    var base = zoneBaseColors[material.name];
    if (!base || !material.pbrMetallicRoughness) return;
    try {
      material.pbrMetallicRoughness.setBaseColorFactor(base.slice());
    } catch (e) {}
  }

  function dimColor(base, factor) {
    return [
      base[0] * factor,
      base[1] * factor,
      base[2] * factor,
      base[3] != null ? base[3] : 1
    ];
  }

  function highlightBrainZones(activeZone, skipActiveMaterial) {
    var model = mv.model;
    if (!model || !model.materials) return;
    for (var i = 0; i < model.materials.length; i++) {
      var material = model.materials[i];
      if (!material || !material.pbrMetallicRoughness) continue;
      var name = material.name || "";
      var zoneKey = zoneKeyForMaterial(name);
      if (skipActiveMaterial && zoneKey === activeZone) continue;
      var isActive = zoneKey && zoneKey === activeZone;
      var isBase = name === "zone-base";
      var base = zoneBaseColors[name];
      var pbr = material.pbrMetallicRoughness;
      try {
        if (base && typeof pbr.setBaseColorFactor === "function") {
          if (isActive) {
            restoreBaseColor(material);
          } else if (zoneKey) {
            pbr.setBaseColorFactor(dimColor(base, 0.52));
          } else {
            restoreBaseColor(material);
          }
        }
        if (typeof material.setEmissiveFactor === "function") {
          if (isActive && zoneKey && zoneEmissive[zoneKey]) {
            material.setEmissiveFactor(zoneEmissive[zoneKey].slice());
          } else if (zoneKey && zoneEmissive[zoneKey]) {
            material.setEmissiveFactor([
              zoneEmissive[zoneKey][0] * 0.35,
              zoneEmissive[zoneKey][1] * 0.35,
              zoneEmissive[zoneKey][2] * 0.35
            ]);
          } else if (isBase) {
            material.setEmissiveFactor([0.015, 0.015, 0.02]);
          } else {
            material.setEmissiveFactor([0, 0, 0]);
          }
        }
        if (typeof pbr.setRoughnessFactor === "function") {
          pbr.setRoughnessFactor(isActive ? 0.36 : isBase ? 0.6 : 0.48);
        }
      } catch (e) {}
    }
    requestModelRender();
  }

  function getZoneMaterial(zoneKey) {
    return zoneMaterials[zoneKey] || null;
  }

  function stopZonePulse() {
    if (pulseRaf) {
      cancelAnimationFrame(pulseRaf);
      pulseRaf = null;
    }
    pulseStart = 0;
  }

  function applyPulseFrame(ts) {
    var zone = activePulseZone;
    if (!zone) return;
    var material = getZoneMaterial(zone);
    if (!material || !material.pbrMetallicRoughness) return;
    var wave = pulseWave(ts);
    var base = zoneBaseColors[material.name];
    var peak = zoneColorPeak[zone];
    var pbr = material.pbrMetallicRoughness;
    try {
      if (base && peak && typeof pbr.setBaseColorFactor === "function") {
        pbr.setBaseColorFactor(lerp4(base, peak, wave));
      }
      var emLo = zoneEmissive[zone];
      var emHi = zoneEmissivePeak[zone];
      if (emLo && emHi && typeof material.setEmissiveFactor === "function") {
        var em = lerp4(
          [emLo[0], emLo[1], emLo[2], 1],
          [emHi[0], emHi[1], emHi[2], 1],
          wave
        );
        material.setEmissiveFactor([em[0], em[1], em[2]]);
      }
      if (typeof pbr.setRoughnessFactor === "function") {
        pbr.setRoughnessFactor(0.22 + (1 - wave) * 0.2);
      }
    } catch (e) {}
    requestModelRender();
  }

  function pulseZoneFrame(ts) {
    if (!activePulseZone) return;
    applyPulseFrame(ts);
    pulseRaf = requestAnimationFrame(pulseZoneFrame);
  }

  function startZonePulse(zone) {
    if (!zone) return;
    activePulseZone = zone;
    if (!zoneMaterials[zone]) return;
    stopZonePulse();
    activePulseZone = zone;
    pulseStart = 0;
    highlightBrainZones(zone, true);
    if (reduceMotion) {
      applyPulseFrame(performance.now());
      highlightBrainZones(zone, false);
      applyPulseFrame(performance.now());
      return;
    }
    applyPulseFrame(performance.now());
    pulseRaf = requestAnimationFrame(pulseZoneFrame);
  }

  function setActive(zone) {
    document.querySelectorAll(".zone").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-zone") === zone);
    });
    focusZoneCamera(zone);
    activePulseZone = zone;
    startZonePulse(zone);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopZonePulse();
    } else if (activePulseZone) {
      startZonePulse(activePulseZone);
    }
  });

  mv.addEventListener("scene-graph-ready", function () {
    try {
      tuneBrainMaterials();
    } catch (e) {}
    if (activePulseZone) startZonePulse(activePulseZone);
  });

  ["gigs", "work", "reading", "writing"].forEach(function (zone) {
    var z = document.getElementById("zone-" + zone);
    if (z) {
      z.addEventListener("click", function (e) {
        if (e.target.closest("a")) return;
        setActive(zone);
      });
    }
  });

  /** Zone-tinted GLB (zone-* materials); keep PBR readable under exposure. */
  function tuneBrainMaterials() {
    var model = mv.model;
    if (!model || !model.materials || !model.materials.length) return;
    var hasZones = false;
    for (var i = 0; i < model.materials.length; i++) {
      var n = model.materials[i].name || "";
      if (n.indexOf("zone-") === 0) {
        hasZones = true;
        break;
      }
    }
    if (!hasZones) return;
    for (var j = 0; j < model.materials.length; j++) {
      var material = model.materials[j];
      if (!material || !material.pbrMetallicRoughness) continue;
      var pbr = material.pbrMetallicRoughness;
      var c = pbr.baseColorFactor;
      if (c && material.name) {
        zoneBaseColors[material.name] = [
          c[0] != null ? c[0] : 1,
          c[1] != null ? c[1] : 1,
          c[2] != null ? c[2] : 1,
          c[3] != null ? c[3] : 1
        ];
        var zk = zoneKeyForMaterial(material.name);
        if (zk) zoneMaterials[zk] = material;
      }
      try {
        if (typeof material.setMetallicFactor === "function") {
          material.setMetallicFactor(0);
        }
      } catch (e) {}
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
      tuneBrainMaterials();
    } catch (e1) {}
    syncZoneCameraFromHotspots();
    applyInitialZone();
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

  function zoneFromHash() {
    var h = (location.hash || "").replace(/^#/, "");
    if (h.indexOf("zone-") === 0) return h.slice(5);
    return null;
  }

  function applyInitialZone() {
    var z = zoneFromHash();
    if (z && zoneCamera[z]) {
      setActive(z);
      return;
    }
    setActive("work");
  }

  mv.addEventListener("load", onBrainModelReady);
  window.addEventListener("hashchange", function () {
    var z = zoneFromHash();
    if (z && zoneCamera[z] && z !== lockedCameraZone) setActive(z);
  });

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
