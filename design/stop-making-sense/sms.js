(function () {
  var STEPS = [
    { cue: "Empty hall. One spot.", layers: [], spot: 0.35 },
    { cue: "Rolling out the platform…", layers: ["floor"], spot: 0.45 },
    { cue: "Backdrop drops in.", layers: ["floor", "backdrop"], spot: 0.5 },
    { cue: "House PA — stage left.", layers: ["floor", "backdrop", "amp-l"], spot: 0.55 },
    { cue: "House PA — stage right.", layers: ["floor", "backdrop", "amp-l", "amp-r"], spot: 0.58 },
    { cue: "Drum riser wheeled on.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums"], spot: 0.62 },
    { cue: "Keys station.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums", "keys"], spot: 0.68 },
    { cue: "Bass rig & mic.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums", "keys", "bass"], spot: 0.72 },
    { cue: "Guitar enters.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums", "keys", "bass", "guitar"], spot: 0.78 },
    { cue: "Lead vocal — centre stage.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums", "keys", "bass", "guitar", "vocal"], spot: 0.88 },
    { cue: "Cable snakes. Lights up. Full band.", layers: ["floor", "backdrop", "amp-l", "amp-r", "drums", "keys", "bass", "guitar", "vocal", "cables", "lights", "crowd", "fog"], spot: 1 },
  ];

  var scroller = document.getElementById("sms-scroller");
  var spacer = document.getElementById("sms-scroll-spacer");
  var pin = document.getElementById("sms-pin");
  var cueEl = document.getElementById("sms-hud-cue");
  var progressFill = document.getElementById("sms-progress-fill");
  var stepDots = document.getElementById("sms-step-dots");
  var spot = document.getElementById("sms-spot");
  var intro = document.getElementById("sms-intro");
  var stageInner = document.querySelector(".sms-stage-inner");
  var skipBtn = document.getElementById("sms-skip");
  var layerMap = {};
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lastStep = -1;

  document.querySelectorAll("[data-sms-layer]").forEach(function (el) {
    layerMap[el.getAttribute("data-sms-layer")] = el;
  });

  if (stepDots) {
    STEPS.forEach(function (_, i) {
      var d = document.createElement("span");
      d.className = "sms-step-dot";
      d.setAttribute("aria-hidden", "true");
      d.dataset.step = String(i);
      stepDots.appendChild(d);
    });
  }

  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }

  function scrollProgress() {
    if (!scroller || !spacer) return 0;
    var scrollY = window.scrollY || document.documentElement.scrollTop;
    var scrollable = spacer.offsetHeight;
    if (scrollable <= 0) return 1;
    var start = scroller.offsetTop;
    return clamp((scrollY - start) / scrollable, 0, 1);
  }

  function stepIndex(progress) {
    if (progress >= 1) return STEPS.length - 1;
    var slot = progress * STEPS.length;
    return clamp(Math.floor(slot), 0, STEPS.length - 1);
  }

  function applyStep(idx) {
    if (idx === lastStep) return;
    lastStep = idx;
    var step = STEPS[idx];
    if (cueEl) cueEl.textContent = step.cue;

    Object.keys(layerMap).forEach(function (key) {
      var el = layerMap[key];
      var on = step.layers.indexOf(key) !== -1;
      el.classList.toggle("is-on-stage", on);
    });

    if (spot) {
      spot.classList.toggle("is-hot", step.spot >= 0.7);
      spot.style.opacity = String(step.spot);
    }

    if (stepDots) {
      stepDots.querySelectorAll(".sms-step-dot").forEach(function (dot, i) {
        dot.classList.toggle("is-done", i < idx);
        dot.classList.toggle("is-current", i === idx);
      });
    }
  }

  function render(progress) {
    if (progressFill) {
      progressFill.style.width = (progress * 100).toFixed(1) + "%";
    }
    var prog = document.getElementById("sms-progress");
    if (prog) prog.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    if (stageInner) {
      stageInner.style.setProperty("--sms-depth", String(progress * 0.12));
    }
    applyStep(stepIndex(progress));
    if (intro && progress > 0.04) {
      intro.classList.add("is-hidden");
    }
  }

  function onScroll() {
    render(scrollProgress());
  }

  function showFinal() {
    render(1);
    if (spacer) spacer.style.height = "0";
    lastStep = -1;
    render(1);
  }

  if (reduced) {
    showFinal();
    if (skipBtn) skipBtn.hidden = true;
    if (intro) intro.classList.add("is-hidden");
  } else {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  if (skipBtn) {
    skipBtn.addEventListener("click", function () {
      showFinal();
      window.scrollTo({ top: document.body.scrollHeight, behavior: reduced ? "auto" : "smooth" });
    });
  }
})();
