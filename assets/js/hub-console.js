(function () {
  var MOBILE_MQ = window.matchMedia("(max-width: 1079px)");
  var CAPTIONS = {
    intro: "Skills — stack & links",
    who: "Who's Andy?",
    lens: "Hub filter",
    projects: "01 — Anthemic projects",
    music: "02 — Music",
    bio: "03 — Music bio",
    reading: "04 — Reading list",
    work: "05 — Work"
  };
  var scenes = document.querySelectorAll(".console-scene");
  var caption = document.getElementById("console-caption");
  var consoleBody = document.getElementById("console-body");
  var btns = document.querySelectorAll("[data-scene-jump]");
  var targets = document.querySelectorAll("[data-console-scene]");
  var current = "who";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scrollSyncLocked = false;
  var scrollSyncLockTimer = null;
  var mobileToggle = document.getElementById("console-mobile-toggle");
  var typedScenes = {};
  var typeRunId = 0;
  var CHAR_MS = 20;
  var LINE_PAUSE_MS = 100;

  scenes.forEach(function (el) {
    var code = el.querySelector("code");
    if (code) el._consoleSource = code.innerHTML.trim();
  });

  function scrollConsoleToBottom() {
    if (!consoleBody) return;
    consoleBody.scrollTop = consoleBody.scrollHeight;
  }

  function splitSceneLines(html) {
    return html.split("\n").map(function (line) {
      return line.replace(/\s+$/, "");
    }).filter(Boolean);
  }

  function linePlainText(lineHtml) {
    var tmp = document.createElement("div");
    tmp.innerHTML = lineHtml;
    return tmp.textContent || "";
  }

  function cancelTypewriter() {
    typeRunId += 1;
  }

  function restoreSceneCode(sceneEl) {
    var code = sceneEl && sceneEl.querySelector("code");
    if (code && sceneEl._consoleSource) {
      code.innerHTML = sceneEl._consoleSource;
      code.classList.remove("is-typing");
    }
  }

  function ensureCursor(code) {
    var cur = code.querySelector(".console-cursor");
    if (!cur) {
      cur = document.createElement("span");
      cur.className = "console-cursor";
      cur.setAttribute("aria-hidden", "true");
      code.appendChild(cur);
    } else {
      code.appendChild(cur);
    }
    return cur;
  }

  function playTypewriter(sceneEl, sceneId) {
    var code = sceneEl.querySelector("code");
    if (!code || !sceneEl._consoleSource) return;

    if (reduced || typedScenes[sceneId]) {
      code.innerHTML = sceneEl._consoleSource;
      code.classList.remove("is-typing");
      return;
    }

    var runId = typeRunId;
    var lines = splitSceneLines(sceneEl._consoleSource);
    var lineIndex = 0;

    code.innerHTML = "";
    code.classList.add("is-typing");
    if (consoleBody) consoleBody.scrollTop = 0;

    function finish() {
      if (runId !== typeRunId) return;
      code.classList.remove("is-typing");
      typedScenes[sceneId] = true;
      ensureCursor(code);
    }

    function typeLine() {
      if (runId !== typeRunId) return;
      if (lineIndex >= lines.length) {
        finish();
        return;
      }

      var lineHtml = lines[lineIndex];
      var plain = linePlainText(lineHtml);
      var lineEl = document.createElement("span");
      lineEl.className = "console-line";
      code.appendChild(lineEl);
      if (lineIndex > 0) code.insertBefore(document.createTextNode("\n"), lineEl);

      var charAt = 0;
      lineIndex += 1;

      function typeChar() {
        if (runId !== typeRunId) return;
        charAt += 1;
        lineEl.textContent = plain.slice(0, charAt);
        ensureCursor(code);
        scrollConsoleToBottom();
        if (charAt < plain.length) {
          window.setTimeout(typeChar, CHAR_MS);
        } else {
          lineEl.innerHTML = lineHtml;
          ensureCursor(code);
          scrollConsoleToBottom();
          window.setTimeout(typeLine, LINE_PAUSE_MS);
        }
      }

      if (!plain.length) {
        lineEl.innerHTML = lineHtml;
        scrollConsoleToBottom();
        window.setTimeout(typeLine, LINE_PAUSE_MS);
      } else {
        typeChar();
      }
    }

    typeLine();
  }

  function isMobile() {
    return MOBILE_MQ.matches;
  }

  function scrollToSceneTarget(el) {
    if (!el) return;
    if (typeof window.hubResolveScrollAnchor === "function" && typeof window.hubScrollToAnchor === "function") {
      window.hubScrollToAnchor(window.hubResolveScrollAnchor(el));
      return;
    }
    var anchor =
      el.querySelector(":scope > .section-heading, :scope > h2.section-heading, :scope > .hub-who-heading, :scope > .hub-skills-heading") ||
      el;
    var offset = typeof window.hubScrollMarginTopPx === "function"
      ? window.hubScrollMarginTopPx()
      : 32;
    var top = anchor.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduced ? "auto" : "smooth"
    });
  }

  function syncMobileToggle() {
    if (!mobileToggle) return;
    var collapsed = document.body.classList.contains("console-mobile-collapsed");
    mobileToggle.textContent = collapsed ? "Expand" : "Collapse";
    mobileToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    window.dispatchEvent(new CustomEvent("hub-console-layout-change"));
  }

  if (mobileToggle) {
    mobileToggle.addEventListener("click", function () {
      document.body.classList.toggle("console-mobile-collapsed");
      syncMobileToggle();
    });
    syncMobileToggle();
  }

  function lockScrollSync(ms) {
    scrollSyncLocked = true;
    if (scrollSyncLockTimer) window.clearTimeout(scrollSyncLockTimer);
    scrollSyncLockTimer = window.setTimeout(function () {
      scrollSyncLocked = false;
    }, ms || 1200);
  }

  function setScene(id, fromScroll) {
    if (!CAPTIONS[id]) id = "intro";
    cancelTypewriter();
    current = id;
    var activeScene = null;
    scenes.forEach(function (el) {
      var on = el.getAttribute("data-scene") === id;
      var sid = el.getAttribute("data-scene");
      el.classList.toggle("is-active", on);
      el.hidden = !on;
      if (!on && !typedScenes[sid]) restoreSceneCode(el);
      if (on) activeScene = el;
    });
    btns.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-scene-jump") === id);
    });
    if (caption) caption.textContent = CAPTIONS[id];
    targets.forEach(function (t) {
      t.classList.toggle("console-target-active", t.getAttribute("data-console-scene") === id);
    });
    if (!fromScroll) {
      lockScrollSync(reduced ? 200 : 1400);
      scrollToSceneTarget(document.querySelector('[data-console-scene="' + id + '"]'));
    }
    if (typeof window.syncHubSiteNavActive === "function") {
      window.syncHubSiteNavActive(id);
    }
    if (activeScene) playTypewriter(activeScene, id);
  }

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      setScene(b.getAttribute("data-scene-jump"), false);
    });
  });

  var io = null;
  function ioRootMargin() {
    return isMobile() ? "-22% 0px -30% 0px" : "-35% 0px -40% 0px";
  }
  function bindScrollSync() {
    if (!("IntersectionObserver" in window) || !targets.length) return;
    if (io) io.disconnect();
    io = new IntersectionObserver(
      function (entries) {
        if (scrollSyncLocked) return;
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
      if (t.getAttribute("data-console-scene") === "lens") return;
      io.observe(t);
    });
  }
  bindScrollSync();
  if (typeof MOBILE_MQ.addEventListener === "function") {
    MOBILE_MQ.addEventListener("change", bindScrollSync);
  }

  window.hubSetScene = function (id, fromScroll) {
    setScene(id, !!fromScroll);
  };

  var cliForm = document.getElementById("console-cli");
  var cliInput = document.getElementById("console-cli-input");
  var cliOut = document.getElementById("console-cli-out");
  var cliHost = document.getElementById("split-rail-host");
  var consoleChrome = document.querySelector(".console-chrome");

  function setCommandMode(on) {
    if (cliForm) cliForm.classList.toggle("is-command-mode", on);
    if (cliHost) cliHost.classList.toggle("is-cli-command-mode", on);
  }

  function syncCommandMode() {
    if (!cliInput) return;
    setCommandMode(document.activeElement === cliInput);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  function showCliOut(text) {
    if (!cliOut) return;
    if (!text) {
      cliOut.textContent = "";
      cliOut.hidden = true;
      return;
    }
    cliOut.textContent = text;
    cliOut.hidden = false;
  }

  function focusConsoleCli() {
    if (!cliInput) return;
    setCommandMode(true);
    cliInput.focus();
    cliInput.select();
  }

  function exitCommandMode() {
    if (!cliInput) return;
    cliInput.blur();
    showCliOut("");
    setCommandMode(false);
  }

  function runConsoleCommand(line) {
    var raw = String(line || "").trim();
    if (!raw) return;
    var lower = raw.toLowerCase();
    var parts = lower.split(/\s+/);

    if (lower === "help" || lower === "cinnamon help" || lower === "cinnamon --help") {
      showCliOut("cinnamon find <topic> — music, projects, work, reading, about, skills, filter · cinnamon wag");
      return;
    }

    if (parts[0] === "cinnamon" && parts[1] === "wag") {
      if (typeof window.cinnamonWag === "function") window.cinnamonWag();
      showCliOut("→ tail wag engaged.");
      return;
    }

    if (parts[0] === "cinnamon" && parts[1] === "find" && parts.length > 2) {
      var target = raw.slice(raw.toLowerCase().indexOf("find") + 4).trim();
      if (typeof window.cinnamonFind === "function" && window.cinnamonFind(target)) {
        showCliOut("→ Cinnamon is on it.");
      } else {
        showCliOut("cinnamon: unknown scent: " + target);
      }
      return;
    }

    if (lower === "qa status cinnamon") {
      if (typeof window.cinnamonFind === "function") window.cinnamonFind("about");
      showCliOut("✓ morale: high");
      return;
    }

    showCliOut("command not found: " + raw);
  }

  if (cliForm && cliInput) {
    cliForm.addEventListener("submit", function (e) {
      e.preventDefault();
      runConsoleCommand(cliInput.value);
      cliInput.value = "";
    });
    cliInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        exitCommandMode();
      }
    });
    cliInput.addEventListener("blur", function () {
      window.setTimeout(syncCommandMode, 0);
    });
  }

  if (consoleChrome) {
    consoleChrome.addEventListener("click", function (e) {
      if (e.target.closest(".console-scene-btn, .console-mobile-toggle, .console-cli-input")) return;
      if (e.target.closest(".console-titlebar, .console-caption")) focusConsoleCli();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(document.activeElement)) return;
    if (e.key !== "`" && e.key !== "/") return;
    if (!document.getElementById("workshop-console")) return;
    e.preventDefault();
    focusConsoleCli();
  });

  setScene("who", true);
})();
