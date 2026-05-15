/**
 * Open-string clicks on the hero bass photo: E (top) → G (bottom).
 * Plays Freesound P-Bass recordings (see brand_assets/SAMPLES_LICENSE.txt); falls back to Web Audio if playback fails.
 * Space stops ringing (samples + synth), except when focus is in a form control.
 * Samples + synth share a master gain + compressor to reduce clipping when notes overlap.
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

  var ctx;
  /** Shared trim + light compression before destination (tames overlapping notes) */
  var masterIn;
  var masterComp;
  var sampleAudio = {};
  /** @type {Record<string, MediaElementAudioSourceNode>} */
  var mediaSources = {};
  /** @type {{ osc: OscillatorNode, gain: GainNode, tid: number }[]} */
  var synthVoices = [];

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

  function playSynthPluck(audioCtx, note) {
    if (!masterIn) wireMaster(audioCtx);
    var hz = OPEN_HZ[note];
    if (!hz) return;

    var t0 = audioCtx.currentTime;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    var filter = audioCtx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hz, t0);

    filter.type = 'lowpass';
    var fHi = Math.min(2600, 720 + hz * 32);
    var fLo = Math.max(85, hz * 2.1);
    filter.Q.setValueAtTime(1.15, t0);
    filter.frequency.setValueAtTime(fHi, t0);
    filter.frequency.exponentialRampToValueAtTime(fLo, t0 + 0.2);

    var peak =
      (note === 'E' ? 0.4 : note === 'A' ? 0.38 : 0.36) * 0.72;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.72);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterIn);

    var voice = { osc: osc, gain: gain, tid: 0 };
    synthVoices.push(voice);
    osc.start(t0);
    osc.stop(t0 + 0.78);
    voice.tid = window.setTimeout(function () {
      var i = synthVoices.indexOf(voice);
      if (i >= 0) synthVoices.splice(i, 1);
    }, 850);
  }

  function stopSynthVoices() {
    var audioCtx = ctx;
    var t = audioCtx ? audioCtx.currentTime : 0;
    synthVoices.forEach(function (v) {
      if (v.tid) {
        window.clearTimeout(v.tid);
        v.tid = 0;
      }
      if (audioCtx) {
        try {
          v.gain.gain.cancelScheduledValues(t);
          v.gain.gain.setValueAtTime(0, t);
        } catch (e1) {}
        try {
          v.osc.stop(t);
        } catch (e2) {}
      }
    });
    synthVoices = [];
  }

  function stopSamplePlayback() {
    Object.keys(sampleAudio).forEach(function (note) {
      var el = sampleAudio[note];
      if (!el) return;
      try {
        el.pause();
        el.currentTime = 0;
      } catch (err) {}
    });
  }

  function stopAllBassSounds() {
    stopSamplePlayback();
    stopSynthVoices();
  }

  function playSynthFallback(note) {
    var audioCtx = getCtx();
    if (!audioCtx) return;
    var run = function () {
      playSynthPluck(audioCtx, note);
    };
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(run).catch(run);
    } else {
      run();
    }
  }

  function ensureMediaRouted(audioCtx, note, el) {
    if (mediaSources[note]) return;
    var src = audioCtx.createMediaElementSource(el);
    src.connect(masterIn);
    mediaSources[note] = src;
  }

  function playSample(note) {
    var path = SAMPLE_PATH[note];
    if (!path) {
      playSynthFallback(note);
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
      try {
        el.pause();
      } catch (err1) {}
      el.currentTime = 0;
      var p = el.play();
      if (p && typeof p.then === 'function') {
        p.catch(function () {
          playSynthFallback(note);
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
    if (resume && typeof resume.then === 'function') {
      resume.then(startPlayback).catch(startPlayback);
    } else {
      startPlayback();
    }
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

  map.addEventListener('click', function (e) {
    var btn = e.target.closest('.bass-string-hit');
    if (!btn || !map.contains(btn)) return;
    var note = btn.getAttribute('data-open-string');
    if (!note || !OPEN_HZ[note]) return;
    playSample(note);
  });
})();
