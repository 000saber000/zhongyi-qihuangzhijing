/* 岐黄堂 v3 · 急症候（实时排程）
 * 三天十二单：候诊 → 药盘 → 3 秒加工 → 双锅火候 → 待交付碗 → 交付。
 * 所有业务时间只读 simTime；暂停/隐藏不累加。急症候不使用钱、库存与声望。
 */
(function (global) {
  'use strict';

  var D = global.QH_DATA;
  var EPS = 1e-9;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function herbLine(ids) {
    return ids.map(function (id) { return esc(D.herbName(id)); }).join('、');
  }

  function uid(prefix, n) { return prefix + n; }

  function Game(app, seed) {
    this.app = app;
    this.mode = 'acute';
    this.seed = seed >>> 0;
    this.schedule = D.makeAcuteSchedule(this.seed);
    this.root = app.root;
    this.modalOpen = false;
    this.frozen = false;
    this.destroyed = false;

    this.day = 0;
    this.phase = 'dayIntro';
    this.tab = 'waiting';
    this.dayResults = [];
    this.currentDayResult = null;
    this.pauseReason = null;
    this.dirty = false;
    this.bowlCounter = 0;
    this.lastWall = null;
    this.simTime = 0;
    this.orders = [];
    this.ordersById = {};
    this.nextOrderIndex = 0;
    this.lastArrivalAt = 0;
    this.selectedOrderId = null;
    this.selectedBowlId = null;
    this.tray = this.emptyTray();
    this.pots = [this.emptyPot(), this.emptyPot()];
    this.bowls = [];
    this.dayStats = this.emptyStats();

    this.bindEvents();
    this.startLoop();
  }

  Game.prototype.emptyTray = function () {
    return { state: 'empty', ownerId: null, herbs: [], processingEndsAt: null };
  };
  Game.prototype.emptyPot = function () {
    return { state: 'empty', ownerId: null, herbs: [], startedAt: null, cooldownUntil: null };
  };
  Game.prototype.emptyStats = function () {
    return { completed: 0, perfect: 0, left: 0, burned: 0, wrongDeliveries: 0, wrongMedicine: 0, score: 0 };
  };
  Game.prototype.resetDaily = function () {
    this.simTime = 0;
    this.orders = [];
    this.ordersById = {};
    this.nextOrderIndex = 0;
    this.lastArrivalAt = 0;
    this.selectedOrderId = null;
    this.selectedBowlId = null;
    this.tray = this.emptyTray();
    this.pots = [this.emptyPot(), this.emptyPot()];
    this.bowls = [];
    this.dayStats = this.emptyStats();
    this.currentDayResult = null;
    this.pauseReason = null;
    this.tab = 'waiting';
    this.dirty = false;
    this.bowlCounter = 0;
  };

  Game.prototype.start = function () {
    this.render();
  };

  /* ------------------------------------------------------------------ */
  /* 事件绑定与键盘                                                      */
  /* ------------------------------------------------------------------ */
  Game.prototype.bindEvents = function () {
    var self = this;
    this.onClick = function (e) {
      var t = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!t || !self.root.contains(t)) return;
      self.dispatch(t.getAttribute('data-act'), t.getAttribute('data-id'), t);
    };
    this.root.addEventListener('click', this.onClick);
    this.onKey = function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      if (self.root.querySelector('.modal-layer')) return;
      if (self.phase !== 'playing') return;
      var k = e.key.toLowerCase();
      if (k === 'a' || k === '1') { self.setTab('waiting'); e.preventDefault(); }
      else if (k === 's' || k === '2') { self.setTab('cabinet'); e.preventDefault(); }
      else if (k === 'd' || k === '3') { self.setTab('prep'); e.preventDefault(); }
    };
    document.addEventListener('keydown', this.onKey);
  };

  Game.prototype.dispatch = function (act, id, target) {
    if (this.destroyed) return;
    if (typeof this.app.isExitConfirmOpen === 'function' && this.app.isExitConfirmOpen()) return;
    var inputOrderId = this.selectedOrderId;
    this.app.audio.unlock();
    if (this.phase === 'paused') {
      if (act === 'mute') { this.app.toggleMute(); return; }
      if (act === 'journal' || act === 'help') { this.showJournal(); return; }
      if (act === 'exit') { this.app.requestExit(); return; }
      if (act === 'journal-close') { this.closeJournal(); return; }
      if (act === 'resume') { this.resume(); return; }
      this.app.showToast('已暂停：请先点“继续今日”。暂停期间不能取药、取锅或交付。', 'warn');
      return;
    }
    if (this.phase === 'playing' && act !== 'pause' && act !== 'exit' && act !== 'mute') {
      this.advanceForInput();
      if (this.maybeEndDay()) return;
    }
    switch (act) {
      case 'mute': this.app.toggleMute(); break;
      case 'journal': case 'help': this.showJournal(); break;
      case 'exit': this.app.requestExit(); break;
      case 'start-day': this.startDay(); break;
      case 'tab': this.setTab(id); break;
      case 'select-order': this.selectOrder(id); break;
      case 'herb-add': this.addHerb(id, inputOrderId); break;
      case 'tray-remove': this.removeHerb(id); break;
      case 'tray-clear': this.clearTray(); break;
      case 'start-processing': this.startProcessing(); break;
      case 'load-pot': this.loadPot(parseInt(id, 10)); break;
      case 'take-pot': this.takePot(parseInt(id, 10)); break;
      case 'select-bowl': this.selectBowl(id); break;
      case 'deliver-to': this.deliverTo(id); break;
      case 'pause': this.pause('button'); break;
      case 'resume': this.resume(); break;
      case 'journal-close': this.closeJournal(); break;
      case 'retry-day': this.retryDay(); break;
      case 'next-day': this.nextDay(); break;
      case 'ending-same': this.restart(this.seed); break;
      case 'ending-new': this.restart(D.randomSeed()); break;
      case 'ending-exit': this.app.exitToExterior(); break;
      default: break;
    }
  };

  /* ------------------------------------------------------------------ */
  /* 时间推进                                                            */
  /* ------------------------------------------------------------------ */
  Game.prototype.startLoop = function () {
    var self = this;
    this.running = true;
    this.lastWall = performance.now();
    function loop(now) {
      if (!self.running) return;
      self.tick(now);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  };

  Game.prototype.tick = function (now) {
    if (this.destroyed) return;
    if (this.phase === 'playing' && !document.hidden && !this.frozen) {
      var dt = (now - this.lastWall) / 1000;
      this.lastWall = now;
      if (dt < 0) dt = 0;
      if (dt > 0) this.advanceTo(this.simTime + dt);
      if (this.checkArrivals()) this.dirty = true;
      if (this.maybeEndDay()) return;
      if (this.dirty) {
        this.dirty = false;
        this.render();
      } else {
        this.updateLive();
      }
    } else {
      this.lastWall = now;
    }
  };

  Game.prototype.advanceForInput = function (force) {
    if (this.phase !== 'playing' || this.frozen) return;
    if (document.hidden && !force) return;
    var now = performance.now();
    var dt = (now - this.lastWall) / 1000;
    this.lastWall = now;
    if (dt > 0) this.advanceTo(this.simTime + dt);
  };

  Game.prototype.advanceTo = function (target) {
    if (target <= this.simTime) {
      if (target > this.simTime) this.simTime = target;
      return;
    }
    var guard = 0;
    while (this.simTime < target - EPS && guard++ < 20000) {
      var next = target;
      var i;
      for (i = 0; i < this.orders.length; i++) {
        var o = this.orders[i];
        if (o.status === 'waiting' && o.deadline > this.simTime + EPS && o.deadline < next) next = o.deadline;
      }
      for (i = 0; i < this.pots.length; i++) {
        var p = this.pots[i];
        if (p.state === 'cooking') {
          var burnAt = p.startedAt + D.CONST.BURN_AGE;
          if (burnAt > this.simTime + EPS && burnAt < next) next = burnAt;
        } else if (p.state === 'cooldown') {
          if (p.cooldownUntil > this.simTime + EPS && p.cooldownUntil < next) next = p.cooldownUntil;
        }
      }
      if (this.tray.state === 'processing') {
        var end = this.tray.processingEndsAt;
        if (end > this.simTime + EPS && end < next) next = end;
      }
      this.simTime = next;
      this.processEventsAt(this.simTime);
      if (next >= target - EPS) break;
    }
    this.simTime = target;
  };

  Game.prototype.processEventsAt = function (t) {
    var i;
    // 1. 到期病人离场（先于锅与加工）
    var leaving = this.orders.filter(function (o) {
      return o.status === 'waiting' && o.deadline <= t + EPS;
    }).sort(function (a, b) { return a.deadline - b.deadline || a.index - b.index; });
    for (i = 0; i < leaving.length; i++) {
      this.leaveOrder(leaving[i], t);
      this.dirty = true;
    }

    // 2. 锅到糊、冷却到期
    for (i = 0; i < this.pots.length; i++) {
      var p = this.pots[i];
      if (p.state === 'cooking' && p.startedAt + D.CONST.BURN_AGE <= t + EPS) {
        this.burnPot(i);
        this.dirty = true;
      } else if (p.state === 'cooldown' && p.cooldownUntil <= t + EPS) {
        this.pots[i] = this.emptyPot();
        this.dirty = true;
      }
    }

    // 3. 加工完成
    if (this.tray.state === 'processing' && this.tray.processingEndsAt <= t + EPS) {
      this.tray.state = 'processed';
      this.dirty = true;
      this.app.audio.pick();
    }
  };

  Game.prototype.burnPot = function (index) {
    var p = this.pots[index];
    if (!p || p.state !== 'cooking') return;
    var burnAt = p.startedAt + D.CONST.BURN_AGE;
    this.dayStats.burned++;
    p.state = 'cooldown';
    p.ownerId = null;
    p.herbs = [];
    p.startedAt = null;
    p.cooldownUntil = burnAt + D.CONST.BURN_COOLDOWN;
    this.app.audio.burn();
    this.app.announce('锅' + (index + 1) + ' 糊了，进入 5 秒冷却。');
  };

  Game.prototype.leaveOrder = function (order, t) {
    if (!order || order.status !== 'waiting') return;
    order.status = 'left';
    order.leftAt = t;
    this.dayStats.left++;
    var i;
    if (this.tray.ownerId === order.id) {
      this.tray = this.emptyTray();
    }
    for (i = 0; i < this.pots.length; i++) {
      var p = this.pots[i];
      if (p.state === 'cooking' && p.ownerId === order.id) {
        this.pots[i] = {
          state: 'cooldown', ownerId: null, herbs: [], startedAt: null,
          cooldownUntil: t + D.CONST.LEAVE_POT_COOLDOWN
        };
      }
      // 已因糊锅冷却的锅 ownerId 已清空，不延长也不缩短原冷却。
    }
    this.bowls = this.bowls.filter(function (b) { return b.ownerId !== order.id; });
    if (this.selectedBowlId && !this.bowls.some(function (b) { return b.id === this.selectedBowlId; }, this)) {
      this.selectedBowlId = null;
    }
    if (this.selectedOrderId === order.id) this.selectedOrderId = null;
    this.autoSelect();
    this.app.audio.alert();
  };

  Game.prototype.checkArrivals = function () {
    if (this.phase !== 'playing') return false;
    if (this.nextOrderIndex >= D.CONST.ORDERS_PER_DAY) return false;
    var waiting = this.waitingOrders();
    if (waiting.length >= 2) return false;
    if (this.nextOrderIndex > 0 && this.simTime - this.lastArrivalAt < D.CONST.ARRIVAL_INTERVAL - EPS) return false;
    this.spawnOrder(this.simTime);
    this.lastArrivalAt = this.simTime;
    return true;
  };

  Game.prototype.spawnOrder = function (t) {
    var def = this.schedule[this.day][this.nextOrderIndex];
    var order = {
      id: def.orderId,
      index: this.nextOrderIndex,
      seat: this.freeSeat(),
      shortCode: def.shortCode,
      name: def.name,
      outfit: def.outfit,
      formulaId: def.formulaId,
      patience: def.patience,
      arrivedAt: t,
      deadline: t + def.patience,
      status: 'waiting',
      quality: null,
      score: 0
    };
    this.orders.push(order);
    this.ordersById[order.id] = order;
    this.nextOrderIndex++;
    if (!this.selectedOrderId && this.tray.state === 'empty') this.selectedOrderId = order.id;
    this.dirty = true;
    this.app.audio.click();
    this.app.announce(order.name + ' 入座，配方 ' + D.formulaName(order.formulaId) + '。');
  };

  Game.prototype.waitingOrders = function () {
    return this.orders.filter(function (o) { return o.status === 'waiting'; })
      .sort(function (a, b) { return a.arrivedAt - b.arrivedAt || a.index - b.index; });
  };

  Game.prototype.freeSeat = function () {
    var used = {};
    this.orders.forEach(function (o) {
      if (o.status === 'waiting' && (o.seat === 0 || o.seat === 1)) used[o.seat] = true;
    });
    return used[0] ? 1 : 0;
  };

  Game.prototype.terminalCount = function () {
    return this.orders.filter(function (o) { return o.status !== 'waiting'; }).length;
  };

  /* ------------------------------------------------------------------ */
  /* 动作                                                                */
  /* ------------------------------------------------------------------ */
  Game.prototype.setTab = function (tab) {
    if (['waiting', 'cabinet', 'prep'].indexOf(tab) < 0) return;
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this.tab = tab;
    this.app.audio.click();
    this.render();
  };

  Game.prototype.hasActiveBatch = function (orderId) {
    if (!orderId) return false;
    if (this.tray.ownerId === orderId) return true;
    if (this.pots.some(function (p) { return p.ownerId === orderId && (p.state === 'cooking' || p.state === 'cooldown'); })) return true;
    return this.bowls.some(function (b) { return b.ownerId === orderId; });
  };

  Game.prototype.batchLocation = function (orderId) {
    if (this.tray.ownerId === orderId) {
      if (this.tray.state === 'processing') return '加工中';
      if (this.tray.state === 'processed') return '药盘（已加工）';
      return '药盘';
    }
    for (var i = 0; i < this.pots.length; i++) {
      if (this.pots[i].ownerId === orderId && this.pots[i].state === 'cooking') return '锅' + (i + 1);
    }
    if (this.bowls.some(function (b) { return b.ownerId === orderId; })) return '待交付架';
    return '无批次';
  };

  Game.prototype.autoSelect = function () {
    if (this.selectedOrderId) {
      var cur = this.ordersById[this.selectedOrderId];
      if (cur && cur.status === 'waiting') return;
      this.selectedOrderId = null;
    }
    if (this.tray.state !== 'empty') return;
    var list = this.waitingOrders();
    for (var i = 0; i < list.length; i++) {
      if (!this.hasActiveBatch(list[i].id)) { this.selectedOrderId = list[i].id; return; }
    }
  };

  Game.prototype.selectOrder = function (orderId) {
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    var order = this.ordersById[orderId];
    if (!order || order.status !== 'waiting') { this.app.showToast('该病人已不在场。', 'warn'); return; }
    if (this.tray.state !== 'empty' && this.selectedOrderId !== orderId) {
      this.app.showToast('药盘非空：请先完成当前批次或清空药盘，再切换配药对象。', 'warn');
      return;
    }
    if (this.hasActiveBatch(orderId) && this.selectedOrderId !== orderId) {
      this.app.showToast('该订单已有锅中或待交付批次，不能另开药盘。', 'warn');
      return;
    }
    this.selectedOrderId = orderId;
    this.app.audio.click();
    this.postAction();
  };

  Game.prototype.addHerb = function (id, orderId) {
    if (orderId === undefined) orderId = this.selectedOrderId;
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    if (!orderId) { this.app.showToast('请先在候诊区选定一张药笺。', 'warn'); return; }
    var order = this.ordersById[orderId];
    if (!order || order.status !== 'waiting' || this.selectedOrderId !== orderId) { this.app.showToast('原配药对象已离场，本次取药已取消。', 'warn'); this.postAction(); return; }
    if (this.hasActiveBatch(order.id) && this.tray.ownerId !== order.id) {
      this.app.showToast('该订单已有在制批次，不能重复配药。', 'warn');
      return;
    }
    if (this.tray.state === 'processing') { this.app.showToast('加工中，药盘不可改动。', 'warn'); return; }
    if (this.tray.state === 'processed') { this.app.showToast('已加工，请先入炉或清空重配。', 'warn'); return; }
    if (this.tray.state === 'empty') {
      this.tray.state = 'collecting';
      this.tray.ownerId = order.id;
      this.tray.herbs = [];
    }
    if (this.tray.ownerId !== order.id) { this.app.showToast('药盘归属其他病人，请先清空。', 'warn'); return; }
    if (this.tray.herbs.indexOf(id) >= 0) { this.app.showToast(D.herbName(id) + ' 已在药盘中；每种材料最多一张，重复点击不会增加。', 'warn'); return; }
    if (this.tray.herbs.length >= 6) { this.app.showToast('药盘最多六张材料。', 'warn'); return; }
    this.tray.herbs.push(id);
    this.app.audio.pick();
    if (this.app.scene) this.app.scene.nudgeDrawer(id);
    this.postAction();
  };

  Game.prototype.removeHerb = function (id) {
    if (this.phase !== 'playing') return;
    if (this.tray.state === 'processing') { this.app.showToast('加工中，药盘不可改动。', 'warn'); return; }
    if (this.tray.state === 'processed') { this.app.showToast('已加工，请先入炉或清空重配。', 'warn'); return; }
    var i = this.tray.herbs.indexOf(id);
    if (i >= 0) {
      this.tray.herbs.splice(i, 1);
      if (!this.tray.herbs.length) {
        this.tray.state = 'empty';
        this.tray.ownerId = null;
      }
      this.app.audio.click();
      this.postAction();
    }
  };

  Game.prototype.clearTray = function () {
    if (this.phase !== 'playing') return;
    if (this.tray.state === 'processing') { this.app.showToast('加工中不能清空；等待 3 秒完成后再处理。', 'warn'); return; }
    this.tray = this.emptyTray();
    this.app.audio.click();
    this.autoSelect();
    this.postAction();
  };

  Game.prototype.startProcessing = function () {
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    if (this.tray.state !== 'collecting') { this.app.showToast('药盘没有待加工批次。', 'warn'); return; }
    var order = this.ordersById[this.tray.ownerId];
    if (!order || order.status !== 'waiting') { this.app.showToast('配药对象已离场，批次已清空。', 'warn'); this.tray = this.emptyTray(); this.postAction(); return; }
    if (!this.tray.herbs.length) { this.app.showToast('药盘为空，先取至少一张材料。', 'warn'); return; }
    // 不再自动核对药笺：玩家选什么就煎什么，交付时才判定是否错药。
    this.tray.state = 'processing';
    this.tray.processingEndsAt = this.simTime + D.CONST.PROCESS_SECONDS;
    this.app.audio.click();
    this.postAction();
  };

  Game.prototype.loadPot = function (index) {
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    if (index !== 0 && index !== 1) return;
    if (this.tray.state !== 'processed') { this.app.showToast('只有加工完成的药盘才能入炉。', 'warn'); return; }
    var pot = this.pots[index];
    if (pot.state !== 'empty') { this.app.showToast('锅' + (index + 1) + ' 正忙，不能入炉。', 'warn'); return; }
    var order = this.ordersById[this.tray.ownerId];
    if (!order || order.status !== 'waiting') { this.app.showToast('订单已离场，批次已清空。', 'warn'); this.tray = this.emptyTray(); this.postAction(); return; }
    pot.state = 'cooking';
    pot.ownerId = order.id;
    pot.herbs = this.tray.herbs.slice();
    pot.startedAt = this.simTime;
    pot.cooldownUntil = null;
    this.tray = this.emptyTray();
    this.selectedOrderId = null;
    this.autoSelect();
    this.app.audio.click();
    this.postAction();
  };

  Game.prototype.takePot = function (index) {
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    var pot = this.pots[index];
    if (!pot || pot.state !== 'cooking') { this.app.showToast('这口锅当前不能取。', 'warn'); return; }
    var age = this.simTime - pot.startedAt;
    var stage = D.stewStage(age);
    if (!stage.takeable) { this.app.showToast('锅已糊，不能取出。', 'error'); return; }
    if (this.bowls.length >= 2) { this.app.showToast('待交付架已满，先交付再取锅；锅会继续煎。', 'warn'); return; }
    var order = this.ordersById[pot.ownerId];
    if (!order || order.status !== 'waiting') {
      this.pots[index] = {
        state: 'cooldown', ownerId: null, herbs: [], startedAt: null,
        cooldownUntil: this.simTime + D.CONST.LEAVE_POT_COOLDOWN
      };
      this.app.showToast('订单已离场，锅已清空。', 'warn');
      this.postAction();
      return;
    }
    var bowl = {
      id: uid('b', ++this.bowlCounter),
      ownerId: order.id,
      shortCode: order.shortCode,
      name: order.name,
      outfit: order.outfit,
      formulaId: order.formulaId,
      herbs: pot.herbs.slice(),
      quality: stage.key,
      qualityLabel: stage.label,
      score: stage.score
    };
    this.bowls.push(bowl);
    this.pots[index] = this.emptyPot();
    this.selectedBowlId = bowl.id;
    this.selectedOrderId = this.tray.state !== 'empty' ? this.tray.ownerId : null;
    this.autoSelect();
    if (stage.key === 'perfect') this.app.audio.perfect();
    else this.app.audio.pick();
    this.app.announce(order.name + ' 的药已取出，火候' + stage.label + '，' + stage.score + ' 分。');
    this.postAction();
  };

  Game.prototype.selectBowl = function (bowlId) {
    if (this.phase !== 'playing') return;
    var bowl = this.bowls.filter(function (b) { return b.id === bowlId; })[0];
    if (!bowl) return;
    this.selectedBowlId = bowlId;
    this.app.audio.click();
    this.postAction();
  };

  Game.prototype.deliverTo = function (orderId) {
    this.advanceForInput();
    if (this.phase !== 'playing') return;
    var order = this.ordersById[orderId];
    if (!order || order.status !== 'waiting') { this.app.showToast('该病人已不在场，交付无效。', 'warn'); return; }
    if (!this.selectedBowlId) { this.app.showToast('请先在待交付架选中一碗药。', 'warn'); return; }
    var idx = -1;
    for (var i = 0; i < this.bowls.length; i++) if (this.bowls[i].id === this.selectedBowlId) idx = i;
    if (idx < 0) { this.selectedBowlId = null; this.app.showToast('药碗已不在架上。', 'warn'); return; }
    var bowl = this.bowls[idx];

    if (bowl.ownerId === order.id) {
      var mm = D.matchHerbs(order.formulaId, bowl.herbs);
      if (!mm.ok) {
        // 错药：药碗被喝掉/倒掉，主人失去耐心，不得分；订单仍在候诊，可重配。
        order.deadline -= D.CONST.WRONG_MEDICINE_PENALTY;
        this.dayStats.wrongMedicine++;
        this.bowls.splice(idx, 1);
        this.selectedBowlId = null;
        this.app.audio.error();
        this.app.showToast('药汤与药笺不符：' + order.name + ' 耐心 -' + D.CONST.WRONG_MEDICINE_PENALTY + ' 秒，药碗已倒掉。', 'error');
        this.app.announce(order.name + ' 收到错误药汤，耐心下降。');
        if (order.deadline <= this.simTime + EPS) {
          this.leaveOrder(order, this.simTime);
        } else {
          this.autoSelect();
        }
        this.postAction();
        return;
      }
      order.status = 'completed';
      order.quality = bowl.quality;
      order.qualityLabel = bowl.qualityLabel;
      order.score = bowl.score;
      this.dayStats.completed++;
      if (bowl.score === 25) this.dayStats.perfect++;
      this.dayStats.score += bowl.score;
      this.bowls.splice(idx, 1);
      this.selectedBowlId = null;
      this.selectedOrderId = this.tray.state !== 'empty' ? this.tray.ownerId : null;
      this.autoSelect();
      this.app.audio.deliver();
      this.app.announce(order.name + ' 的 ' + D.formulaName(order.formulaId) + ' 已交付，' + bowl.score + ' 分。');
      this.postAction();
      return;
    }

    // 送错：碗保留，只有被点错的在场病人 deadline -5 秒。
    order.deadline -= D.CONST.WRONG_PATIENCE_PENALTY;
    this.dayStats.wrongDeliveries++;
    this.app.audio.error();
    this.app.showToast('送错给 ' + order.name + '：耐心 -5 秒，药碗仍在架上。', 'error');
    if (order.deadline <= this.simTime + EPS) {
      this.leaveOrder(order, this.simTime);
    }
    this.postAction();
  };

  Game.prototype.postAction = function () {
    if (this.phase !== 'playing') { this.render(); return; }
    this.checkArrivals();
    if (this.maybeEndDay()) return;
    this.render();
  };

  /* ------------------------------------------------------------------ */
  /* 暂停、日结、终局                                                    */
  /* ------------------------------------------------------------------ */
  Game.prototype.pause = function (reason) {
    if (this.phase !== 'playing') return;
    this.advanceForInput(true);
    this.checkArrivals();
    this.phase = 'paused';
    this.pauseReason = reason || 'button';
    this.lastWall = performance.now();
    this.render();
    this.app.announce('急症候已暂停。');
  };

  Game.prototype.resume = function () {
    if (typeof this.app.isExitConfirmOpen === 'function' && this.app.isExitConfirmOpen()) return;
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.pauseReason = null;
    this.lastWall = performance.now();
    this.app.audio.click();
    this.render();
    this.app.announce('继续今日。');
  };

  Game.prototype.pauseForExit = function () {
    if (this.phase === 'playing') this.pause('exit');
    else if (this.phase === 'paused') this.render();
  };

  Game.prototype.resumeAfterExitCancel = function () {
    if (this.phase === 'paused') {
      this.pauseReason = 'exit-cancel';
      this.render();
    }
  };

  Game.prototype.onVisibilityHidden = function () {
    if (this.phase === 'playing') this.pause('visibility');
  };
  Game.prototype.onVisibilityVisible = function () {
    // 保持暂停，必须显式点继续。
  };

  Game.prototype.startDay = function () {
    if (this.phase !== 'dayIntro') return;
    this.resetDaily();
    this.phase = 'playing';
    this.lastWall = performance.now();
    this.spawnOrder(0);
    this.lastArrivalAt = 0;
    this.app.audio.door();
    this.render();
    this.app.announce('第 ' + (this.day + 1) + ' 天开始，第一位病人已入座。');
  };

  Game.prototype.retryDay = function () {
    if (this.phase !== 'dayEnd') return;
    this.resetDaily();
    this.phase = 'playing';
    this.lastWall = performance.now();
    this.spawnOrder(0);
    this.lastArrivalAt = 0;
    this.app.audio.click();
    this.render();
    this.app.announce('已重试第 ' + (this.day + 1) + ' 天，日程与姓名不变。');
  };

  Game.prototype.maybeEndDay = function () {
    if (this.phase !== 'playing') return false;
    if (this.nextOrderIndex < D.CONST.ORDERS_PER_DAY) return false;
    if (this.orders.length < D.CONST.ORDERS_PER_DAY) return false;
    if (this.orders.some(function (o) { return o.status === 'waiting'; })) return false;
    this.finishDay();
    return true;
  };

  Game.prototype.finishDay = function () {
    this.phase = 'dayEnd';
    this.selectedBowlId = null;
    this.selectedOrderId = null;
    var stars = D.starRating(this.dayStats.completed, this.dayStats.perfect);
    this.currentDayResult = {
      day: this.day + 1,
      score: this.dayStats.score,
      completed: this.dayStats.completed,
      perfect: this.dayStats.perfect,
      left: this.dayStats.left,
      burned: this.dayStats.burned,
      wrongDeliveries: this.dayStats.wrongDeliveries,
      wrongMedicine: this.dayStats.wrongMedicine,
      stars: stars,
      orders: this.orders.slice().sort(function (a, b) { return a.index - b.index; }).map(function (o) {
        return {
          shortCode: o.shortCode, name: o.name, formulaId: o.formulaId,
          status: o.status, quality: o.quality, qualityLabel: o.qualityLabel, score: o.score
        };
      })
    };
    this.app.audio.success();
    this.render();
    this.app.announce('第 ' + (this.day + 1) + ' 天结束，获得 ' + this.dayStats.score + ' 分。');
  };

  Game.prototype.nextDay = function () {
    if (this.phase !== 'dayEnd') return;
    this.dayResults[this.day] = this.currentDayResult;
    if (this.day < D.CONST.DAYS - 1) {
      this.day++;
      this.resetDaily();
      this.phase = 'dayIntro';
      this.app.audio.click();
      this.render();
    } else {
      this.phase = 'ending';
      this.render();
      this.app.announce('三日总评。');
    }
  };

  Game.prototype.totalScore = function () {
    return this.dayResults.reduce(function (n, r) { return n + (r ? r.score : 0); }, 0);
  };

  Game.prototype.restart = function (seed) {
    this.seed = seed >>> 0;
    this.schedule = D.makeAcuteSchedule(this.seed);
    this.app.seed = this.seed;
    this.day = 0;
    this.dayResults = [];
    this.currentDayResult = null;
    this.resetDaily();
    this.phase = 'dayIntro';
    this.closeJournal();
    this.render();
    this.app.showToast('新的一局已开始，种子 ' + this.seed + '。');
  };

  /* ------------------------------------------------------------------ */
  /* 渲染                                                                */
  /* ------------------------------------------------------------------ */
  Game.prototype.render = function () {
    if (!this.root || this.destroyed) return;
    var body;
    if (this.phase === 'dayIntro') body = this.viewDayIntro();
    else if (this.phase === 'dayEnd') body = this.viewDayEnd();
    else if (this.phase === 'ending') body = this.viewEnding();
    else body = this.viewPlaying();
    var pause = this.phase === 'paused' ? this.viewPause() : '';
    this.root.innerHTML = '<div class="game-shell acute-shell">' + this.hud() + this.liveStrip() + body + pause + '</div>';
    if (this.app.refreshMute) this.app.refreshMute();
    this.syncScene();
    this.updateLive();
  };

  Game.prototype.hud = function () {
    var processed = this.terminalCount();
    var pauseBtn = '';
    if (this.phase === 'playing') pauseBtn = '<button type="button" class="btn ghost small" data-act="pause">暂停</button>';
    else if (this.phase === 'paused') pauseBtn = '<button type="button" class="btn primary small" data-act="resume">继续今日</button>';
    return '' +
      '<header class="game-hud">' +
        '<div class="hud-left">' +
          '<span class="hud-brand">岐黄堂 · 急症候</span>' +
          '<span class="hud-chip">第 ' + (this.day + 1) + ' 天</span>' +
        '</div>' +
        '<div class="hud-stats">' +
          '<span class="stat">今日分数 <b>' + this.dayStats.score + '</b></span>' +
          '<span class="stat">已处理 <b>' + processed + ' / 4</b></span>' +
          '<span class="stat muted">种子 ' + this.seed + '</span>' +
        '</div>' +
        '<div class="hud-actions">' +
          pauseBtn +
          '<button type="button" class="btn ghost small mute-btn" data-act="mute">静音：关</button>' +
          '<button type="button" class="btn ghost small" data-act="journal">玩法手札</button>' +
          '<button type="button" class="btn ghost small" data-act="exit">出门</button>' +
        '</div>' +
      '</header>';
  };

  Game.prototype.viewDayIntro = function () {
    var total = this.totalScore();
    return '' +
      '<section class="phase-body center-phase">' +
        '<div class="paper-panel day-card">' +
          '<p class="eyebrow">急症候 · 第 ' + (this.day + 1) + ' 天</p>' +
          '<h2>今日四人 · 看方取药</h2>' +
          '<p class="day-line">每位病人耐心 <b>' + D.CONST.PATIENCE[this.day] + ' 秒</b>。同时最多两位候诊、两口锅、一个 3 秒加工位。</p>' +
          '<p class="day-line subtle">药笺已给出方名与全部材料。按 orderId 归属，同方不同人也不会混淆。</p>' +
          '<div class="coach-row">' +
            '<span class="coach"><b>已确认总分</b> ' + total + ' / 300</span>' +
            '<span class="coach"><b>今日订单</b> 4</span>' +
            '<span class="coach"><b>满分</b> 100</span>' +
          '</div>' +
          '<button type="button" class="btn primary large" data-act="start-day">开始今日</button>' +
          '<p class="tiny center">点击后才开始计时；暂停、切后台、看手札都不走时。</p>' +
        '</div>' +
      '</section>';
  };

  Game.prototype.liveStrip = function () {
    if (this.phase !== 'playing' && this.phase !== 'paused') return '';
    var waiting = this.waitingOrders();
    var self = this;
    var patientCells = '';
    for (var s = 0; s < 2; s++) {
      var o = waiting[s];
      if (o) {
        patientCells += '' +
          '<div class="live-patient" data-patience="' + o.id + '">' +
            '<div class="live-line"><span class="live-name">' + esc(o.name) + '</span>' +
              '<span class="live-label">' + esc(o.shortCode) + ' · ' + esc(D.formulaName(o.formulaId)) + '</span>' +
              '<b class="live-remain" data-remain-for="' + o.id + '">--</b></div>' +
            '<div class="bar"><i class="fill" data-fill-for="' + o.id + '"></i></div>' +
          '</div>';
      } else {
        patientCells += '<div class="live-patient empty"><span>候诊空位</span></div>';
      }
    }
    var pots = '';
    for (var i = 0; i < 2; i++) {
      pots += '<div class="live-pot" data-pot="' + i + '">' +
        '<span class="pot-name">锅' + (i + 1) + '</span>' +
        '<span class="pot-state" data-pot-state="' + i + '">空</span>' +
        '<span class="pot-remain" data-pot-remain="' + i + '"></span>' +
      '</div>';
    }
    return '<div class="live-strip"><div class="live-patients">' + patientCells + '</div><div class="live-pots">' + pots + '</div></div>';
  };

  Game.prototype.viewPlaying = function () {
    var tabs = [
      { id: 'waiting', label: '候诊', key: 'A / 1' },
      { id: 'cabinet', label: '药柜', key: 'S / 2' },
      { id: 'prep', label: '炮制', key: 'D / 3' }
    ].map(function (t) {
      return '<button type="button" class="tab-btn' + (this.tab === t.id ? ' is-active' : '') + '" data-act="tab" data-id="' + t.id + '" role="tab" aria-selected="' + (this.tab === t.id) + '">' +
        esc(t.label) + '<span>' + t.key + '</span></button>';
    }, this).join('');

    var panel = '';
    if (this.tab === 'waiting') panel = this.viewWaiting();
    else if (this.tab === 'cabinet') panel = this.viewCabinet();
    else panel = this.viewPrep();

    return '' +
      '<section class="phase-body acute-body">' +
        '<div class="tab-bar">' + tabs + '</div>' +
        panel +
      '</section>';
  };

  Game.prototype.viewWaiting = function () {
    var waiting = this.waitingOrders();
    var cards = waiting.length ? waiting.map(function (o) {
      var selected = o.id === this.selectedOrderId;
      var batch = this.batchLocation(o.id);
      var disabledSelect = this.hasActiveBatch(o.id) && !selected;
      return '' +
        '<article class="order-card' + (selected ? ' is-selected' : '') + '" data-order-card="' + o.id + '">' +
          '<div class="order-head">' +
            '<div><span class="order-code">' + esc(o.shortCode) + '</span>' +
              '<h3>' + esc(o.name) + ' <span class="visitor">来访者</span></h3></div>' +
            (selected ? '<span class="select-badge">已选定</span>' : '') +
          '</div>' +
          '<p class="order-formula">药笺：<b>' + esc(D.formulaName(o.formulaId)) + '</b></p>' +
          '<p class="order-herbs">' + herbLine(D.formulaHerbIds(o.formulaId)) + '</p>' +
          '<div class="patience" data-patience="' + o.id + '">' +
            '<div class="bar"><i class="fill" data-fill-for="' + o.id + '"></i></div>' +
            '<div class="patience-line"><span>耐心 <b data-remain-for="' + o.id + '">--</b> 秒</span>' +
              '<span>批次：' + esc(batch) + '</span></div>' +
          '</div>' +
          '<div class="order-actions">' +
            '<button type="button" class="btn small' + (selected ? ' primary' : '') + '" data-act="select-order" data-id="' + o.id + '"' +
              (disabledSelect ? ' aria-disabled="true"' : '') + '>' + (selected ? '已选此药笺' : '选此药笺配药') + '</button>' +
            '<button type="button" class="btn small" data-act="deliver-to" data-id="' + o.id + '"' + (this.selectedBowlId ? '' : ' aria-disabled="true"') + '>交给此人</button>' +
          '</div>' +
        '</article>';
    }, this).join('') : '<div class="paper-panel empty-panel">候诊区暂时无人。订单会在距上次实际入场至少 12 秒后逐个进入；门外等待者不计耐心。</div>';

    return '<div class="panel-grid waiting-grid">' + cards + '</div>' +
      '<p class="tiny panel-note">点击 3D 病人也可选定药笺；选中待交付碗后，点病人即为交付。空座位点击不会扣任何人耐心。</p>';
  };

  Game.prototype.selectedOrder = function () {
    return this.selectedOrderId ? this.ordersById[this.selectedOrderId] : null;
  };

  Game.prototype.viewCabinet = function () {
    var order = this.selectedOrder();
    var self = this;
    var target = order && order.status === 'waiting'
      ? '<div class="target-banner"><span>目标药笺</span><b>' + esc(order.name) + ' · ' + esc(order.shortCode) + '</b><span>' + esc(D.formulaName(order.formulaId)) + '</span><span class="target-herbs">' + herbLine(D.formulaHerbIds(order.formulaId)) + '</span></div>'
      : '<div class="target-banner warn"><span>尚未选定药笺</span><span>请先到候诊区点击病人卡片。</span></div>';

    var herbs = D.HERBS.map(function (h) {
      var inTray = this.tray.herbs.indexOf(h.id) >= 0;
      return '<button type="button" class="herb-tile' + (inTray ? ' in-tray' : '') + '" data-act="herb-add" data-id="' + h.id + '"' +
        (this.tray.state === 'processing' ? ' aria-disabled="true"' : '') + '>' +
        '<span class="herb-tile-name">' + esc(h.name) + '</span>' +
        '<span class="herb-tile-meta">' + (inTray ? '已在药盘' : '无限取用') + '</span>' +
      '</button>';
    }, this).join('');

    var tray = this.tray.herbs.length
      ? this.tray.herbs.map(function (id) {
          return '<span class="tray-chip">' + esc(D.herbName(id)) +
            '<button type="button" class="chip-x" data-act="tray-remove" data-id="' + id + '" aria-label="移除' + esc(D.herbName(id)) + '">×</button></span>';
        }).join('')
      : '<span class="tray-empty">药盘为空。选药笺后取药。</span>';

    var processBox;
    if (this.tray.state === 'empty') {
      processBox = '<p class="process-hint">药盘为空。先从抽屉或材料格取药。</p>';
    } else if (this.tray.state === 'collecting') {
      processBox = '<button type="button" class="btn primary large" data-act="start-processing">开始加工 · 固定 3 秒</button>' +
        '<button type="button" class="btn ghost" data-act="tray-clear">清空重配</button>';
    } else if (this.tray.state === 'processing') {
      processBox = '<div class="process-live"><span>加工中</span><b data-processing-remain>--</b><span>秒</span></div>' +
        '<p class="tiny">加工中不能改药盘，但可以切区、取锅、交付其他订单。</p>';
    } else {
      processBox = '<p class="process-hint done">已加工完成：去“炮制”选择空锅，一键入炉并点火。</p>' +
        '<button type="button" class="btn primary" data-act="tab" data-id="prep">去炮制台</button>' +
        '<button type="button" class="btn ghost" data-act="tray-clear">清空重配</button>';
    }

    return '' +
      '<div class="panel-grid cabinet-grid">' +
        '<section class="paper-panel cabinet-panel">' +
          target +
          '<div class="panel-head"><h3>材料格 · 无限供应</h3><span class="tiny">每种最多一张，最多六张</span></div>' +
          '<div class="herb-tiles">' + herbs + '</div>' +
        '</section>' +
        '<aside class="paper-panel tray-panel">' +
          '<div class="panel-head"><h3>药盘 · ' + this.tray.herbs.length + ' / 6</h3><span class="tiny">' + esc(this.tray.state) + '</span></div>' +
          '<div class="tray-list">' + tray + '</div>' +
          '<div class="process-box">' + processBox + '</div>' +
          '<p class="tiny">材料名称与目标药笺常显；选什么就煎什么，交付时才核对药汤。</p>' +
        '</aside>' +
      '</div>';
  };

  Game.prototype.viewPrep = function () {
    var tray = this.tray;
    var order = tray.ownerId ? this.ordersById[tray.ownerId] : null;
    var trayLine = order
      ? '<b>' + esc(order.name) + ' · ' + esc(order.shortCode) + '</b> · ' + esc(D.formulaName(order.formulaId)) +
        ' · ' + (tray.herbs.length ? herbLine(tray.herbs) : '无材料')
      : '药盘为空';
    var stateText = { empty: '空', collecting: '配药中', processing: '加工中', processed: '已加工' }[tray.state] || tray.state;

    var loadBtns = '';
    if (tray.state === 'processed') {
      loadBtns = '<div class="load-row">' +
        [0, 1].map(function (i) {
          var p = this.pots[i];
          return '<button type="button" class="btn' + (p.state === 'empty' ? ' primary' : ' ghost') + '" data-act="load-pot" data-id="' + i + '"' +
            (p.state === 'empty' ? '' : ' aria-disabled="true"') + '>入锅' + (i + 1) + '并点火</button>';
        }, this).join('') + '</div>';
    }

    var potCards = this.pots.map(function (p, i) {
      var status;
      if (p.state === 'empty') status = '空锅';
      else if (p.state === 'cooldown') status = '冷却';
      else status = '煎煮中';
      var owner = p.ownerId ? this.ordersById[p.ownerId] : null;
      var info = '';
      if (p.state === 'cooking') {
        var age = this.simTime - p.startedAt;
        var st = D.stewStage(age);
        info = '<div class="pot-detail" data-pot-detail="' + i + '">' +
          '<span>主人：' + esc(owner ? owner.name + ' · ' + owner.shortCode : '—') + '</span>' +
          '<span>锅龄 <b data-pot-age="' + i + '">' + age.toFixed(1) + '</b> 秒</span>' +
          '<span>火候 <b data-pot-stage="' + i + '">' + st.label + '</b>（取出 <b data-pot-score="' + i + '">' + st.score + '</b> 分）</span>' +
          '<span>距糊 <b data-pot-burn="' + i + '">' + Math.max(0, D.CONST.BURN_AGE - age).toFixed(1) + '</b> 秒</span>' +
        '</div>';
      } else if (p.state === 'cooldown') {
        info = '<div class="pot-detail"><span>冷却中，剩余 <b data-pot-cool="' + i + '">' + Math.max(0, p.cooldownUntil - this.simTime).toFixed(1) + '</b> 秒</span></div>';
      } else {
        info = '<div class="pot-detail"><span>可接收已加工药盘</span></div>';
      }
      var btn = '';
      if (p.state === 'cooking') btn = '<button type="button" class="btn small" data-act="take-pot" data-id="' + i + '">取锅盛碗</button>';
      return '<article class="pot-card" data-pot-card="' + i + '">' +
        '<div class="pot-head"><h3>锅 ' + (i + 1) + '</h3><span class="pot-status ' + p.state + '">' + status + '</span></div>' +
        info + btn +
      '</article>';
    }, this).join('');

    var bowls = '';
    for (var i = 0; i < 2; i++) {
      var b = this.bowls[i];
      if (!b) {
        bowls += '<div class="bowl-slot empty"><span>待交付空位</span></div>';
        continue;
      }
      var selected = b.id === this.selectedBowlId;
      bowls += '<article class="bowl-card' + (selected ? ' is-selected' : '') + '">' +
        '<div class="bowl-head"><b>' + esc(b.name) + '</b><span class="order-code">' + esc(b.shortCode) + '</span></div>' +
        '<p>' + esc(D.formulaName(b.formulaId)) + ' · 火候 <b>' + esc(b.qualityLabel) + '</b> · ' + b.score + ' 分</p>' +
        '<p class="tiny">碗中材料：' + (b.herbs.length ? herbLine(b.herbs) : '无') + '</p>' +
        (selected ? '<span class="select-badge">已选中</span>' : '') +
        '<button type="button" class="btn small' + (selected ? ' primary' : '') + '" data-act="select-bowl" data-id="' + b.id + '">' + (selected ? '已选中此碗' : '选中此碗') + '</button>' +
        (selected ? '<div class="bowl-deliver">' + this.waitingOrders().map(function (o) {
          return '<button type="button" class="btn small primary" data-act="deliver-to" data-id="' + o.id + '">交给 ' + esc(o.name) + '</button>';
        }).join('') + '</div>' : '') +
      '</article>';
    }

    return '' +
      '<div class="panel-grid prep-grid">' +
        '<section class="paper-panel prep-panel">' +
          '<div class="panel-head"><h3>加工与入炉</h3><span class="tiny">药盘：' + stateText + '</span></div>' +
          '<p class="prep-tray">' + trayLine + '</p>' +
          loadBtns +
          (tray.state === 'collecting' || tray.state === 'processed' ? '<button type="button" class="btn ghost small" data-act="tray-clear">清空重配</button>' : '') +
          '<p class="tiny">入炉与点火合并为一次操作；两个锅独立计时，互不覆盖。</p>' +
        '</section>' +
        '<section class="paper-panel pots-panel">' +
          '<div class="panel-head"><h3>两口锅</h3><span class="tiny">生 5 · 温 15 · 完美 25 · 过 5 · 16 秒糊</span></div>' +
          '<div class="pot-list">' + potCards + '</div>' +
        '</section>' +
        '<aside class="paper-panel bowls-panel">' +
          '<div class="panel-head"><h3>待交付架</h3><span class="tiny">最多两碗</span></div>' +
          '<div class="bowl-slots">' + bowls + '</div>' +
          '<p class="tiny">先选碗，再点“交给此人”。送错人：对方耐心 -5 秒，碗保留；药汤与药笺不符：主人耐心 -10 秒，碗倒掉。</p>' +
        '</aside>' +
      '</div>';
  };

  Game.prototype.viewPause = function () {
    var reasonText = {
      button: '你按下了暂停。',
      journal: '查看手札时暂停。',
      visibility: '页面已切到后台，计时已冻结。',
      exit: '出门确认期间暂停。',
      'exit-cancel': '已取消出门，本局保持暂停。'
    }[this.pauseReason] || '本局已暂停。';
    return '' +
      '<div class="modal-layer pause-layer">' +
        '<section class="paper-panel pause-panel" role="dialog" aria-modal="true" aria-label="已暂停">' +
          '<p class="eyebrow">急症候 · 已暂停</p>' +
          '<h2>计时已冻结</h2>' +
          '<p>' + esc(reasonText) + '病人的耐心、锅、冷却和加工都不会推进。</p>' +
          '<p class="tiny">暂停期间不能取药、取锅或交付；可以静音、查看手札或出门。</p>' +
          '<button type="button" class="btn primary large" data-act="resume">继续今日</button>' +
        '</section>' +
      '</div>';
  };

  Game.prototype.viewDayEnd = function () {
    var r = this.currentDayResult;
    if (!r) return '';
    var stars = '★★★'.slice(0, r.stars) + '☆☆☆'.slice(0, 3 - r.stars);
    var rows = r.orders.map(function (o) {
      var status = o.status === 'completed' ? '完成' : '离场';
      return '<tr><td>' + esc(o.shortCode) + '</td><td>' + esc(o.name) + '</td><td>' + esc(D.formulaName(o.formulaId)) + '</td>' +
        '<td>' + status + '</td><td>' + (o.status === 'completed' ? esc(o.qualityLabel || o.quality || '') : '—') + '</td>' +
        '<td>' + (o.status === 'completed' ? o.score : 0) + '</td></tr>';
    }).join('');
    return '' +
      '<section class="phase-body center-phase">' +
        '<div class="paper-panel day-card wide-card">' +
          '<p class="eyebrow">第 ' + (this.day + 1) + ' 天 · 日结算</p>' +
          '<h2>本日得分 <b class="score-big">' + r.score + '</b> / 100</h2>' +
          '<p class="stars" aria-label="' + r.stars + ' 星">' + stars + '</p>' +
          '<div class="day-stats">' +
            '<span>完成 <b>' + r.completed + '</b></span>' +
            '<span>完美 <b>' + r.perfect + '</b></span>' +
            '<span>离场 <b>' + r.left + '</b></span>' +
            '<span>糊锅 <b>' + r.burned + '</b></span>' +
            '<span>送错 <b>' + r.wrongDeliveries + '</b></span>' +
            '<span>错药 <b>' + (r.wrongMedicine || 0) + '</b></span>' +
          '</div>' +
          '<table class="result-table"><thead><tr><th>单号</th><th>来访者</th><th>方剂</th><th>结果</th><th>火候</th><th>分</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          '<div class="intro-actions">' +
            '<button type="button" class="btn" data-act="retry-day">重试今天</button>' +
            '<button type="button" class="btn primary" data-act="next-day">' + (this.day < D.CONST.DAYS - 1 ? '下一天' : '查看总评') + '</button>' +
          '</div>' +
          '<p class="tiny center">重试使用同一日程、姓名与顺序，重置本日临时状态；已确认的前几日结果保留。</p>' +
        '</div>' +
      '</section>';
  };

  Game.prototype.viewEnding = function () {
    var total = this.totalScore();
    var days = this.dayResults.map(function (r, i) {
      if (!r) return '<li class="unmet"><span>第 ' + (i + 1) + ' 天</span><b>未结算</b></li>';
      return '<li><span>第 ' + (i + 1) + ' 天 · ' + '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) + '</span>' +
        '<b>' + r.score + ' 分</b><span class="tiny">完成 ' + r.completed + ' · 完美 ' + r.perfect + ' · 离场 ' + r.left + '</span></li>';
    }).join('');
    return '' +
      '<section class="phase-body center-phase">' +
        '<div class="paper-panel day-card wide-card">' +
          '<p class="eyebrow">急症候 · 三日总评</p>' +
          '<h2 class="rank">本局总分 <b class="score-big">' + total + '</b> / 300</h2>' +
          '<ul class="day-results">' + days + '</ul>' +
          '<p class="tiny">每日最高 100 分。日结算确认后才计入总分，重试不会留下失败记录。</p>' +
          '<div class="ending-actions">' +
            '<button type="button" class="btn" data-act="ending-same">同种子重玩</button>' +
            '<button type="button" class="btn" data-act="ending-new">新种子重玩</button>' +
            '<button type="button" class="btn ghost" data-act="ending-exit">返回双门</button>' +
          '</div>' +
          '<p class="tiny center">种子 ' + this.seed + '。本作不设排行榜与账号，刷新后重新开始。</p>' +
        '</div>' +
      '</section>';
  };

  /* ------------------------------------------------------------------ */
  /* 实时小更新                                                          */
  /* ------------------------------------------------------------------ */
  Game.prototype.updateLive = function () {
    if (!this.root) return;
    var t = this.simTime;
    var waiting = this.waitingOrders();
    var map = {};
    waiting.forEach(function (o) { map[o.id] = o; });
    Array.prototype.forEach.call(this.root.querySelectorAll('[data-patience]'), function (node) {
      var id = node.getAttribute('data-patience');
      var o = map[id];
      if (!o) return;
      var remain = Math.max(0, o.deadline - t);
      var pct = Math.max(0, Math.min(100, remain / o.patience * 100));
      var fill = node.querySelector('[data-fill-for="' + id + '"]');
      if (fill) fill.style.width = pct.toFixed(2) + '%';
      Array.prototype.forEach.call(node.querySelectorAll('[data-remain-for="' + id + '"]'), function (el) {
        el.textContent = remain.toFixed(1);
      });
      node.classList.toggle('is-urgent', remain <= 15);
    });

    for (var i = 0; i < this.pots.length; i++) {
      var p = this.pots[i];
      var stateEl = this.root.querySelector('[data-pot-state="' + i + '"]');
      var remEl = this.root.querySelector('[data-pot-remain="' + i + '"]');
      var stateText = '空';
      var remText = '';
      if (p.state === 'cooking') {
        var age = t - p.startedAt;
        var st = D.stewStage(age);
        stateText = st.label;
        remText = '距糊 ' + Math.max(0, D.CONST.BURN_AGE - age).toFixed(1) + 's';
      } else if (p.state === 'cooldown') {
        stateText = '冷却';
        remText = Math.max(0, p.cooldownUntil - t).toFixed(1) + 's';
      }
      if (stateEl) { stateEl.textContent = stateText; stateEl.className = 'pot-state ' + (p.state === 'cooking' ? (D.stewStage(t - p.startedAt).key) : p.state); }
      if (remEl) remEl.textContent = remText;
      if (p.state === 'cooking') {
        var ageEl = this.root.querySelector('[data-pot-age="' + i + '"]');
        var stageEl = this.root.querySelector('[data-pot-stage="' + i + '"]');
        var scoreEl = this.root.querySelector('[data-pot-score="' + i + '"]');
        var burnEl = this.root.querySelector('[data-pot-burn="' + i + '"]');
        var st2 = D.stewStage(t - p.startedAt);
        if (ageEl) ageEl.textContent = (t - p.startedAt).toFixed(1);
        if (stageEl) stageEl.textContent = st2.label;
        if (scoreEl) scoreEl.textContent = st2.score;
        if (burnEl) burnEl.textContent = Math.max(0, D.CONST.BURN_AGE - (t - p.startedAt)).toFixed(1);
      }
      if (p.state === 'cooldown') {
        var coolEl = this.root.querySelector('[data-pot-cool="' + i + '"]');
        if (coolEl) coolEl.textContent = Math.max(0, p.cooldownUntil - t).toFixed(1);
      }
    }

    if (this.tray.state === 'processing') {
      var proc = this.root.querySelector('[data-processing-remain]');
      if (proc) proc.textContent = Math.max(0, this.tray.processingEndsAt - t).toFixed(1);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 手札、场景、生命周期                                                */
  /* ------------------------------------------------------------------ */
  Game.prototype.showJournal = function () {
    if (this.phase === 'playing') this.pause('journal');
    var cards = D.FORMULA_LIST.map(function (f) {
      return '<article class="journal-card"><h3>' + esc(f.name) + '</h3>' +
        '<p class="journal-short">' + esc(f.short) + '</p>' +
        '<p class="journal-herbs">' + herbLine(f.herbs) + '</p>' +
        '<p class="tiny">' + esc(f.note) + '</p></article>';
    }).join('');
    var layer = document.createElement('div');
    layer.className = 'modal-layer journal-layer';
    layer.innerHTML = '' +
      '<section class="paper-panel journal-panel" role="dialog" aria-modal="true" aria-label="急症候玩法手札">' +
        '<div class="panel-head"><div><p class="eyebrow">急症候 · 玩法手札</p><h2>规则与药笺</h2></div>' +
          '<button type="button" class="icon-btn" data-act="journal-close" aria-label="关闭手札">×</button></div>' +
        '<ol class="help-list">' +
          '<li>每位病人耐心：第 1/2/3 天分别为 90 / 80 / 70 秒。离场即失败，不扣额外分。</li>' +
          '<li>先点药笺选定配药对象，再取药。药盘每种最多一张、最多六张。选什么就煎什么，交付时才核对是否错药。</li>' +
          '<li>加工固定 3 秒，期间不能改药盘，但可以切区或处理其他订单。</li>' +
          '<li>加工完成后点空锅“一键入炉并点火”。两口锅独立煎煮：0～5 秒生（5 分）、5～8 秒温（15 分）、8～13 秒完美（25 分）、13～16 秒过（5 分）、16 秒糊。</li>' +
          '<li>取锅需要待交付架有空位。先选碗，再点“交给此人”；送错人只扣被点错病人 5 秒耐心，碗保留；药汤与药笺不符则主人耐心 -10 秒，药碗倒掉。</li>' +
          '<li>暂停、切后台、看手札都会冻结计时；恢复必须点“继续今日”。</li>' +
        '</ol>' +
        '<div class="journal-grid">' + cards + '</div>' +
        '<p class="tiny">急症候不使用铜钱、库存、声望，也不做方证猜测。工序与时间为玩法抽象。错药只在交付时判定，不在加工前提示。</p>' +
        '<button type="button" class="btn primary" data-act="journal-close">返回</button>' +
      '</section>';
    this.root.appendChild(layer);
    this.modalOpen = true;
  };

  Game.prototype.closeJournal = function () {
    var layers = this.root.querySelectorAll('.journal-layer');
    Array.prototype.forEach.call(layers, function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    this.modalOpen = false;
    this.render();
  };

  Game.prototype.syncScene = function () {
    var scene = this.app.scene;
    if (!scene) return;
    if (!this.drawersReady) {
      scene.setDrawerMaterials(D.HERBS);
      this.drawersReady = true;
    }
    if (this.phase === 'playing' || this.phase === 'paused') {
      var waiting = this.waitingOrders();
      scene.setPatients(waiting.map(function (o) {
        return { outfit: o.outfit, orderId: o.id, slot: o.seat, selected: o.id === this.selectedOrderId };
      }, this), 'double');
      scene.setPatientSelection(this.selectedOrderId);
      scene.setPots(this.pots.map(function (p) {
        return {
          state: p.state,
          stageKey: p.state === 'cooking' ? D.stewStage(this.simTime - p.startedAt).key : null
        };
      }, this));
      scene.setBowls(this.bowls.map(function (b) {
        return { outfit: b.outfit };
      }));
      var bowlIndex = -1;
      for (var i = 0; i < this.bowls.length; i++) if (this.bowls[i].id === this.selectedBowlId) bowlIndex = i;
      scene.setSelectedBowl(bowlIndex);
      scene.syncDrawerStates(null, this.tray.herbs);
      if (this.tab === 'cabinet') {
        scene.setView('cabinet');
        scene.setHitTypes(['drawer']);
      } else if (this.tab === 'prep') {
        scene.setView('prep');
        scene.setHitTypes(['pot', 'bowl']);
      } else {
        scene.setView('patients');
        scene.setHitTypes(['patient']);
      }
      return;
    }
    scene.setHitTypes([]);
    scene.setPatients([]);
    scene.setPots([]);
    scene.setBowls([]);
    scene.setSelectedBowl(-1);
    scene.setView('wide');
  };

  Game.prototype.handlePick = function (target) {
    if (this.destroyed || this.phase !== 'playing' || !target) return;
    if (target.type === 'patient') {
      if (this.selectedBowlId) this.deliverTo(target.orderId);
      else this.selectOrder(target.orderId);
    } else if (target.type === 'drawer') {
      this.addHerb(target.id);
    } else if (target.type === 'pot') {
      var p = this.pots[target.index];
      if (!p) return;
      if (p.state === 'empty' && this.tray.state === 'processed') this.loadPot(target.index);
      else if (p.state === 'cooking') this.takePot(target.index);
      else if (p.state === 'cooldown') this.app.showToast('锅正在冷却，剩余 ' + Math.max(0, p.cooldownUntil - this.simTime).toFixed(1) + ' 秒。', 'warn');
    } else if (target.type === 'bowl') {
      var b = this.bowls[target.index];
      if (b) this.selectBowl(b.id);
    }
  };

  Game.prototype.getPhase = function () { return this.phase; };

  Game.prototype.getSnapshot = function () {
    return {
      phase: this.phase,
      day: this.day,
      simTime: this.simTime,
      seed: this.seed,
      nextOrderIndex: this.nextOrderIndex,
      lastArrivalAt: this.lastArrivalAt,
      orders: this.orders.map(function (o) {
        return {
          id: o.id, index: o.index, shortCode: o.shortCode, name: o.name, outfit: o.outfit,
          formulaId: o.formulaId, patience: o.patience, arrivedAt: o.arrivedAt,
          deadline: o.deadline, status: o.status, quality: o.quality, qualityLabel: o.qualityLabel, score: o.score
        };
      }),
      tray: JSON.parse(JSON.stringify(this.tray)),
      pots: JSON.parse(JSON.stringify(this.pots)),
      bowls: JSON.parse(JSON.stringify(this.bowls)),
      selectedOrderId: this.selectedOrderId,
      selectedBowlId: this.selectedBowlId,
      dayStats: JSON.parse(JSON.stringify(this.dayStats)),
      dayResults: JSON.parse(JSON.stringify(this.dayResults)),
      currentDayResult: this.currentDayResult ? JSON.parse(JSON.stringify(this.currentDayResult)) : null,
      pauseReason: this.pauseReason,
      totalScore: this.totalScore()
    };
  };

  Game.prototype.testFreezeClock = function () {
    this.frozen = true;
    this.lastWall = performance.now();
  };

  Game.prototype.testAdvanceTo = function (t) {
    this.frozen = true;
    if (t > this.simTime) this.advanceTo(t);
    this.checkArrivals();
    if (!this.maybeEndDay()) this.render();
    return this.getSnapshot();
  };

  Game.prototype.testRestartDay = function () {
    this.resetDaily();
    this.phase = 'playing';
    this.frozen = true;
    this.lastWall = performance.now();
    this.spawnOrder(0);
    this.lastArrivalAt = 0;
    this.render();
    return this.getSnapshot();
  };

  Game.prototype.testInjectDayFormulas = function (dayIndex, formulaIds) {
    if (!this.schedule[dayIndex]) return;
    formulaIds.forEach(function (f, i) {
      if (this.schedule[dayIndex][i]) this.schedule[dayIndex][i].formulaId = f;
    }, this);
  };

  Game.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this.running = false;
    this.root.removeEventListener('click', this.onClick);
    document.removeEventListener('keydown', this.onKey);
    var layers = this.root.querySelectorAll('.journal-layer');
    Array.prototype.forEach.call(layers, function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    if (this.app.scene) {
      this.app.scene.setHitTypes([]);
      this.app.scene.setPatients([]);
      this.app.scene.setPots([]);
      this.app.scene.setBowls([]);
    }
  };

  global.QH_ACUTE = { Game: Game };
})(typeof self !== 'undefined' ? self : this);
