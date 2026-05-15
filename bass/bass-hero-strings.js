/**
 * Open-string press on the hero bass photo: E (top) → G (bottom).
 * Sound plays while pointer/mouse/touch is down; stops on release.
 * Freesound P-Bass recordings (see brand_assets/SAMPLES_LICENSE.txt); Web Audio synth hold if sample play fails.
 * Short gain fades on sample stop / synth release reduce clicks; E and G use shorter sample fade-ins so pick attack stays clear.
 */
(function () {
  'use strict';

  /** Standard 4-string tuning, Hz — synth fallback only */
  var OPEN_HZ = {
    E: 41.203444614108741,
    A: 55,
    D: 73.416191978010629,
    G: 97.998858995437527
  };

  /** tim.kahn "Old Fender P-Bass Picked" — Freesound -hq.mp3 previews */
  var SAMPLE_PATH = {
    E: 'brand_assets/pbass-open-e.mp3',
    A: 'brand_assets/pbass-open-a.mp3',
    D: 'brand_assets/pbass-open-d.mp3',
    G: 'brand_assets/pbass-open-g.mp3'
  };

  /** Sample fade-out (s) — avoids zipper noise from instant pause */
  var SAMPLE_FADE_OUT = 0.048;
  /** Sample fade-in (s) when routed through Web Audio (E & G shorter — preserve pick transients) */
  var SAMPLE_FADE_IN = 0.012;
  var SAMPLE_FADE_IN_E = 0.003;
  var SAMPLE_FADE_IN_G = 0.004;
  /** Synth release (s) on mouse up */
  var SYNTH_RELEASE = 0.065;

  var ctx;
  /** Shared trim + light compression before destination (tames overlapping notes) */
  var masterIn;
  var masterComp;
  var sampleAudio = {};
  /** @type {Record<string, MediaElementAudioSourceNode>} */
  var mediaSources = {};
  /** Per-note gain after MediaElementSource → smooth stop/start */
  /** @type {Record<string, GainNode>} */
  var sampleGains = {};
  /** Pending setTimeout id after fade-out, per note */
  /** @type {Record<string, number>} */
  var sampleFadeTimers = {};
  /** setInterval id for volume-only fade fallback */
  var volumeFadeInterval = null;

  /** Sustained synth while string is held */
  /** @type {{ osc: OscillatorNode, gain: GainNode, filter: BiquadFilterNode } | null} */
  var heldSynth = null;

  /** Note currently held, or null */
  var activeNote = null;
  /** Pointer id for PointerEvent path (ignore other pointers) */
  var activePointerId = null;

  function wireMaster(audioCtx) {
    if (masterIn) return;
    masterIn = audioCtx.createGain();
    masterIn.gain.setValueAtTime(0.65, audioCtx.currentTime);
    masterComp = audioCtx.createDynamicsCompressor();
    masterComp.threshold.setValueAtTime(-22, audioCtx.currentTime);
    masterComp.knee.setValueAtTime(14, audioCtx.currentTime);
    masterComp.ratio.setValueAtTime(2.75, audioCtx.currentTime);
    masterComp.attack.setValueAtTime(0.002, audioCtx.currentTime);
    masterComp.release.setValueAtTime(0.16, audioCtx.currentTime);
    masterIn.connect(masterComp);
    masterComp.connect(audioCtx.destination);
  }

  function getCtx() {
    if (ctx) return ctx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    wireMaster(ctx);
    return ctx;
  }

  function clearSampleFadeTimer(note) {
    var tid = sampleFadeTimers[note];
    if (tid) {
      window.clearTimeout(tid);
      delete sampleFadeTimers[note];
    }
  }

  function resetSampleGain(note) {
    var g = sampleGains[note];
    if (!g || !ctx) return;
    try {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(1, ctx.currentTime);
    } catch (e) {}
  }

  /** Immediate pause all samples + reset gain nodes (new note / hard stop). */
  function hardStopAllSamples() {
    if (volumeFadeInterval) {
      window.clearInterval(volumeFadeInterval);
      volumeFadeInterval = null;
    }
    ['E', 'A', 'D', 'G'].forEach(function (note) {
      clearSampleFadeTimer(note);
      var el = sampleAudio[note];
      if (!el) return;
      resetSampleGain(note);
      try {
        el.pause();
        el.currentTime = 0;
      } catch (err) {}
      el.volume = sampleGains[note] ? 1 : 0.52;
    });
  }

  /** Fade out one sample then pause (mouse / touch release). */
  function fadeOutSampleNote(note) {
    var el = sampleAudio[note];
    if (!el) return;
    var g = sampleGains[note];
    var ac = ctx;
    clearSampleFadeTimer(note);

    if (g && ac) {
      var t = ac.currentTime;
      try {
        g.gain.cancelScheduledValues(t);
        var cur = g.gain.value;
        if (cur < 0.0001) cur = 0.0001;
        g.gain.setValueAtTime(cur, t);
        g.gain.linearRampToValueAtTime(0, t + SAMPLE_FADE_OUT);
      } catch (e1) {}
      sampleFadeTimers[note] = window.setTimeout(function () {
        delete sampleFadeTimers[note];
        try {
          el.pause();
          el.currentTime = 0;
        } catch (e2) {}
        resetSampleGain(note);
      }, SAMPLE_FADE_OUT * 1000 + 25);
      return;
    }

    fadeOutSampleVolumeOnly(el);
  }

  /** Fallback when audio element is not on the Web Audio graph */
  function fadeOutSampleVolumeOnly(el) {
    if (volumeFadeInterval) {
      window.clearInterval(volumeFadeInterval);
      volumeFadeInterval = null;
    }
    var steps = 8;
    var stepMs = 5;
    var v0 = el.volume;
    var n = 0;
    volumeFadeInterval = window.setInterval(function () {
      n += 1;
      el.volume = Math.max(0, v0 * (1 - n / steps));
      if (n >= steps) {
        window.clearInterval(volumeFadeInterval);
        volumeFadeInterval = null;
        try {
          el.pause();
          el.currentTime = 0;
        } catch (e) {}
        el.volume = v0 > 0 ? v0 : 0.52;
      }
    }, stepMs);
  }

  function hardStopHeldSynth() {
    if (!heldSynth || !ctx) return;
    var t = ctx.currentTime;
    try {
      heldSynth.gain.gain.cancelScheduledValues(t);
      heldSynth.gain.gain.setValueAtTime(0, t);
    } catch (e1) {}
    try {
      heldSynth.osc.stop(t);
    } catch (e2) {}
    heldSynth = null;
  }

  function fadeStopHeldSynth() {
    if (!heldSynth || !ctx) return;
    var t = ctx.currentTime;
    var g = heldSynth.gain;
    try {
      g.gain.cancelScheduledValues(t);
      var cur = g.gain.value;
      if (cur < 0.0001) cur = 0.0001;
      g.gain.setValueAtTime(cur, t);
      g.gain.linearRampToValueAtTime(0, t + SYNTH_RELEASE);
    } catch (e1) {}
    try {
      heldSynth.osc.stop(t + SYNTH_RELEASE + 0.02);
    } catch (e2) {}
    heldSynth = null;
  }

  function startSynthHeld(audioCtx, note) {
    if (!masterIn) wireMaster(audioCtx);
    hardStopHeldSynth();
    var hz = OPEN_HZ[note];
    if (!hz) return;

    var t0 = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    var filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hz, t0);

    filter.type = 'lowpass';
    var fHi = Math.min(2200, 620 + hz * 28);
    var fLo = Math.max(90, hz * 2.2);
    filter.Q.setValueAtTime(1.1, t0);
    filter.frequency.setValueAtTime(fHi, t0);
    filter.frequency.exponentialRampToValueAtTime(fLo, t0 + 0.08);

    var peak = (note === 'E' ? 0.16 : note === 'A' ? 0.15 : 0.14) * 0.72;
    var atk = note === 'E' || note === 'G' ? 0.012 : 0.025;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + atk);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterIn);

    osc.start(t0);
    heldSynth = { osc: osc, gain: gain, filter: filter };
  }

  function runSynthHeld(audioCtx, note) {
    if (activeNote !== note) return;
    var run = function () {
      if (activeNote !== note) return;
      startSynthHeld(audioCtx, note);
    };
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(run).catch(run);
    } else {
      run();
    }
  }

  function stopAllBassSounds() {
    activeNote = null;
    activePointerId = null;
    hardStopAllSamples();
    hardStopHeldSynth();
  }

  function ensureMediaRouted(audioCtx, note, el) {
    if (mediaSources[note]) return;
    var src = audioCtx.createMediaElementSource(el);
    var g = audioCtx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(masterIn);
    mediaSources[note] = src;
    sampleGains[note] = g;
  }

  /** Start sample for this note (hold until pause); on play() failure uses sustained synth. */
  function startSample(note) {
    var path = SAMPLE_PATH[note];
    if (!path) {
      var ac0 = getCtx();
      if (ac0) runSynthHeld(ac0, note);
      return;
    }
    var audioCtx = getCtx();
    if (!sampleAudio[note]) {
      var a = new Audio(path);
      a.preload = 'auto';
      sampleAudio[note] = a;
    }
    var el = sampleAudio[note];

    function startPlayback() {
      if (activeNote !== note) return;
      try {
        el.pause();
      } catch (err1) {}
      el.currentTime = 0;
      var g = sampleGains[note];
      if (g && audioCtx) {
        var t = audioCtx.currentTime;
        var fadeIn =
          note === 'E' ? SAMPLE_FADE_IN_E : note === 'G' ? SAMPLE_FADE_IN_G : SAMPLE_FADE_IN;
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(1, t + fadeIn);
        } catch (e0) {}
      }
      var p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch(function () {
          if (activeNote !== note) return;
          var ac2 = getCtx();
          if (ac2) runSynthHeld(ac2, note);
        });
      }
    }

    if (!audioCtx) {
      el.volume = 0.52;
      startPlayback();
      return;
    }

    wireMaster(audioCtx);
    try {
      ensureMediaRouted(audioCtx, note, el);
    } catch (err2) {
      el.volume = 0.52;
      startPlayback();
      return;
    }

    el.volume = 1;
    var resume = audioCtx.resume();
    var afterResume = function () {
      if (activeNote !== note) return;
      startPlayback();
    };
    if (resume && typeof resume.then === 'function') {
      resume.then(afterResume).catch(afterResume);
    } else {
      afterResume();
    }
  }

  function silenceOutput() {
    hardStopAllSamples();
    hardStopHeldSynth();
  }

  function beginStringSound(note) {
    silenceOutput();
    activeNote = note;
    startSample(note);
  }

  function endStringSound() {
    if (!activeNote) return;
    var n = activeNote;
    activeNote = null;
    activePointerId = null;
    fadeOutSampleNote(n);
    fadeStopHeldSynth();
  }

  function isTypingFocus(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'BUTTON' && el.closest && el.closest('form')) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener(
    'keydown',
    function (e) {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (e.repeat) return;
      if (isTypingFocus(document.activeElement)) return;
      e.preventDefault();
      stopAllBassSounds();
    },
    true
  );

  var map = document.querySelector('.bass-string-map');
  if (!map) return;

  function hitFromEventTarget(t) {
    if (!t || !t.closest) return null;
    var btn = t.closest('.bass-string-hit');
    if (!btn || !map.contains(btn)) return null;
    var note = btn.getAttribute('data-open-string');
    if (!note || !OPEN_HZ[note]) return null;
    return { btn: btn, note: note };
  }

  var usePointer = typeof window.PointerEvent !== 'undefined';

  if (usePointer) {
    map.addEventListener(
      'pointerdown',
      function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var hit = hitFromEventTarget(e.target);
        if (!hit) return;
        try {
          hit.btn.setPointerCapture(e.pointerId);
        } catch (err) {}
        activePointerId = e.pointerId;
        beginStringSound(hit.note);
      },
      true
    );

    function onPointerEnd(e) {
      if (activeNote === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      endStringSound();
    }

    map.addEventListener('pointerup', onPointerEnd, true);
    map.addEventListener('pointercancel', onPointerEnd, true);
  } else {
    map.addEventListener(
      'mousedown',
      function (e) {
        if (e.button !== 0) return;
        var hit = hitFromEventTarget(e.target);
        if (!hit) return;
        beginStringSound(hit.note);
      },
      true
    );

    window.addEventListener(
      'mouseup',
      function () {
        if (activeNote !== null) endStringSound();
      },
      true
    );

    map.addEventListener(
      'touchstart',
      function (e) {
        if (e.touches.length !== 1) return;
        var hit = hitFromEventTarget(e.target);
        if (!hit) return;
        beginStringSound(hit.note);
      },
      { capture: true, passive: true }
    );

    window.addEventListener(
      'touchend',
      function () {
        if (activeNote !== null) endStringSound();
      },
      true
    );
    window.addEventListener(
      'touchcancel',
      function () {
        if (activeNote !== null) endStringSound();
      },
      true
    );
  }
})();
