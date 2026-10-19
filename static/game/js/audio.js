/* 岐黄堂 v3 · 音频层（WebAudio 合成，无外部资源）
 * 浏览器拒绝或缺少音频时静默降级，不阻塞玩法。
 */
(function (global) {
  'use strict';

  function create() {
    var ctx = null;
    var muted = false;
    var master = null;

    function ensure() {
      if (ctx) return ctx;
      try {
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.28;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
      }
      return ctx;
    }

    function unlock() {
      var c = ensure();
      if (c && c.state === 'suspended') {
        c.resume().catch(function () {});
      }
    }

    function tone(freq, dur, type, gain, delay, slideTo) {
      if (muted) return;
      var c = ensure();
      if (!c) return;
      try {
        var t0 = c.currentTime + (delay || 0);
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain || 0.5, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      } catch (e) { /* 静默 */ }
    }

    function noise(dur, gain, delay) {
      if (muted) return;
      var c = ensure();
      if (!c) return;
      try {
        var t0 = c.currentTime + (delay || 0);
        var len = Math.floor(c.sampleRate * dur);
        var buf = c.createBuffer(1, len, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        var src = c.createBufferSource();
        src.buffer = buf;
        var g = c.createGain();
        g.gain.value = gain || 0.1;
        var filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start(t0);
      } catch (e) { /* 静默 */ }
    }

    return {
      unlock: unlock,
      setMuted: function (v) {
        muted = !!v;
        if (master && ctx) {
          master.gain.setTargetAtTime(muted ? 0 : 0.28, ctx.currentTime, 0.02);
        }
      },
      isMuted: function () { return muted; },
      click: function () { tone(520, 0.06, 'triangle', 0.25); },
      door: function () { noise(0.45, 0.12); tone(120, 0.5, 'sine', 0.18, 0, 70); },
      pick: function () { tone(660, 0.08, 'sine', 0.2); },
      success: function () {
        tone(523, 0.12, 'sine', 0.3);
        tone(659, 0.12, 'sine', 0.3, 0.1);
        tone(784, 0.22, 'sine', 0.32, 0.2);
      },
      coin: function () { tone(880, 0.07, 'triangle', 0.2); tone(1174, 0.09, 'triangle', 0.16, 0.06); },
      error: function () { tone(220, 0.16, 'sawtooth', 0.16, 0, 160); },
      burn: function () { noise(0.5, 0.15); tone(90, 0.4, 'sawtooth', 0.12, 0, 60); },
      perfect: function () { tone(1046, 0.14, 'sine', 0.25); tone(1318, 0.2, 'sine', 0.22, 0.12); },
      deliver: function () { tone(680, 0.1, 'sine', 0.25); tone(906, 0.16, 'sine', 0.22, 0.09); },
      alert: function () { tone(392, 0.12, 'square', 0.1); tone(392, 0.12, 'square', 0.1, 0.16); },
      dispose: function () {
        if (ctx) {
          try { ctx.close(); } catch (e) {}
        }
        ctx = null; master = null;
      }
    };
  }

  global.QH_AUDIO = { create: create };
})(typeof self !== 'undefined' ? self : this);
