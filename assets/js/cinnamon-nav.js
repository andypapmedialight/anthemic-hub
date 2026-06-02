(function () {
  var root = document.getElementById("cinnamon-agent");
  var anchor = document.getElementById("cinnamon-agent-anchor");
  var bubble = document.getElementById("cinnamon-bubble");
  var chipsRoot = document.getElementById("cinnamon-chips");
  var queryInput = document.getElementById("cinnamon-query");
  var findBtn = document.getElementById("cinnamon-find");
  var trailRoot = document.getElementById("cinnamon-trail");
  var spotlightRoot = document.getElementById("cinnamon-spotlight");
  var spotlightBubble = document.getElementById("cinnamon-spotlight-bubble");
  var soundToggle = document.getElementById("cinnamon-sound-toggle");
  if (!root || !bubble || !chipsRoot || !queryInput || !findBtn) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var IDLE_WAG_MS = 4000;
  var idleWagTimer = null;
  var idleWagEndTimer = null;
  var queryHadText = false;
  var soundEnabled = false;
  try {
    soundEnabled = window.localStorage.getItem("cinnamon-sound") === "1";
  } catch (e) {
    soundEnabled = false;
  }
  var validInterests = ["all", "music", "teaching", "creative", "work", "community", "personal"];
  var interestLabels = {
    all: "Everything",
    music: "Music & live performance",
    teaching: "Teaching & learning",
    creative: "Creative tools & maps",
    work: "Work & professional",
    community: "Community & civic tech",
    personal: "Personal & writing"
  };
  var config = null;
  var intents = [];
  var keywordInterests = [];
  var selected = null;
  var finding = false;
  var pulseTimer = null;
  var spotlightSceneId = null;
  var spotlightTimer = null;
  var spotlightWagTimer = null;
  var spotlightTrackRaf = null;
  var spotlightTrackBound = false;

  var DEFAULT_KEYWORD_INTERESTS = [
    { keywords: ["swarm", "civic", "community", "murray", "reporter"], interest: "community" },
    { keywords: ["gig", "gigs", "bass", "band", "bandcamp", "music", "live", "setlist"], interest: "music" },
    { keywords: ["lesson", "lessons", "teaching", "coach", "coaching"], interest: "teaching" },
    { keywords: ["brain", "map", "3d", "atlas", "creative", "macro"], interest: "creative" },
    { keywords: ["writing", "essay", "personal", "quill"], interest: "personal" },
    { keywords: ["hire", "mecca", "work", "job", "deck", "pitch"], interest: "work" },
    { keywords: ["read", "reading", "books", "shelf", "library", "reading list"], interest: "personal" }
  ];

  var DEFAULT_CONFIG = {
    greeting: "I'm Cinnamon - i find stuff. What are you sniffing for?",
    find_label: "Find it",
    found_message_template: "Found it, {section}, NOW WHERE THE SNAX AT?!",
    placeholder: "Sniff for gigs, swarm, reading list…",
    keyword_interests: DEFAULT_KEYWORD_INTERESTS,
    intents: [
      { id: "about", label: "About Andy", scene: "who", keywords: ["about", "andy", "who"], reply: "About Andy. I'll show you." },
      { id: "skills", label: "Skills", scene: "intro", interest: "work", keywords: ["skills", "stack", "tech"], reply: "Skills and links. On it." },
      { id: "filter", label: "Filter hub", scene: "lens", keywords: ["filter", "interest"], reply: "Hub filter — pick what matters." },
      { id: "projects", label: "Projects", scene: "projects", keywords: ["project", "setlist", "brain", "swarm"], reply: "Anthemic projects. This way." },
      { id: "music", label: "Gigs & bass", scene: "music", interest: "music", keywords: ["gig", "bass", "music", "band"], reply: "Music section. Good sticks." },
      { id: "bio", label: "Music bio", scene: "bio", interest: "music", keywords: ["music bio", "bands"], reply: "Music bio — long story, good ears." },
      { id: "reading", label: "Reading", scene: "reading", interest: "personal", keywords: ["read", "books", "reading list"], reply: "Reading list. Smells like ideas." },
      { id: "work", label: "Work & hire", scene: "work", interest: "work", keywords: ["work", "hire", "job", "mecca"], reply: "Work and hire deck. Lead on." }
    ]
  };

  function normaliseKeywordInterests(list) {
    if (!Array.isArray(list)) return DEFAULT_KEYWORD_INTERESTS.slice();
    return list.filter(function (row) {
      return row && row.interest && Array.isArray(row.keywords);
    }).map(function (row) {
      return {
        interest: String(row.interest),
        keywords: row.keywords.map(String)
      };
    });
  }

  function hubJsonUrl() {
    var meta = document.querySelector('meta[name="hub-content-version"]');
    var v = meta && meta.getAttribute("content");
    return v ? "/content/hub.json?v=" + encodeURIComponent(v) : "/content/hub.json";
  }

  function normaliseConfig(raw) {
    var base = DEFAULT_CONFIG;
    if (!raw || typeof raw !== "object") return base;
    var list = Array.isArray(raw.intents) ? raw.intents : base.intents;
    return {
      greeting: raw.greeting || base.greeting,
      find_label: raw.find_label || base.find_label,
      found_message_template: raw.found_message_template || base.found_message_template,
      placeholder: raw.placeholder || base.placeholder,
      keyword_interests: normaliseKeywordInterests(raw.keyword_interests || base.keyword_interests),
      intents: list.filter(function (item) {
        return item && item.scene && item.label;
      }).map(function (item) {
        return {
          id: String(item.id || item.scene),
          label: String(item.label),
          scene: String(item.scene),
          reply: String(item.reply || ("Heading to " + item.label + ".")),
          interest: item.interest ? String(item.interest) : "",
          keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : []
        };
      })
    };
  }

  function setBubble(text) {
    bubble.textContent = text;
  }

  function setFindEnabled(on) {
    findBtn.disabled = !on;
    findBtn.setAttribute("aria-disabled", on ? "false" : "true");
  }

  function clearAnimClasses() {
    root.classList.remove("is-sniffing", "is-finding", "is-wagging");
    if (!finding) root.classList.add("is-idle");
  }

  function updateSoundToggle() {
    if (!soundToggle) return;
    soundToggle.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
    soundToggle.setAttribute("aria-label", soundEnabled ? "Sound on" : "Sound off");
    soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
  }

  function playFindSound() {
    if (!soundEnabled || reduced) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
      osc.onended = function () {
        ctx.close();
      };
    } catch (err) {
      /* optional sound — ignore failures */
    }
  }

  function triggerWag() {
    if (reduced || finding) return;
    if (idleWagTimer) window.clearTimeout(idleWagTimer);
    if (idleWagEndTimer) window.clearTimeout(idleWagEndTimer);
    root.classList.remove("is-idle");
    root.classList.add("is-wagging");
    idleWagEndTimer = window.setTimeout(function () {
      root.classList.remove("is-wagging");
      if (!finding) root.classList.add("is-idle");
      scheduleIdleWag();
    }, 2200);
  }

  function scheduleIdleWag() {
    if (reduced) return;
    if (idleWagTimer) window.clearTimeout(idleWagTimer);
    if (idleWagEndTimer) window.clearTimeout(idleWagEndTimer);
    root.classList.remove("is-wagging");
    idleWagTimer = window.setTimeout(function () {
      if (finding || root.classList.contains("is-sniffing") || root.classList.contains("is-finding")) {
        scheduleIdleWag();
        return;
      }
      triggerWag();
    }, IDLE_WAG_MS);
  }

  function noteActivity() {
    scheduleIdleWag();
  }

  function interestLabel(slug) {
    return interestLabels[slug] || slug;
  }

  function resolveInterest(intent, queryText) {
    if (!intent || intent.scene === "lens" || intent.scene === "who") return null;
    var q = String(queryText || "").trim().toLowerCase();
    var best = null;
    var bestScore = 0;
    keywordInterests.forEach(function (row) {
      if (validInterests.indexOf(row.interest) === -1 || row.interest === "all") return;
      row.keywords.forEach(function (kw) {
        var k = kw.toLowerCase();
        if (!k || q.indexOf(k) === -1) return;
        var score = k.length >= 6 ? 5 : 3;
        if (q === k) score += 2;
        if (score > bestScore) {
          bestScore = score;
          best = row.interest;
        }
      });
    });
    if (best) return best;
    if (intent.interest && validInterests.indexOf(intent.interest) !== -1) {
      return intent.interest;
    }
    return null;
  }

  function previewInterestNote(intent) {
    var interest = resolveInterest(intent, queryInput.value);
    if (!interest) return "";
    return " I'll highlight " + interestLabel(interest) + ".";
  }

  function selectIntent(intent, fromQuery) {
    selected = intent;
    chipsRoot.querySelectorAll(".cinnamon-intent-chip").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-intent-id") === intent.id ? "true" : "false");
    });
    setBubble(intent.reply + previewInterestNote(intent));
    setFindEnabled(true);
    if (!fromQuery && !reduced) {
      root.classList.remove("is-idle");
      root.classList.add("is-sniffing");
      window.setTimeout(clearAnimClasses, 700);
    }
  }

  function matchIntentFromQuery(text) {
    var q = String(text || "").trim().toLowerCase();
    if (!q) return null;
    var best = null;
    var bestScore = 0;
    intents.forEach(function (intent) {
      var score = 0;
      if (intent.scene === q || intent.id === q) score += 6;
      if (intent.label.toLowerCase() === q) score += 6;
      if (intent.label.toLowerCase().indexOf(q) !== -1) score += 4;
      if (q.indexOf(intent.label.toLowerCase()) !== -1) score += 4;
      intent.keywords.forEach(function (kw) {
        var k = kw.toLowerCase();
        if (!k) return;
        if (q === k) score += 5;
        else if (q.indexOf(k) !== -1) score += 3;
        else if (k.indexOf(q) !== -1 && q.length >= 3) score += 2;
      });
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    });
    return bestScore > 0 ? best : null;
  }

  function programmaticFind(targetSlug) {
    if (finding) return false;
    var q = String(targetSlug || "").trim();
    if (!q) return false;
    var match = matchIntentFromQuery(q);
    if (!match) return false;
    queryInput.value = q;
    selectIntent(match, true);
    runFind();
    return true;
  }

  function syncSelectionFromQuery() {
    if (selected) return;
    var match = matchIntentFromQuery(queryInput.value);
    if (match) selectIntent(match, true);
    else setFindEnabled(false);
  }

  function renderChips() {
    chipsRoot.innerHTML = intents.map(function (intent) {
      return (
        '<button type="button" class="cinnamon-intent-chip" data-intent-id="' +
        intent.id +
        '" aria-pressed="false">' +
        intent.label +
        "</button>"
      );
    }).join("");
  }

  function applyConfig(next) {
    config = normaliseConfig(next);
    intents = config.intents;
    keywordInterests = config.keyword_interests;
    selected = null;
    queryInput.value = "";
    queryHadText = false;
    setBubble(config.greeting);
    findBtn.textContent = config.find_label;
    queryInput.placeholder = config.placeholder;
    renderChips();
    setFindEnabled(false);
    root.classList.add("is-idle");
  }

  function sceneTarget(sceneId) {
    return document.querySelector('[data-console-scene="' + sceneId + '"]');
  }

  function sceneHeading(sceneId) {
    var target = sceneTarget(sceneId);
    if (!target) return null;
    return (
      target.querySelector(":scope > .section-heading, :scope > .hub-who-heading, :scope > .hub-skills-heading, :scope > .interest-bar-head") ||
      target
    );
  }

  function focusSceneHeading(sceneId) {
    var heading = sceneHeading(sceneId);
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  function pulseTarget(sceneId) {
    var target = sceneTarget(sceneId);
    if (!target) return;
    if (pulseTimer) window.clearTimeout(pulseTimer);
    target.classList.remove("cinnamon-target-pulse");
    void target.offsetWidth;
    target.classList.add("cinnamon-target-pulse");
    pulseTimer = window.setTimeout(function () {
      target.classList.remove("cinnamon-target-pulse");
    }, 1200);
  }

  function applyHubInterest(interest) {
    if (!interest || typeof window.hubSetInterest !== "function") return;
    window.hubSetInterest(interest, { scroll: false });
  }

  function goToScene(sceneId) {
    if (typeof window.hubSetScene === "function") {
      window.hubSetScene(sceneId, false);
      return;
    }
    var btn = document.querySelector('.console-scene-btn[data-scene-jump="' + sceneId + '"]');
    if (btn) btn.click();
  }

  function trailPoint(from, to, t) {
    var cx = (from.x + to.x) / 2;
    var cy = Math.min(from.y, to.y) - Math.max(28, Math.abs(to.x - from.x) * 0.12);
    var u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
      y: u * u * from.y + 2 * u * t * cy + t * t * to.y
    };
  }

  function clearTrail() {
    if (!trailRoot) return;
    trailRoot.innerHTML = "";
    trailRoot.hidden = true;
  }

  function playScentTrail(sceneId, done) {
    if (reduced || !trailRoot) {
      done();
      return;
    }

    var figure = root.querySelector(".cinnamon-agent-figure");
    var heading = sceneHeading(sceneId);
    if (!figure || !heading) {
      done();
      return;
    }

    var fromRect = figure.getBoundingClientRect();
    var toRect = heading.getBoundingClientRect();
    var from = { x: fromRect.left + fromRect.width * 0.55, y: fromRect.bottom - 6 };
    var to = { x: toRect.left + Math.min(toRect.width * 0.2, 48), y: toRect.top + toRect.height * 0.5 };
    var steps = window.innerWidth < 720 ? 4 : 6;

    clearTrail();
    trailRoot.hidden = false;

    for (var i = 0; i < steps; i++) {
      var t = (i + 1) / (steps + 1);
      var pt = trailPoint(from, to, t);
      var mark = document.createElement("span");
      mark.className = "cinnamon-trail-mark";
      mark.style.left = pt.x + "px";
      mark.style.top = pt.y + "px";
      mark.style.animationDelay = String(i * 0.07) + "s";
      mark.style.setProperty("--trail-rot", String(-18 + i * 7) + "deg");
      trailRoot.appendChild(mark);
    }

    window.setTimeout(function () {
      clearTrail();
      done();
    }, 520 + steps * 70);
  }

  function formatFoundMessage(intent) {
    var tpl = (config && config.found_message_template) || DEFAULT_CONFIG.found_message_template;
    var section = intent && intent.label ? intent.label : "that";
    return tpl.replace("{section}", section);
  }

  function hubNavOffsetPx() {
    var styles = getComputedStyle(document.documentElement);
    var nav = parseFloat(styles.getPropertyValue("--hub-site-nav-height"));
    return Number.isFinite(nav) ? nav : 56;
  }

  function unbindSpotlightTrack() {
    if (!spotlightTrackBound) return;
    spotlightTrackBound = false;
    window.removeEventListener("scroll", onSpotlightTrack);
    window.removeEventListener("resize", onSpotlightTrack);
    if (spotlightTrackRaf) {
      window.cancelAnimationFrame(spotlightTrackRaf);
      spotlightTrackRaf = null;
    }
  }

  function onSpotlightTrack() {
    if (spotlightTrackRaf) window.cancelAnimationFrame(spotlightTrackRaf);
    spotlightTrackRaf = window.requestAnimationFrame(positionSpotlight);
  }

  function bindSpotlightTrack() {
    if (spotlightTrackBound) return;
    spotlightTrackBound = true;
    window.addEventListener("scroll", onSpotlightTrack, { passive: true });
    window.addEventListener("resize", onSpotlightTrack, { passive: true });
  }

  function positionSpotlight() {
    if (!spotlightRoot || spotlightRoot.hidden || !spotlightSceneId) return;
    var heading = sceneHeading(spotlightSceneId);
    if (!heading) return;

    spotlightRoot.classList.add("is-visible");
    var rect = heading.getBoundingClientRect();
    var cardHeight = spotlightRoot.offsetHeight;
    var gap = 12;
    var navPad = hubNavOffsetPx() + 10;
    var top = rect.top - cardHeight - gap;
    if (top < navPad) top = Math.max(navPad, rect.bottom + gap);
    var left = rect.left + rect.width * 0.5;

    spotlightRoot.style.top = Math.round(top) + "px";
    spotlightRoot.style.left = Math.round(left) + "px";
  }

  function hideSpotlight() {
    if (!spotlightRoot) return;
    spotlightSceneId = null;
    spotlightRoot.hidden = true;
    spotlightRoot.classList.remove("is-visible", "is-wagging");
    if (spotlightTimer) window.clearTimeout(spotlightTimer);
    if (spotlightWagTimer) window.clearTimeout(spotlightWagTimer);
    spotlightTimer = null;
    spotlightWagTimer = null;
    unbindSpotlightTrack();
  }

  function showSectionSpotlight(sceneId, message) {
    if (!spotlightRoot || !spotlightBubble) return;
    hideSpotlight();
    spotlightSceneId = sceneId;
    spotlightBubble.textContent = message;
    spotlightRoot.hidden = false;
    spotlightRoot.classList.add("is-visible", "is-wagging");
    positionSpotlight();
    bindSpotlightTrack();
    window.requestAnimationFrame(positionSpotlight);

    spotlightWagTimer = window.setTimeout(function () {
      if (spotlightRoot) spotlightRoot.classList.remove("is-wagging");
    }, 2200);
    spotlightTimer = window.setTimeout(hideSpotlight, 5200);
  }

  function runFind() {
    if (finding || !selected) return;
    var intent = selected;
    var queryText = queryInput.value;
    finding = true;
    hideSpotlight();
    root.classList.remove("is-idle", "is-sniffing");
    setFindEnabled(false);

    function finish() {
      var interest = resolveInterest(intent, queryText);
      if (interest) applyHubInterest(interest);
      var message = formatFoundMessage(intent);
      goToScene(intent.scene);

      function completeFind() {
        focusSceneHeading(intent.scene);
        pulseTarget(intent.scene);
        playFindSound();
        finding = false;
        root.classList.remove("is-finding");
        root.classList.add("is-idle");
        setBubble(message);
        setFindEnabled(true);
        noteActivity();
        triggerWag();
        showSectionSpotlight(intent.scene, message);
      }

      window.setTimeout(completeFind, reduced ? 0 : 480);
    }

    if (reduced) {
      finish();
      return;
    }

    root.classList.add("is-finding");
    playScentTrail(intent.scene, finish);
  }

  chipsRoot.addEventListener("click", function (e) {
    var btn = e.target.closest(".cinnamon-intent-chip");
    if (!btn) return;
    var id = btn.getAttribute("data-intent-id");
    var intent = null;
    for (var i = 0; i < intents.length; i++) {
      if (intents[i].id === id) {
        intent = intents[i];
        break;
      }
    }
    if (!intent) return;
    queryInput.value = "";
    queryHadText = false;
    selectIntent(intent, false);
  });

  queryInput.addEventListener("input", function () {
    var hasText = queryInput.value.length > 0;
    if (hasText && !queryHadText) triggerWag();
    queryHadText = hasText;

    selected = null;
    chipsRoot.querySelectorAll(".cinnamon-intent-chip").forEach(function (btn) {
      btn.setAttribute("aria-pressed", "false");
    });
    var match = matchIntentFromQuery(queryInput.value);
    if (match) {
      selectIntent(match, true);
      return;
    }
    setBubble(config ? config.greeting : DEFAULT_CONFIG.greeting);
    setFindEnabled(false);
  });

  queryInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!selected) syncSelectionFromQuery();
      if (selected) runFind();
    }
  });

  findBtn.addEventListener("click", function () {
    noteActivity();
    if (!selected) syncSelectionFromQuery();
    runFind();
  });

  if (soundToggle) {
    updateSoundToggle();
    soundToggle.addEventListener("click", function () {
      soundEnabled = !soundEnabled;
      try {
        window.localStorage.setItem("cinnamon-sound", soundEnabled ? "1" : "0");
      } catch (e) {
        /* ignore storage failures */
      }
      updateSoundToggle();
      if (soundEnabled) playFindSound();
      noteActivity();
    });
  }

  ["pointerdown", "keydown", "touchstart"].forEach(function (type) {
    document.addEventListener(type, noteActivity, { passive: true });
  });
  queryInput.addEventListener("input", noteActivity);

  window.cinnamonFind = programmaticFind;
  window.cinnamonWag = triggerWag;

  function bindStickyDock() {
    if (document.getElementById("hub-intro-grid")) return;
    if (!anchor || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          root.classList.toggle("is-sticky", !entry.isIntersecting);
        });
      },
      { root: null, threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );
    io.observe(anchor);
  }

  applyConfig(DEFAULT_CONFIG);
  bindStickyDock();
  scheduleIdleWag();

  document.addEventListener("hub-content-ready", function (e) {
    if (e.detail && e.detail.cinnamon_nav) applyConfig(e.detail.cinnamon_nav);
  });

  fetch(hubJsonUrl(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .catch(function () { return null; })
    .then(function (data) {
      if (data && data.cinnamon_nav) applyConfig(data.cinnamon_nav);
    });
})();
