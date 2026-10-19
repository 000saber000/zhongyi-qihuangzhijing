/* 岐黄堂 v3 · 应用外壳
 * 负责外景/双门、模式说明、种子、转场、暂停退出、全局偏好与生命周期。
 */
(function (global) {
  'use strict';

  var D = global.QH_DATA;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function el(id) { return document.getElementById(id); }

  function noop() {}

  function makeNullScene() {
    return {
      isNull: true,
      setHitTypes: noop, onPick: noop, setView: noop, forceView: noop,
      showExterior: noop, showInterior: noop, focusDoor: noop, openDoor: noop,
      closeDoors: noop, setDoorHover: noop, setDoorHighlight: noop,
      setDrawerMaterials: noop, nudgeDrawer: noop, syncDrawerStates: noop,
      setPatients: noop, setSelectedBowl: noop, setPots: noop, setBowls: noop,
      setPatientSelection: noop, pulsePot: noop, pulseBowl: noop,
      project: function () { return { x: 0, y: 0 }; },
      setReducedMotion: noop, dispose: noop
    };
  }

  function App() {
    this.data = D;
    this.state = 'boot';
    this.controller = null;
    this.lastDoor = null;
    this.exitConfirm = false;
    this.pendingDoor = null;
    this.transitioning = false;
    this.testMode = false;
    this.prefs = this.loadPrefs();
    this.audio = global.QH_AUDIO.create();
    this.audio.setMuted(this.prefs.muted);

    this.root = el('mode-root');
    this.exterior = el('exterior');
    this.exteriorHud = el('exterior-hud');
    this.overlay = el('transition-overlay');
    this.introBackdrop = el('intro-backdrop');
    this.confirmModal = el('confirm-modal');
    this.toastStack = el('toast-stack');
    this.live = el('sr-live');

    this.initScene();
    this.bind();
    this.applyMotion();
    this.updateMuteButtons();
    this.state = 'exterior';
    this.renderExterior();
  }

  App.prototype.loadPrefs = function () {
    var p = { muted: false, reduced: null, lastDoor: null };
    try {
      var raw = localStorage.getItem('qihuang.v3.prefs');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (typeof parsed.muted === 'boolean') p.muted = parsed.muted;
        if (typeof parsed.reduced === 'boolean' || parsed.reduced === null) p.reduced = parsed.reduced;
        if (parsed.lastDoor === 'acute' || parsed.lastDoor === 'chronicle') p.lastDoor = parsed.lastDoor;
      }
    } catch (e) {}
    this.lastDoor = p.lastDoor;
    return p;
  };

  App.prototype.savePrefs = function () {
    try {
      localStorage.setItem('qihuang.v3.prefs', JSON.stringify({
        muted: this.prefs.muted, reduced: this.prefs.reduced, lastDoor: this.lastDoor
      }));
    } catch (e) {}
  };

  App.prototype.systemReduced = function () {
    try { return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  };

  App.prototype.reducedMotion = function () {
    if (this.prefs.reduced === null || this.prefs.reduced === undefined) return this.systemReduced();
    return !!this.prefs.reduced;
  };

  App.prototype.initScene = function () {
    var self = this;
    var api = null;
    try {
      api = global.QH_SCENE.create(el('gl'), {
        reducedMotion: this.reducedMotion(),
        coverUrl: 'assets/qihuang-cover.png'
      });
    } catch (e) {
      api = null;
    }
    if (!api) {
      api = makeNullScene();
      document.body.classList.add('no-webgl');
      var hint = el('exterior-hint');
      if (hint) hint.textContent = '当前环境未启用 WebGL，已切换为图片背景；两模式的全部操作仍可用 HTML 完成。';
    }
    this.scene = api;
    this.is3D = !api.isNull;
    this.scene.onPick(function (target) {
      if (self.state === 'exterior' && target.type === 'door') {
        self.openIntro(target.door, 'scene');
      } else if ((self.state === 'activeMode' || self.state === 'paused') && self.controller && self.controller.handlePick) {
        self.controller.handlePick(target);
      }
    });
    this.scene.setDoorHighlight(this.lastDoor);
  };

  App.prototype.bind = function () {
    var self = this;

    Array.prototype.forEach.call(document.querySelectorAll('[data-door]'), function (btn) {
      var key = btn.getAttribute('data-door');
      btn.addEventListener('click', function () { self.openIntro(key, 'button'); });
      btn.addEventListener('pointerenter', function () { self.scene.setDoorHover(key, true); });
      btn.addEventListener('pointerleave', function () { self.scene.setDoorHover(key, false); });
      btn.addEventListener('focus', function () { self.scene.setDoorHover(key, true); });
      btn.addEventListener('blur', function () { self.scene.setDoorHover(key, false); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.mute-btn'), function (btn) {
      btn.addEventListener('click', function () { self.toggleMute(); });
    });

    var motion = el('motion-toggle');
    if (motion) {
      motion.addEventListener('click', function () {
        self.prefs.reduced = !self.reducedMotion();
        self.applyMotion();
        self.savePrefs();
        self.announce(self.prefs.reduced ? '已减少动态效果。' : '已恢复完整动态效果。');
      });
    }

    el('intro-cancel').addEventListener('click', function () { self.cancelIntro(); });
    el('intro-cancel-x').addEventListener('click', function () { self.cancelIntro(); });
    el('seed-random').addEventListener('click', function () {
      el('seed-input').value = String(D.randomSeed());
      el('seed-error').hidden = true;
    });
    el('intro-start').addEventListener('click', function () { self.startFromIntro(); });
    el('seed-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self.startFromIntro(); }
    });

    el('confirm-stay').addEventListener('click', function () { self.cancelExit(); });
    el('confirm-leave').addEventListener('click', function () { self.confirmExit(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        var dialogs = Array.prototype.filter.call(document.querySelectorAll('[role="dialog"][aria-modal="true"]'), function (dialog) {
          return dialog.getClientRects().length > 0;
        });
        var dialog = dialogs[dialogs.length - 1];
        if (dialog) {
          var controls = Array.prototype.filter.call(dialog.querySelectorAll('button, input, select, textarea, a[href], [tabindex]'), function (control) {
            return !control.disabled && control.tabIndex >= 0 && control.getClientRects().length > 0;
          });
          var index = controls.indexOf(document.activeElement);
          if (controls.length && (index < 0 || (e.shiftKey ? index === 0 : index === controls.length - 1))) {
            e.preventDefault();
            controls[e.shiftKey ? controls.length - 1 : 0].focus();
          }
        }
      }
      if (e.key === 'Escape') {
        if (!self.introBackdrop.hidden) { self.cancelIntro(); }
        else if (!self.confirmModal.hidden) { self.cancelExit(); }
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!self.controller) return;
      if (document.hidden) {
        if (self.controller.onVisibilityHidden) self.controller.onVisibilityHidden();
        self.state = 'paused';
      } else {
        if (self.controller.onVisibilityVisible) self.controller.onVisibilityVisible();
        if (self.controller.getPhase && self.controller.getPhase() === 'paused') self.state = 'paused';
        else if (self.controller.getPhase && self.controller.getPhase() !== 'paused') self.state = 'activeMode';
      }
    });

    global.addEventListener('qh:request-exit', function () { self.requestExit(); });
    global.addEventListener('qh:exit-to-exterior', function () { self.exitToExterior(); });
  };

  App.prototype.applyMotion = function () {
    var reduced = this.reducedMotion();
    document.body.classList.toggle('reduce-motion', reduced);
    if (this.scene && this.scene.setReducedMotion) this.scene.setReducedMotion(reduced);
    var motion = el('motion-toggle');
    if (motion) motion.textContent = '减少动态：' + (reduced ? '开' : '关');
    if (this.controller && this.controller.onPrefsChanged) this.controller.onPrefsChanged();
  };

  App.prototype.updateMuteButtons = function () {
    var muted = this.prefs.muted;
    Array.prototype.forEach.call(document.querySelectorAll('.mute-btn'), function (btn) {
      btn.textContent = '静音：' + (muted ? '开' : '关');
      btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    });
  };

  App.prototype.toggleMute = function () {
    this.prefs.muted = !this.prefs.muted;
    this.audio.setMuted(this.prefs.muted);
    if (!this.prefs.muted) this.audio.unlock();
    this.savePrefs();
    this.updateMuteButtons();
    this.announce(this.prefs.muted ? '已静音。' : '已开启声音。');
  };

  App.prototype.announce = function (text) {
    if (this.live) this.live.textContent = text;
  };

  App.prototype.showToast = function (text, kind) {
    if (!this.toastStack) return;
    while (this.toastStack.children.length >= 3) {
      this.toastStack.removeChild(this.toastStack.firstChild);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' toast-' + kind : '');
    t.textContent = text;
    this.toastStack.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 2400);
  };

  App.prototype.renderExterior = function () {
    this.root.inert = false;
    this.exterior.hidden = false;
    this.exteriorHud.hidden = false;
    this.root.hidden = true;
    this.root.innerHTML = '';
    document.body.classList.remove('mode-chronicle', 'mode-acute', 'mode-active');
    Array.prototype.forEach.call(document.querySelectorAll('.door-card'), function (btn) {
      btn.classList.toggle('is-last', btn.getAttribute('data-door') === this.lastDoor);
    }, this);
    if (this.scene) {
      this.scene.showExterior();
      this.scene.setDoorHighlight(this.lastDoor);
      this.scene.setHitTypes(['door']);
      this.scene.closeDoors();
    }
  };

  App.prototype.introConfig = function (door) {
    if (door === 'acute') {
      return {
        door: 'acute',
        kicker: '正门 · 急症候',
        title: '岐黄堂 · 急症候',
        sub: '看方取药，兼顾火候',
        start: '开始值班',
        list: [
          '一局三天，每天四张订单，共十二张。',
          '同时最多两位病人、两口锅、一个 3 秒加工位。',
          '按药笺配齐材料，加工后入炉；完美火候 25 分。',
          '时间只在点“开始今日”后推进，可随时暂停。',
          '工序与时间为玩法抽象，不代表真实煎药步骤。'
        ],
        note: '本局刷新后重新开始。急症候不使用铜钱、库存或声望。'
      };
    }
    return {
      door: 'chronicle',
      kicker: '侧门 · 行医录',
      title: '岐黄堂 · 行医录',
      sub: '三日坐堂，循证识方',
      start: '开始研习',
      list: [
        '三天六次接诊，约 6～10 分钟。',
        '每位病人有三条隐藏线索、两次免费问诊。',
        '可花 3 文再问一次；比较三张方证卡后按“按此方取药”。',
        '方证判断不会即时提示；交付时若方证不符，来访者会离开并扣铜钱。',
        '第一、二天收摊后进入固定药市补货。'
      ],
      note: '本局刷新后重新开始。教学情境，不用于实际诊疗。'
    };
  };

  App.prototype.openIntro = function (door, source) {
    if (this.state !== 'exterior' || this.transitioning) return;
    if (this.testMode) return;
    this.audio.unlock();
    this.audio.click();
    this.pendingDoor = door;
    var cfg = this.introConfig(door);
    this.state = 'modeIntro';
    el('intro-kicker').textContent = cfg.kicker;
    el('intro-title').textContent = cfg.title;
    el('intro-sub').textContent = cfg.sub;
    var list = el('intro-list');
    list.innerHTML = '';
    cfg.list.forEach(function (line) {
      var li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    });
    el('intro-start').textContent = cfg.start;
    el('seed-input').value = '';
    el('seed-error').hidden = true;
    this.introBackdrop.hidden = false;
    document.body.classList.add('intro-open');
    this.scene.focusDoor(door);
    this.scene.setDoorHover(door, true);
    var self = this;
    setTimeout(function () { if (!self.introBackdrop.hidden) el('seed-input').focus(); }, 60);
  };

  App.prototype.cancelIntro = function () {
    if (this.introBackdrop.hidden) return;
    this.introBackdrop.hidden = true;
    document.body.classList.remove('intro-open');
    this.state = 'exterior';
    this.scene.setDoorHover(this.pendingDoor, false);
    this.pendingDoor = null;
    this.scene.focusDoor(null);
    this.scene.setView('exterior');
    this.announce('已返回外景。');
  };

  App.prototype.startFromIntro = function () {
    var door = this.pendingDoor;
    if (!door) return;
    var parsed = D.parseSeed(el('seed-input').value);
    if (!parsed.ok) {
      var err = el('seed-error');
      err.textContent = parsed.error;
      err.hidden = false;
      el('seed-input').focus();
      return;
    }
    this.introBackdrop.hidden = true;
    document.body.classList.remove('intro-open');
    this.pendingDoor = null;
    this.enterMode(door, parsed.seed);
  };

  App.prototype.setOverlayMark = function (text) {
    var mark = this.overlay ? this.overlay.querySelector('.overlay-mark') : null;
    if (mark) mark.textContent = text;
  };

  App.prototype.enterMode = function (door, seed) {
    var self = this;
    if (this.transitioning) return Promise.resolve(false);
    this.transitioning = true;
    this.state = 'transitioning';
    document.body.classList.add('is-transitioning');
    this.scene.setHitTypes([]);
    this.audio.door();
    this.setOverlayMark('正在进入岐黄堂');

    var reduced = this.reducedMotion();
    var done = function () {
      try {
        self.mountMode(door, seed);
      } catch (e) {
        self.transitioning = false;
        self.state = 'exterior';
        document.body.classList.remove('is-transitioning');
        self.overlay.classList.remove('is-covered');
        self.renderExterior();
        self.showToast('启动失败：' + (e && e.message ? e.message : '未知错误'), 'error');
        return;
      }
      self.overlay.classList.remove('is-covered');
      setTimeout(function () {
        self.transitioning = false;
        self.state = 'activeMode';
        document.body.classList.remove('is-transitioning');
        self.announce('已进入' + (door === 'acute' ? '急症候' : '行医录') + '。');
      }, reduced ? 160 : 400);
    };

    if (reduced) {
      this.scene.focusDoor(door);
      this.overlay.classList.add('is-covered');
      return sleep(180).then(done);
    }

    this.scene.focusDoor(door);
    return sleep(400).then(function () {
      self.scene.openDoor(door);
      // 门打开后停留，让门洞里的“正在进入岐黄堂”加载面板可见
      return sleep(1000);
    }).then(function () {
      self.overlay.classList.add('is-covered');
      return sleep(220);
    }).then(done);
  };

  App.prototype.mountMode = function (door, seed) {
    if (this.controller) {
      try { this.controller.destroy(); } catch (e) {}
      this.controller = null;
    }
    this.root.innerHTML = '';
    this.root.inert = false;
    this.exterior.hidden = true;
    this.exteriorHud.hidden = true;
    this.root.hidden = false;
    if (this.toastStack) this.toastStack.innerHTML = '';
    document.body.classList.add('mode-active', 'mode-' + door);
    document.body.classList.toggle('is-3d', this.is3D);
    this.scene.showInterior(door === 'acute' ? 'wide' : 'consult');
    this.scene.setDoorHighlight(null);

    var api = {
      data: D,
      scene: this.scene,
      audio: this.audio,
      root: this.root,
      prefs: this.prefs,
      seed: seed,
      is3D: this.is3D,
      reducedMotion: this.reducedMotion(),
      showToast: this.showToast.bind(this),
      announce: this.announce.bind(this),
      requestExit: this.requestExit.bind(this),
      exitToExterior: this.exitToExterior.bind(this),
      toggleMute: this.toggleMute.bind(this),
      isMuted: function () { return this.prefs.muted; },
      refreshMute: this.updateMuteButtons.bind(this),
      isExitConfirmOpen: function () { return this.exitConfirm; }.bind(this)
    };

    if (door === 'acute') {
      this.controller = new global.QH_ACUTE.Game(api, seed);
    } else {
      this.controller = new global.QH_CHRONICLE.Game(api, seed);
    }
    this.controller.start();
    this.updateMuteButtons();
  };

  App.prototype.requestExit = function () {
    if (this.state !== 'activeMode' && this.state !== 'paused') return;
    if (!this.controller) return;
    this.audio.click();
    this.exitConfirm = true;
    if (this.controller.pauseForExit) this.controller.pauseForExit();
    this.root.inert = true;
    this.state = 'paused';
    var modeName = this.controller.mode === 'acute' ? '急症候' : '行医录';
    el('confirm-title').textContent = '现在出门？';
    el('confirm-text').textContent = '确认出门会结束本局并丢弃未完成的进度；取消会保留当前局面。' +
      (this.controller.mode === 'acute' ? '急症候在确认期间已暂停，取消后需点“继续今日”才恢复计时。' : '');
    el('confirm-stay').textContent = this.controller.mode === 'acute' ? '继续值班' : '继续坐堂';
    this.confirmModal.hidden = false;
    setTimeout(function () { el('confirm-stay').focus(); }, 30);
    this.announce(modeName + '已暂停，等待确认是否出门。');
  };

  App.prototype.cancelExit = function () {
    if (!this.exitConfirm) return;
    this.exitConfirm = false;
    this.confirmModal.hidden = true;
    this.root.inert = false;
    if (this.controller && this.controller.resumeAfterExitCancel) this.controller.resumeAfterExitCancel();
    this.state = 'activeMode';
    this.announce('已取消出门，继续本局。');
  };

  App.prototype.confirmExit = function () {
    if (!this.exitConfirm) return;
    this.exitConfirm = false;
    this.confirmModal.hidden = true;
    this.exitToExterior();
  };

  App.prototype.exitToExterior = function () {
    var self = this;
    if (this.transitioning) return Promise.resolve();
    if (!this.controller) {
      this.state = 'exterior';
      this.renderExterior();
      return Promise.resolve();
    }
    this.transitioning = true;
    this.state = 'transitioning';
    this.lastDoor = this.controller.mode;
    this.prefs.lastDoor = this.lastDoor;
    this.savePrefs();
    document.body.classList.add('is-transitioning');
    this.setOverlayMark('正在返回外景');
    if (this.controller.pauseForExit) this.controller.pauseForExit();

    var reduced = this.reducedMotion();
    var finish = function () {
      if (self.controller) {
        try { self.controller.destroy(); } catch (e) {}
        self.controller = null;
      }
      self.root.innerHTML = '';
      self.root.hidden = true;
      if (self.toastStack) self.toastStack.innerHTML = '';
      document.body.classList.remove('mode-chronicle', 'mode-acute', 'mode-active');
      self.renderExterior();
      self.overlay.classList.remove('is-covered');
      setTimeout(function () {
        self.transitioning = false;
        self.state = 'exterior';
        document.body.classList.remove('is-transitioning');
        self.announce('已返回双门外景。');
      }, reduced ? 120 : 380);
    };

    if (reduced) {
      this.overlay.classList.add('is-covered');
      return sleep(160).then(finish);
    }
    this.overlay.classList.add('is-covered');
    return sleep(260).then(finish);
  };

  /* 测试入口：不向普通界面暴露，供验收脚本直接挂载模式。 */
  App.prototype.testStart = function (door, seed) {
    if (this.controller) {
      try { this.controller.destroy(); } catch (e) {}
      this.controller = null;
    }
    this.testMode = true;
    this.exitConfirm = false;
    this.introBackdrop.hidden = true;
    this.confirmModal.hidden = true;
    document.body.classList.remove('intro-open');
    this.exterior.hidden = true;
    this.exteriorHud.hidden = true;
    this.root.hidden = false;
    document.body.classList.remove('mode-chronicle', 'mode-acute');
    document.body.classList.add('mode-active', 'mode-' + door);
    this.scene.showInterior(door === 'acute' ? 'wide' : 'consult');
    try {
      this.mountMode(door, seed);
      this.testMode = false;
      this.state = 'activeMode';
      return true;
    } catch (e) {
      this.testMode = false;
      throw e;
    }
  };

  function boot() {
    try {
      var app = new App();
      global.__QH_APP__ = app;
      global.QH_APP = app;
      document.body.classList.remove('boot');
    } catch (e) {
      document.body.classList.add('boot-error');
      var p = document.createElement('p');
      p.className = 'fatal';
      p.textContent = '游戏初始化失败：' + (e && e.message ? e.message : e);
      document.body.appendChild(p);
      if (global.console) console.error(e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof self !== 'undefined' ? self : this);
