/* 岐黄堂 v3 · 行医录（回合决策）
 * 三天六次接诊：问诊 → 方证承诺 → 3D/HTML 配药 → 复盘 → 药市 → 终局。
 */
(function (global) {
  'use strict';

  var D = global.QH_DATA;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return (n > 0 ? '+' : '') + n + ' 文';
  }

  function csvNames(ids) {
    return ids.map(function (id) { return esc(D.herbName(id)); }).join('、');
  }

  function Game(app, seed) {
    this.app = app;
    this.mode = 'chronicle';
    this.seed = seed >>> 0;
    this.schedule = D.makeChronicleSchedule(this.seed);
    this.tutorialDismissed = false;
    this.paused = false;
    this.pendingConfirm = null;
    this.destroyed = false;
    this.root = app.root;
    this.bindEvents();

    this.resetState();
  }

  Game.prototype.resetState = function () {
    this.phase = 'dayIntro';
    this.day = 1;
    this.slot = 0;
    this.coins = D.CONST.INITIAL_COINS;
    this.reputation = D.CONST.INITIAL_REPUTATION;
    this.stock = D.initialStock();
    this.ledger = [{
      encounterId: null, type: 'initial', label: '开局资金', amount: this.coins, balance: this.coins
    }];
    this.records = [];
    this.successes = 0;
    this.firstTryCorrect = 0;
    this.referrals = 0;
    this.misdiagnoses = 0;
    this.current = null;
    this.endedEarly = false;
    this.endReason = null;
    this.topUpPreview = null;
  };

  Game.prototype.start = function () {
    this.render();
  };

  Game.prototype.bindEvents = function () {
    var self = this;
    this.onClick = function (e) {
      var target = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!target || !self.root.contains(target)) return;
      var act = target.getAttribute('data-act');
      var id = target.getAttribute('data-id');
      self.dispatch(act, id, target);
    };
    this.root.addEventListener('click', this.onClick);
  };

  Game.prototype.hasModal = function () {
    return !!(this.pendingConfirm || this.topUpPreview || this.root.querySelector('.modal-layer'));
  };

  Game.prototype.dispatch = function (act, id, target) {
    if (this.destroyed) return;
    if (this.paused) return;
    if (this.hasModal()) {
      var allowed = this.topUpPreview ? ['market-confirm-topup', 'modal-no']
        : (this.pendingConfirm ? ['modal-yes', 'modal-no'] : ['journal-close']);
      if (allowed.indexOf(act) < 0) return;
    }
    this.app.audio.unlock();
    switch (act) {
      case 'mute': this.app.toggleMute(); break;
      case 'journal': this.app.audio.click(); this.showJournal(); break;
      case 'help': this.app.audio.click(); this.showHelp(); break;
      case 'exit': this.app.requestExit(); break;
      case 'tutorial-dismiss': this.tutorialDismissed = true; this.render(); break;
      case 'begin-day': this.beginDay(); break;
      case 'clue': this.askClue(id); break;
      case 'evidence': this.toggleEvidence(id); break;
      case 'formula': this.selectFormula(id); break;
      case 'submit-formula': this.submitFormula(); break;
      case 'referral': this.requestReferral(); break;
      case 'herb-add': this.addHerb(id); break;
      case 'herb-supply': this.tempSupply(id); break;
      case 'tray-remove': this.removeHerb(id); break;
      case 'tray-clear': this.current.tray = []; this.current.lastMismatch = null; this.toast('药盘已清空，不扣库存。'); this.render(); break;
      case 'deliver': this.deliver(); break;
      case 'next': this.nextAfterReview(); break;
      case 'market-buy': this.buyMarket(id); break;
      case 'market-topup': this.openTopUp(); break;
      case 'market-confirm-topup': this.confirmTopUp(); break;
      case 'market-leave': this.leaveMarket(); break;
      case 'day-next': this.nextDay(); break;
      case 'modal-yes': this.modalAnswer(true); break;
      case 'modal-no': this.modalAnswer(false); break;
      case 'journal-close': this.closeModal(); break;
      case 'ending-same': this.restart(this.seed); break;
      case 'ending-new': this.restart(D.randomSeed()); break;
      case 'ending-exit': this.app.exitToExterior(); break;
      case 'ending-journal': this.showJournal(); break;
      case 'ending-review': this.showRecordReview(id); break;
      default: break;
    }
  };

  Game.prototype.toast = function (text, kind) {
    this.app.showToast(text, kind);
  };

  Game.prototype.ledgerPush = function (type, label, amount, encounterId) {
    this.coins += amount;
    this.ledger.push({
      encounterId: encounterId || null,
      type: type,
      label: label,
      amount: amount,
      balance: this.coins
    });
    if (amount > 0) this.app.audio.coin();
  };

  Game.prototype.encounterId = function () {
    return this.current ? this.current.encounterId : null;
  };

  Game.prototype.caseDef = function () {
    return D.CASES[this.current.templateId];
  };

  Game.prototype.correctFormula = function () {
    return this.caseDef().formulaId;
  };

  Game.prototype.targetFormula = function () {
    return this.current ? this.current.selectedFormulaId : null;
  };

  /* ------------------------------------------------------------------ */
  /* 日程与病例                                                          */
  /* ------------------------------------------------------------------ */
  Game.prototype.beginDay = function () {
    if (this.phase !== 'dayIntro') return;
    this.slot = 0;
    this.createCase();
    this.phase = 'consult';
    this.app.audio.click();
    this.render();
  };

  Game.prototype.createCase = function () {
    var slotDef = this.schedule[this.day - 1][this.slot];
    this.current = {
      encounterId: slotDef.encounterId,
      templateId: slotDef.templateId,
      name: slotDef.name,
      outfit: slotDef.outfit,
      optionOrder: slotDef.optionOrder.slice(),
      revealed: [],
      collapsed: [],
      evidence: [],
      freeLeft: D.CONST.FREE_QUESTIONS,
      paidUsed: false,
      attempts: 0,
      selectedFormulaId: null,
      tray: [],
      settled: false,
      result: null,
      referralReason: null,
      firstTryCorrect: false
    };
  };

  Game.prototype.askClue = function (id) {
    if (this.hasModal() || this.phase !== 'consult' || !this.current) return;
    var c = this.current;
    if (c.revealed.indexOf(id) >= 0) {
      var i = c.collapsed.indexOf(id);
      if (i >= 0) c.collapsed.splice(i, 1);
      else c.collapsed.push(id);
      this.app.audio.click();
      this.render();
      return;
    }
    if (c.freeLeft > 0) {
      c.freeLeft--;
      c.revealed.push(id);
      this.app.audio.pick();
      this.render();
      return;
    }
    if (!c.paidUsed) {
      if (this.coins < D.CONST.EXTRA_QUESTION_COST) {
        this.toast('铜钱不足 3 文，无法深入问诊；仍可按现有线索提交。', 'warn');
        return;
      }
      c.paidUsed = true;
      c.revealed.push(id);
      this.ledgerPush('question', '深入问诊', -D.CONST.EXTRA_QUESTION_COST, c.encounterId);
      this.toast('已支付 3 文，获得一条额外线索。');
      this.render();
      return;
    }
    this.toast('本病例的免费与付费问诊都已用尽。', 'warn');
  };

  Game.prototype.toggleEvidence = function (id) {
    if (this.phase !== 'consult' || !this.current) return;
    var c = this.current;
    if (c.revealed.indexOf(id) < 0) return;
    var i = c.evidence.indexOf(id);
    if (i >= 0) c.evidence.splice(i, 1);
    else {
      if (c.evidence.length >= 2) {
        this.toast('判断依据最多勾选两条，只作记录，不影响判定。', 'warn');
        return;
      }
      c.evidence.push(id);
    }
    this.app.audio.click();
    this.render();
  };

  Game.prototype.selectFormula = function (id) {
    if (this.phase !== 'consult' || !this.current) return;
    this.current.selectedFormulaId = id;
    this.app.audio.click();
    this.render();
  };

  Game.prototype.submitFormula = function () {
    if (this.phase !== 'consult' || !this.current) return;
    var c = this.current;
    if (!c.selectedFormulaId) {
      this.toast('请先选择一张方证卡。', 'warn');
      return;
    }
    if (c.revealed.length === 0) {
      var self = this;
      this.ask({
        title: '尚未收集线索',
        text: '尚未收集线索，仍要按所选方证取药吗？取消不会锁定方证。',
        yes: '仍然取药',
        no: '继续问诊',
        onYes: function () { self.applyFormulaSubmit(); }
      });
      return;
    }
    this.applyFormulaSubmit();
  };

  Game.prototype.applyFormulaSubmit = function () {
    var c = this.current;
    if (this.phase !== 'consult' || !c) return;
    c.attempts = 1;
    // 内部记录方证是否匹配，但不在界面上提示；交付时才揭晓。
    c.firstTryCorrect = c.selectedFormulaId === this.correctFormula();
    if (c.firstTryCorrect) this.firstTryCorrect++;
    this.phase = 'dispensing';
    this.app.audio.click();
    this.toast('已按所选方剂取药；交付时见分晓。');
    this.render();
  };

  Game.prototype.requestReferral = function () {
    if (!this.current || this.phase === 'ending' || this.phase === 'caseReview') return;
    if (this.current.settled) return;
    var self = this;
    this.ask({
      title: '请师长接诊？',
      text: '转介会结束本病例：声望 -1、诊金 0、药材不变。每病例最多扣一次声望。',
      yes: '确认转介',
      no: '继续本病例',
      onYes: function () { self.confirmReferral('你选择请师长接诊。'); }
    });
  };

  Game.prototype.confirmReferral = function (reason) {
    var c = this.current;
    if (!c || c.settled) return;
    c.settled = true;
    c.result = 'referral';
    c.referralReason = reason;
    c.tray = [];
    this.referrals++;
    this.reputation -= 1;
    this.records.push(this.makeRecord('referral', 0));
    this.app.audio.error();
    if (this.reputation < 0) {
      this.endedEarly = true;
      this.endReason = 'reputation';
      this.phase = 'ending';
      this.toast('声望跌破 0，本局暂歇研习。', 'error');
    } else {
      this.phase = 'caseReview';
      this.toast('已转介：声望 -1，未消耗药材。', 'warn');
    }
    this.render();
  };

  /* ------------------------------------------------------------------ */
  /* 配药                                                                */
  /* ------------------------------------------------------------------ */
  Game.prototype.leftStock = function (id) {
    var used = 0;
    if (this.current) {
      this.current.tray.forEach(function (x) { if (x === id) used++; });
    }
    return Math.max(0, (this.stock[id] || 0) - used);
  };

  Game.prototype.addHerb = function (id) {
    if (this.phase !== 'dispensing' || !this.current) return;
    var c = this.current;
    if (c.tray.indexOf(id) >= 0) {
      this.toast(D.herbName(id) + ' 已在药盘中，每种材料最多一张；请从药盘移除后重取。', 'warn');
      return;
    }
    if (c.tray.length >= 6) {
      this.toast('药盘最多六张材料。', 'warn');
      return;
    }
    if (this.leftStock(id) <= 0) {
      this.toast(D.herbName(id) + ' 库存不足；可花 3 文临时补货，补货后需再点一次放入药盘。', 'warn');
      return;
    }
    c.tray.push(id);
    c.lastMismatch = null;
    this.app.audio.pick();
    if (this.app.scene) this.app.scene.nudgeDrawer(id);
    this.render();
  };

  Game.prototype.removeHerb = function (id) {
    if (this.phase !== 'dispensing' || !this.current) return;
    var i = this.current.tray.indexOf(id);
    if (i >= 0) {
      this.current.tray.splice(i, 1);
      this.current.lastMismatch = null;
      this.app.audio.click();
      this.render();
    }
  };

  Game.prototype.tempSupply = function (id) {
    if (this.hasModal() || this.phase !== 'dispensing' || !this.current) return;
    if ((this.stock[id] || 0) >= D.CONST.STOCK_MAX) {
      this.toast(D.herbName(id) + ' 已达到库存上限 6 张。', 'warn');
      return;
    }
    if (this.coins < D.CONST.TEMP_SUPPLY_PRICE) {
      this.toast('铜钱不足 3 文，无法临时补货；可清盘后转介。', 'warn');
      return;
    }
    this.stock[id] += 1;
    this.ledgerPush('temp', '临时补货 · ' + D.herbName(id), -D.CONST.TEMP_SUPPLY_PRICE, this.current.encounterId);
    this.toast(D.herbName(id) + ' 临时补货 1 张（库存 ' + this.stock[id] + '），未自动入盘。');
    this.render();
  };

  Game.prototype.deliver = function () {
    if (this.hasModal() || this.phase !== 'dispensing' || !this.current || this.current.settled) return;
    var c = this.current;
    var chosen = this.targetFormula();
    var result = D.matchHerbs(chosen, c.tray);
    if (!result.ok) {
      c.lastMismatch = D.describeMismatch(result);
      this.app.audio.error();
      this.toast('不能交付：' + c.lastMismatch, 'error');
      this.render();
      return;
    }

    // 材料与所选方剂一致后，原子扣库存；方证是否正确此时才揭晓。
    var need = D.formulaHerbIds(chosen);
    for (var i = 0; i < need.length; i++) {
      this.stock[need[i]] -= 1;
      if (this.stock[need[i]] < 0) this.stock[need[i]] = 0;
    }
    c.tray = [];

    if (chosen === this.correctFormula()) {
      var fee = D.formulaFee(chosen);
      c.settled = true;
      c.result = 'success';
      c.fee = fee;
      this.successes++;
      this.reputation = Math.min(D.CONST.REPUTATION_MAX, this.reputation + D.CONST.SUCCESS_REPUTATION);
      this.ledgerPush('fee', '诊金 · ' + D.formulaName(chosen), fee, c.encounterId);
      this.records.push(this.makeRecord('success', fee, 0));
      this.phase = 'caseReview';
      this.app.audio.success();
      this.render();
      this.app.announce('交付成功，获得 ' + fee + ' 文，声望加一。');
      return;
    }

    // 方证不符：顾客离开，误诊赔偿，声望 -1。铜钱最多扣到 0，不出现负数。
    var penalty = Math.min(this.coins, D.CONST.WRONG_FORMULA_PENALTY);
    c.settled = true;
    c.result = 'wrong_formula';
    c.fee = 0;
    c.penalty = penalty;
    this.misdiagnoses++;
    this.reputation -= 1;
    this.ledgerPush('penalty', '误诊赔偿 · 方证不符', -penalty, c.encounterId);
    this.records.push(this.makeRecord('wrong_formula', 0, penalty));
    this.app.audio.error();
    if (this.reputation < 0) {
      this.endedEarly = true;
      this.endReason = 'reputation';
      this.phase = 'ending';
      this.toast('方证不符，来访者已离开；误诊赔偿 ' + penalty + ' 文。声望跌破 0。', 'error');
    } else {
      this.phase = 'caseReview';
      this.toast('方证不符，来访者已离开；误诊赔偿 ' + penalty + ' 文，声望 -1。', 'error');
    }
    this.render();
    this.app.announce('方证不符，来访者已离开。');
  };

  Game.prototype.makeRecord = function (result, fee, penalty) {
    var c = this.current;
    return {
      day: this.day,
      slot: this.slot,
      encounterId: c.encounterId,
      name: c.name,
      templateId: c.templateId,
      result: result,
      selectedFormulaId: c.selectedFormulaId,
      firstTryCorrect: !!c.firstTryCorrect,
      attempts: c.attempts,
      revealed: c.revealed.slice(),
      evidence: c.evidence.slice(),
      referralReason: c.referralReason || '',
      fee: fee || 0,
      penalty: penalty || 0
    };
  };

  /* ------------------------------------------------------------------ */
  /* 复盘、药市、日结                                                    */
  /* ------------------------------------------------------------------ */
  Game.prototype.nextAfterReview = function () {
    if (this.phase !== 'caseReview') return;
    if (this.slot === 0) {
      this.slot = 1;
      this.createCase();
      this.phase = 'consult';
      this.app.audio.click();
      this.render();
      return;
    }
    if (this.day < D.CONST.DAYS) {
      this.phase = 'market';
      this.topUpPreview = null;
      this.app.audio.click();
      this.render();
      return;
    }
    this.phase = 'ending';
    this.render();
  };

  Game.prototype.buyMarket = function (id) {
    if (this.hasModal() || this.phase !== 'market') return;
    var check = D.canBuy(this.stock, this.coins, id, 1);
    if (!check.ok) { this.toast(check.error, 'warn'); return; }
    this.stock[id] += 1;
    this.ledgerPush('market', '药市 · ' + D.herbName(id), -D.CONST.MARKET_PRICE, null);
    this.render();
  };

  Game.prototype.openTopUp = function () {
    if (this.phase !== 'market') return;
    var list = D.marketTopUpList(this.stock, 2);
    if (!list.items.length) { this.toast('所有材料都已有 2 张以上，无需补足。'); return; }
    this.topUpPreview = list;
    this.render();
  };

  Game.prototype.confirmTopUp = function () {
    if (this.phase !== 'market' || !this.topUpPreview) return;
    var list = this.topUpPreview;
    var fresh = D.marketTopUpList(this.stock, 2);
    if (JSON.stringify(list) !== JSON.stringify(fresh)) {
      this.topUpPreview = fresh.items.length ? fresh : null;
      this.toast(fresh.items.length ? '库存已变化，补货清单已更新，请重新确认。' : '库存已充足，无需补货，未扣铜钱。', 'warn');
      this.render();
      return;
    }
    if (this.coins < list.total) {
      this.toast('余额不足 ' + list.total + ' 文，整单未成交；库存与铜钱均未改变。', 'error');
      return;
    }
    this.coins -= list.total;
    list.items.forEach(function (it) { this.stock[it.id] += it.count; }, this);
    this.ledger.push({
      encounterId: null, type: 'market', label: '药市补足至每种 2 张',
      amount: -list.total, balance: this.coins
    });
    this.app.audio.coin();
    this.topUpPreview = null;
    this.toast('已补货 ' + list.items.reduce(function (n, x) { return n + x.count; }, 0) + ' 张，支出 ' + list.total + ' 文。');
    this.render();
  };

  Game.prototype.leaveMarket = function () {
    if (this.phase !== 'market') return;
    this.phase = 'dayReview';
    this.topUpPreview = null;
    this.render();
  };

  Game.prototype.nextDay = function () {
    if (this.phase !== 'dayReview') return;
    this.day += 1;
    this.slot = 0;
    this.phase = 'dayIntro';
    this.render();
  };

  Game.prototype.restart = function (seed) {
    this.seed = seed >>> 0;
    this.schedule = D.makeChronicleSchedule(this.seed);
    this.app.seed = this.seed;
    this.tutorialDismissed = false;
    this.resetState();
    if (this.app.scene) {
      this.app.scene.setHitTypes([]);
      this.app.scene.setPatients([]);
    }
    this.closeModal();
    this.render();
    this.toast('新的一局已开始，种子 ' + this.seed + '。');
    this.app.announce('新的一局已开始。');
  };

  /* ------------------------------------------------------------------ */
  /* 渲染                                                                */
  /* ------------------------------------------------------------------ */
  Game.prototype.render = function () {
    if (!this.root || this.destroyed) return;
    var body = '';
    switch (this.phase) {
      case 'dayIntro': body = this.viewDayIntro(); break;
      case 'consult': body = this.viewConsult(); break;
      case 'dispensing': body = this.viewDispensing(); break;
      case 'caseReview': body = this.viewCaseReview(); break;
      case 'market': body = this.viewMarket(); break;
      case 'dayReview': body = this.viewDayReview(); break;
      case 'ending': body = this.viewEnding(); break;
      default: body = '';
    }
    this.root.innerHTML = '<div class="game-shell chronicle-shell">' + this.hud() + body + '</div>';
    if (this.app.refreshMute) this.app.refreshMute();
    this.syncScene();
  };

  Game.prototype.hud = function () {
    return '' +
      '<header class="game-hud">' +
        '<div class="hud-left">' +
          '<span class="hud-brand">岐黄堂 · 行医录</span>' +
          '<span class="hud-chip">第 ' + this.day + ' 天 · 第 ' + (this.slot + 1) + ' 位</span>' +
        '</div>' +
        '<div class="hud-stats">' +
          '<span class="stat" title="铜钱">铜钱 <b>' + this.coins + '</b></span>' +
          '<span class="stat" title="声望">声望 <b>' + this.reputation + '</b></span>' +
          '<span class="stat muted" title="种子">种子 ' + this.seed + '</span>' +
        '</div>' +
        '<div class="hud-actions">' +
          '<button type="button" class="btn ghost small mute-btn" data-act="mute">静音：关</button>' +
          '<button type="button" class="btn ghost small" data-act="journal">手札</button>' +
          '<button type="button" class="btn ghost small" data-act="help">说明</button>' +
          '<button type="button" class="btn ghost small" data-act="exit">出门</button>' +
        '</div>' +
      '</header>';
  };

  Game.prototype.viewDayIntro = function () {
    var pos = this.day === 1 ? '今日开门 · 第一位来访者' : '第 ' + this.day + ' 天 · 两位来访者';
    var lastDay = this.day === D.CONST.DAYS;
    return '' +
      '<section class="phase-body center-phase">' +
        '<div class="paper-panel day-card">' +
          '<p class="eyebrow">行医录 · 第 ' + this.day + ' 天</p>' +
          '<h2>' + (this.day === 1 ? '开门坐堂' : '新的一天') + '</h2>' +
          '<p class="day-line">' + esc(pos) + '。每位病人有两次免费问诊；姓名与衣着不是线索。</p>' +
          '<p class="day-line subtle">' + (lastDay ? '今天是最后一天，接诊结束后直接总评，不再进入药市。' : '今天接诊两位后，会进入固定药市补货。') + '</p>' +
          '<div class="coach-row">' +
            '<span class="coach"><b>铜钱</b> ' + this.coins + ' 文</span>' +
            '<span class="coach"><b>声望</b> ' + this.reputation + '</span>' +
            '<span class="coach"><b>库存</b> ' + this.stockTotal() + ' 张</span>' +
          '</div>' +
          '<button type="button" class="btn primary large" data-act="begin-day">' + (this.day === 1 ? '开门接诊' : '开始今日接诊') + '</button>' +
          '<p class="tiny center">进度只在内存中；刷新页面会重新开始。</p>' +
        '</div>' +
      '</section>';
  };

  Game.prototype.stockTotal = function () {
    var stock = this.stock;
    return D.HERBS.reduce(function (n, h) { return n + (stock[h.id] || 0); }, 0);
  };

  Game.prototype.viewConsult = function () {
    var c = this.current;
    if (!c) return '';
    var caseDef = this.caseDef();
    var self = this;
    var revealButtons = D.CLUE_ORDER.map(function (id) {
      var isOpen = c.revealed.indexOf(id) >= 0;
      var collapsed = c.collapsed.indexOf(id) >= 0;
      var status;
      var disabled = false;
      if (isOpen) {
        status = collapsed ? '已问 · 展开' : '已问 · 收起';
      } else if (c.freeLeft > 0) {
        status = '免费 · 剩 ' + c.freeLeft + ' 次';
      } else if (!c.paidUsed) {
        status = '深入问诊 · 3 文';
        if (self.coins < D.CONST.EXTRA_QUESTION_COST) {
          status = '深入问诊 · 余额不足';
          disabled = true;
        }
      } else {
        status = '已用尽';
        disabled = !isOpen;
      }
      var content = isOpen && !collapsed
        ? '<p class="clue-text">' + esc(caseDef.clues[id]) + '</p>'
        : '';
      return '' +
        '<button type="button" class="clue-btn' + (isOpen ? ' is-open' : '') + '" data-act="clue" data-id="' + id + '"' +
          (disabled ? ' aria-disabled="true"' : '') + '>' +
          '<span class="clue-name">' + esc(D.CLUE_LABELS[id]) + '</span>' +
          '<span class="clue-status">' + esc(status) + '</span>' +
        '</button>' + content;
    }).join('');

    var evidence = '';
    if (c.revealed.length) {
      evidence = '<div class="evidence-box"><p class="mini-title">判断依据（0～2 条，只作记录）</p><div class="evidence-list">' +
        c.revealed.map(function (id) {
          return '<label class="check"><input type="checkbox" data-act="evidence" data-id="' + id + '"' +
            (c.evidence.indexOf(id) >= 0 ? ' checked' : '') + '><span>' + esc(D.CLUE_LABELS[id]) + '</span></label>';
        }).join('') + '</div></div>';
    }

    var cards = c.optionOrder.map(function (id) {
      var f = D.FORMULAS[id];
      return '' +
        '<button type="button" class="formula-card' + (c.selectedFormulaId === id ? ' is-selected' : '') + '" data-act="formula" data-id="' + id + '" aria-pressed="' + (c.selectedFormulaId === id) + '">' +
          '<span class="formula-name">' + esc(f.name) + '</span>' +
          '<span class="formula-short">' + esc(f.short) + '</span>' +
          '<span class="formula-herbs">' + f.herbs.length + ' 张：' + csvNames(f.herbs) + '</span>' +
        '</button>';
    }).join('');

    var tutorial = (this.day === 1 && this.slot === 0 && !this.tutorialDismissed)
      ? '<div class="tutorial-banner"><p>先问一问，再比较。姓名与衣着不是线索。</p><button type="button" class="icon-btn" data-act="tutorial-dismiss" aria-label="关闭提示">×</button></div>'
      : '';

    return '' +
      '<section class="phase-body consult-layout">' +
        '<section class="patient-panel paper-panel">' +
          tutorial +
          '<div class="patient-head">' +
            '<div><p class="eyebrow">第 ' + this.day + ' 天 · 第 ' + (this.slot + 1) + ' 位</p>' +
            '<h2>' + esc(c.name) + ' <span class="visitor">来访者</span></h2></div>' +
            '<span class="outfit-chip">衣装 ' + esc(c.outfit) + '</span>' +
          '</div>' +
          '<p class="chief"><span class="mini-title">主诉</span>' + esc(caseDef.chief) + '</p>' +
          '<div class="clue-list">' + revealButtons + '</div>' +
          '<p class="question-count">免费问诊：剩 <b>' + c.freeLeft + '</b> / ' + D.CONST.FREE_QUESTIONS +
            ' · 付费问诊：' + (c.paidUsed ? '已用' : '未用') + '</p>' +
          evidence +
          '<div class="consult-actions">' +
            '<button type="button" class="btn primary" data-act="submit-formula">按此方取药</button>' +
            '<button type="button" class="btn ghost" data-act="referral">请师长接诊</button>' +
          '</div>' +
        '</section>' +
        '<aside class="formula-panel paper-panel">' +
          '<div class="panel-head"><h3>方证对照</h3><span class="tiny">点卡片只选择，不提交</span></div>' +
          '<div class="formula-list">' + cards + '</div>' +
          '<p class="tiny">手札可随时查看完整知识卡。方证卡顺序每例独立洗牌，不标注正确答案。</p>' +
        '</aside>' +
      '</section>';
  };

  Game.prototype.viewDispensing = function () {
    var c = this.current;
    if (!c) return '';
    var formulaId = this.targetFormula();
    var f = D.FORMULAS[formulaId];
    var self = this;
    var trayIds = c.tray;
    var tray = trayIds.length
      ? trayIds.map(function (id) {
          return '<span class="tray-chip">' + esc(D.herbName(id)) +
            '<button type="button" class="chip-x" data-act="tray-remove" data-id="' + id + '" aria-label="移除' + esc(D.herbName(id)) + '">×</button></span>';
        }).join('')
      : '<span class="tray-empty">药盘为空。点 3D 抽屉或下方 HTML 药柜取药。</span>';

    var herbs = D.HERBS.map(function (h) {
      var left = self.leftStock(h.id);
      var inTray = trayIds.indexOf(h.id) >= 0;
      return '' +
        '<div class="herb-row' + (inTray ? ' in-tray' : '') + '">' +
          '<span class="herb-name">' + esc(h.name) + '</span>' +
          '<span class="herb-stock">库存 ' + (self.stock[h.id] || 0) + ' · 可取 ' + left + '</span>' +
          '<button type="button" class="btn small" data-act="herb-add" data-id="' + h.id + '"' + (left <= 0 ? ' aria-disabled="true"' : '') + '>放入药盘</button>' +
          '<button type="button" class="btn ghost small" data-act="herb-supply" data-id="' + h.id + '"' + ((self.stock[h.id] || 0) >= D.CONST.STOCK_MAX ? ' aria-disabled="true"' : '') + '>补货 3 文</button>' +
        '</div>';
    }).join('');

    var missing = c.lastMismatch ? '<p class="field-error">' + esc(c.lastMismatch) + '</p>' : '';
    var supplyNote = '<p class="tiny">临时补货只补 1 张到正式库存，不自动入盘；重复点击会继续购买，受库存上限 6 张约束。</p>';
    var targetChips = f.herbs.map(function (id) {
      var done = trayIds.indexOf(id) >= 0;
      return '<span class="target-chip' + (done ? ' done' : '') + '">' + (done ? '✓ ' : '○ ') + esc(D.herbName(id)) + '</span>';
    }).join('');

    return '' +
      '<section class="phase-body dispensing-layout">' +
        '<div class="dispensing-head paper-panel">' +
          '<div class="panel-head"><h2>取药 · ' + esc(f.name) + '</h2>' +
            '<span class="tiny">目标：' + f.herbs.length + ' 张 · ' + csvNames(f.herbs) + '</span></div>' +
          '<div class="target-checklist" aria-label="方内材料清单">' + targetChips + '</div>' +
          '<p class="tiny">3D 抽屉与下方 HTML 药柜调用同一动作。取药只改药盘，交付前不改正式库存。</p>' +
        '</div>' +
        '<div class="tray-bar paper-panel">' +
          '<div class="tray-head"><span class="mini-title">药盘 ' + trayIds.length + ' / 6</span>' +
            '<button type="button" class="btn ghost small" data-act="tray-clear">清空重配</button></div>' +
          '<div class="tray-list">' + tray + '</div>' +
        '</div>' +
        '<div class="dispensing-stage" aria-hidden="true"><span>3D 药柜 · 可直接点击抽屉取药</span></div>' +
        '<div class="cabinet-html paper-panel">' +
          '<div class="panel-head"><h3>HTML 药柜</h3><span class="tiny">键盘与降级视图</span></div>' +
          '<div class="herb-grid">' + herbs + '</div>' +
          supplyNote +
        '</div>' +
        '<div class="dispense-actions paper-panel">' +
          '<p class="tiny action-count">药盘 ' + trayIds.length + ' / 6 · 目标 ' + f.herbs.length + ' 张</p>' +
          missing +
          '<button type="button" class="btn primary large" data-act="deliver">核对并交付</button>' +
          '<button type="button" class="btn ghost" data-act="referral">请师长接诊</button>' +
        '</div>' +
      '</section>';
  };

  Game.prototype.viewCaseReview = function (record, archived) {
    var r = record || this.records[this.records.length - 1];
    if (!r) return '';
    var caseDef = D.CASES[r.templateId];
    var fullClues = D.CLUE_ORDER.map(function (id) {
      return '<li><b>' + esc(D.CLUE_LABELS[id]) + '</b>' + esc(caseDef.clues[id]) + '</li>';
    }).join('');
    var evidence = r.evidence.length ? r.evidence.map(function (id) { return esc(D.CLUE_LABELS[id]); }).join('、') : '未勾选';
    var myLedger = this.ledger.filter(function (e) { return e.encounterId === r.encounterId; });
    var ledgerRows = myLedger.length
      ? myLedger.map(function (e) {
          return '<li><span>' + esc(e.label) + '</span><b class="' + (e.amount >= 0 ? 'pos' : 'neg') + '">' + money(e.amount) + '</b><span class="tiny">余额 ' + e.balance + '</span></li>';
        }).join('')
      : '<li><span>本病例无额外收支</span><b>0 文</b></li>';
    var isSuccess = r.result === 'success';
    var isWrongFormula = r.result === 'wrong_formula';
    var outcome = isSuccess
      ? '<p class="outcome ok">交付成功 · 诊金 ' + r.fee + ' 文 · 声望 +1</p>'
      : (isWrongFormula
        ? '<p class="outcome bad">方证不符 · 来访者已离开 · 误诊赔偿 ' + (r.penalty || 0) + ' 文 · 声望 -1</p>' +
          '<p class="tiny">你按所选方剂完成了配药与交付，但该方与本案不匹配。错误在交付时才揭晓。</p>'
        : '<p class="outcome bad">转介 · 诊金 0 文 · 声望 -1</p>' +
          '<p class="tiny">' + esc(r.referralReason || '') + '</p>');
    var formulaLine;
    if (isSuccess) {
      formulaLine = '<p>你的选择：<b>' + esc(D.formulaName(r.selectedFormulaId)) + '</b> · 与本教学病例匹配。</p>';
    } else if (isWrongFormula) {
      formulaLine = '<p>你的选择：<b>' + esc(D.formulaName(r.selectedFormulaId)) + '</b>；本案教学上对应：<b>' +
        esc(D.formulaName(caseDef.formulaId)) + '</b>。</p>';
    } else if (r.selectedFormulaId) {
      formulaLine = '<p>你的选择：<b>' + esc(D.formulaName(r.selectedFormulaId)) + '</b> · ' +
        esc(D.conflictMessage(r.templateId, r.selectedFormulaId, r.revealed)) + '</p>';
    } else {
      formulaLine = '<p>本病例未形成有效拟方。</p>';
    }
    var nextLabel = this.slot === 0
      ? '请下一位来访者'
      : (this.day < D.CONST.DAYS ? '收摊 · 前往药市' : '查看三日结算');

    return '' +
      '<section class="phase-body review-layout">' +
        '<section class="paper-panel review-main">' +
          '<p class="eyebrow">单病例复盘 · 第 ' + r.day + ' 天第 ' + (r.slot + 1) + ' 位</p>' +
          '<h2>' + esc(caseDef.label) + ' · ' + esc(r.name) + '</h2>' +
          outcome +
          formulaLine +
          '<div class="review-grid">' +
            '<div><p class="mini-title">本病例完整线索</p><ul class="clue-review">' + fullClues + '</ul></div>' +
            '<div><p class="mini-title">关键比较</p><p>' + esc(caseDef.review) + '</p>' +
              '<p class="tiny">你已收集的线索：' + (r.revealed.length ? r.revealed.map(function (id) { return esc(D.CLUE_LABELS[id]); }).join('、') : '未问诊') + '</p>' +
              '<p class="tiny">你勾选的判断依据：' + evidence + '</p>' +
              '<p class="tiny">仅供参考，勾选不改变结果与收入。</p></div>' +
          '</div>' +
          '<details class="source-box"><summary>数据来源与教学边界</summary>' +
            '<p>' + esc(caseDef.source) + '</p>' +
            '<p>本作仅使用简短教学信息，不包含临床用量、煎服方法或治疗承诺。公开使用前仍需中医专业人员复核。</p>' +
          '</details>' +
          '<button type="button" class="btn primary large" data-act="' + (archived ? 'journal-close' : 'next') + '">' + (archived ? '返回总评' : nextLabel) + '</button>' +
        '</section>' +
        '<aside class="paper-panel review-side">' +
          '<div class="panel-head"><h3>本病例收支</h3><span class="tiny">可回溯账本</span></div>' +
          '<ul class="ledger-list">' + ledgerRows + '</ul>' +
          '<p class="tiny">' + (isSuccess || isWrongFormula ? '交付时已扣库存 ' + D.formulaHerbIds(r.selectedFormulaId).length + ' 张。' : '转介不扣药材。') + '</p>' +
          '<div class="review-stats">' +
            '<span>铜钱 <b>' + this.coins + '</b></span>' +
            '<span>声望 <b>' + this.reputation + '</b></span>' +
            '<span>成功 <b>' + this.successes + '</b></span>' +
            '<span>误诊 <b>' + this.misdiagnoses + '</b></span>' +
          '</div>' +
        '</aside>' +
      '</section>';
  };

  Game.prototype.viewMarket = function () {
    var self = this;
    var rows = D.HERBS.map(function (h) {
      var can = D.canBuy(self.stock, self.coins, h.id, 1);
      return '' +
        '<div class="market-row">' +
          '<span class="herb-name">' + esc(h.name) + '</span>' +
          '<span class="herb-stock">库存 ' + (self.stock[h.id] || 0) + ' / ' + D.CONST.STOCK_MAX + '</span>' +
          '<button type="button" class="btn small" data-act="market-buy" data-id="' + h.id + '"' +
            (can.ok ? '' : ' aria-disabled="true"') + '>买 1 张 · 2 文</button>' +
        '</div>';
    }).join('');

    var preview = '';
    if (this.topUpPreview) {
      var p = this.topUpPreview;
      var items = p.items.length
        ? p.items.map(function (it) {
            return '<li><span>' + esc(it.name) + '</span><b>' + it.count + ' 张</b><span>' + it.subtotal + ' 文</span></li>';
          }).join('')
        : '<li><span>所有材料都已达到 2 张</span></li>';
      preview = '' +
        '<div class="modal-layer">' +
          '<section class="paper-panel topup-panel" role="dialog" aria-modal="true" aria-label="补足预览">' +
            '<h2>补足到每种 2 张</h2>' +
            '<ul class="topup-list">' + items + '</ul>' +
            '<p class="total-line">合计 <b>' + p.total + '</b> 文 · 当前铜钱 ' + this.coins + ' 文</p>' +
            (this.coins < p.total ? '<p class="field-error">余额不足，整单不会成交，也不做部分购买。</p>' : '') +
            '<div class="intro-actions">' +
              '<button type="button" class="btn primary" data-act="market-confirm-topup">确认购买</button>' +
              '<button type="button" class="btn ghost" data-act="modal-no">取消</button>' +
            '</div>' +
          '</section>' +
        '</div>';
    }

    return '' +
      '<section class="phase-body market-layout">' +
        '<section class="paper-panel market-main">' +
          '<p class="eyebrow">第 ' + this.day + ' 天 · 日末药市</p>' +
          '<h2>固定药市</h2>' +
          '<p class="day-line">全部材料每张 2 文，库存上限 6 张。没有出售功能，也不展示下一位处方。</p>' +
          '<div class="market-grid">' + rows + '</div>' +
          '<div class="market-actions">' +
            '<button type="button" class="btn primary" data-act="market-topup">一键补足到每种 2 张</button>' +
            '<button type="button" class="btn ghost large" data-act="market-leave">收摊 · 日结</button>' +
          '</div>' +
        '</section>' +
        '<aside class="paper-panel market-side">' +
          '<p class="mini-title">当前</p>' +
          '<p class="big-money">' + this.coins + ' <span>文</span></p>' +
          '<p class="tiny">声望 ' + this.reputation + ' · 库存合计 ' + this.stockTotal() + ' 张</p>' +
          '<p class="tiny">补货前会先显示精确清单与合计；余额不足时整单拒绝。</p>' +
        '</aside>' +
      '</section>' + preview;
  };

  Game.prototype.viewDayReview = function () {
    var day = this.day;
    var today = this.records.filter(function (r) { return r.day === day; });
    var rows = today.length ? today.map(function (r) {
      return '<li><span>' + esc(r.name) + ' · ' + esc(D.formulaName(r.selectedFormulaId || D.CASES[r.templateId].formulaId)) + '</span>' +
        '<b class="' + (r.result === 'success' ? 'pos' : 'neg') + '">' + (r.result === 'success' ? '+' + r.fee + ' 文' : (r.result === 'wrong_formula' ? '误诊 · -' + (r.penalty || 0) + ' 文' : '转介')) + '</b></li>';
    }).join('') : '<li><span>今日暂无完成记录</span></li>';
    var dayLedger = this.ledger.filter(function (e) { return e.type !== 'initial'; });
    var spend = dayLedger.reduce(function (n, e) { return n + (e.amount < 0 ? -e.amount : 0); }, 0);
    var income = dayLedger.reduce(function (n, e) { return n + (e.amount > 0 ? e.amount : 0); }, 0);

    return '' +
      '<section class="phase-body center-phase">' +
        '<div class="paper-panel day-card wide-card">' +
          '<p class="eyebrow">第 ' + this.day + ' 天 · 日结</p>' +
          '<h2>收摊核算</h2>' +
          '<ul class="day-records">' + rows + '</ul>' +
          '<div class="review-stats">' +
            '<span>累计收入 <b>' + income + ' 文</b></span>' +
            '<span>累计支出 <b>' + spend + ' 文</b></span>' +
            '<span>铜钱 <b>' + this.coins + ' 文</b></span>' +
            '<span>声望 <b>' + this.reputation + '</b></span>' +
          '</div>' +
          '<button type="button" class="btn primary large" data-act="day-next">进入第 ' + (this.day + 1) + ' 天</button>' +
        '</div>' +
      '</section>';
  };

  Game.prototype.viewEnding = function () {
    var rank = this.endedEarly ? '暂歇研习' : D.chronicleRank(this.successes);
    var recordsByKey = {};
    this.records.forEach(function (r) { recordsByKey[r.day + '-' + r.slot] = r; });
    var slots = [];
    for (var d = 1; d <= D.CONST.DAYS; d++) {
      for (var s = 0; s < D.CONST.CASES_PER_DAY; s++) {
        var r = recordsByKey[d + '-' + s];
        var label = '第 ' + d + ' 天 · 第 ' + (s + 1) + ' 位';
        if (!r) {
          slots.push('<li class="unmet"><span>' + label + '</span><b>未接诊</b></li>');
        } else {
          var outcomeText = r.result === 'success'
            ? '成功 · ' + r.fee + ' 文'
            : (r.result === 'wrong_formula' ? '误诊 · -' + (r.penalty || 0) + ' 文' : '转介');
          slots.push('<li><span>' + label + ' · ' + esc(r.name) + '</span><b class="' + (r.result === 'success' ? 'pos' : 'neg') + '">' +
            outcomeText + '</b><button type="button" class="btn small" data-act="ending-review" data-id="' + esc(r.encounterId) + '">病例复盘</button></li>');
        }
      }
    }
    var expense = this.ledger.reduce(function (n, e) { return n + (e.amount < 0 ? -e.amount : 0); }, 0);
    var income = this.ledger.reduce(function (n, e) { return n + (e.amount > 0 && e.type !== 'initial' ? e.amount : 0); }, 0);
    var stockLine = D.HERBS.map(function (h) { return esc(h.name) + ' ' + (this.stock[h.id] || 0); }, this).join(' · ');
    var ledgerRows = this.ledger.map(function (e) {
      return '<li><span>' + esc(e.label) + '</span><b class="' + (e.amount >= 0 ? 'pos' : 'neg') + '">' + money(e.amount) + '</b><span class="tiny">余额 ' + e.balance + '</span></li>';
    }).join('');

    return '' +
      '<section class="phase-body ending-layout">' +
        '<section class="paper-panel ending-main">' +
          '<p class="eyebrow">行医录 · 三日总评</p>' +
          '<h2 class="rank">' + esc(rank) + '</h2>' +
          (this.endedEarly ? '<p class="outcome bad">声望跌破 0，本局提前结束。已完成的病例记录仍保留。</p>' : '') +
          '<div class="score-row">' +
            '<span>成功 <b>' + this.successes + ' / 6</b></span>' +
            '<span>首次拟方正确 <b>' + this.firstTryCorrect + '</b></span>' +
            '<span>转介 <b>' + this.referrals + '</b></span>' +
            '<span>误诊 <b>' + this.misdiagnoses + '</b></span>' +
            '<span>声望 <b>' + this.reputation + '</b></span>' +
            '<span>铜钱 <b>' + this.coins + ' 文</b></span>' +
          '</div>' +
          '<ul class="ending-records">' + slots.join('') + '</ul>' +
          '<p class="tiny">收入合计 ' + income + ' 文 · 支出合计 ' + expense + ' 文（不含开局资金）</p>' +
          '<p class="tiny">剩余库存：' + stockLine + '</p>' +
          '<div class="ending-actions">' +
            '<button type="button" class="btn primary" data-act="ending-journal">知识复盘</button>' +
            '<button type="button" class="btn" data-act="ending-same">同种子重玩</button>' +
            '<button type="button" class="btn" data-act="ending-new">新种子重玩</button>' +
            '<button type="button" class="btn ghost" data-act="ending-exit">返回双门</button>' +
          '</div>' +
        '</section>' +
        '<aside class="paper-panel ending-side">' +
          '<div class="panel-head"><h3>铜钱账本</h3><span class="tiny">全部可回溯</span></div>' +
          '<ul class="ledger-list">' + ledgerRows + '</ul>' +
          '<p class="tiny">种子 ' + this.seed + '。刷新页面不会保存本局。</p>' +
        '</aside>' +
      '</section>';
  };

  /* ------------------------------------------------------------------ */
  /* 弹窗与手札                                                          */
  /* ------------------------------------------------------------------ */
  Game.prototype.ask = function (opts) {
    this.pendingConfirm = opts;
    var layer = document.createElement('div');
    layer.className = 'modal-layer';
    layer.setAttribute('data-role', 'confirm');
    layer.innerHTML = '' +
      '<section class="paper-panel confirm-panel" role="dialog" aria-modal="true">' +
        '<h2>' + esc(opts.title) + '</h2>' +
        '<p>' + esc(opts.text) + '</p>' +
        '<div class="intro-actions">' +
          '<button type="button" class="btn primary" data-act="modal-yes">' + esc(opts.yes) + '</button>' +
          '<button type="button" class="btn ghost" data-act="modal-no">' + esc(opts.no) + '</button>' +
        '</div>' +
      '</section>';
    this.root.appendChild(layer);
    var first = layer.querySelector('[data-act="modal-yes"]');
    if (first) setTimeout(function () { first.focus(); }, 20);
  };

  Game.prototype.modalAnswer = function (yes) {
    if (this.topUpPreview && yes === false) {
      this.topUpPreview = null;
      this.render();
      return;
    }
    var opts = this.pendingConfirm;
    this.pendingConfirm = null;
    var layer = this.root.querySelector('[data-role="confirm"]');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    if (opts) {
      if (yes && opts.onYes) opts.onYes();
      if (!yes && opts.onNo) opts.onNo();
    }
  };

  Game.prototype.closeModal = function () {
    var hadTopUp = !!this.topUpPreview;
    var layers = this.root.querySelectorAll('.modal-layer');
    Array.prototype.forEach.call(layers, function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    this.pendingConfirm = null;
    this.topUpPreview = null;
    if (hadTopUp) this.render();
  };

  Game.prototype.showRecordReview = function (encounterId) {
    if (this.phase !== 'ending' || this.hasModal()) return;
    var record = this.records.filter(function (r) { return r.encounterId === encounterId; })[0];
    if (!record) return;
    var layer = document.createElement('div');
    layer.className = 'modal-layer';
    layer.innerHTML = '<section class="paper-panel journal-panel" role="dialog" aria-modal="true" aria-label="已完成病例复盘">' +
      this.viewCaseReview(record, true) + '</section>';
    this.root.appendChild(layer);
  };

  Game.prototype.showJournal = function () {
    var cards = D.FORMULA_LIST.map(function (f) {
      return '' +
        '<article class="journal-card">' +
          '<h3>' + esc(f.name) + '</h3>' +
          '<p class="journal-short">' + esc(f.short) + '</p>' +
          '<p><b>材料卡（每种 1 张）</b></p>' +
          '<p class="journal-herbs">' + csvNames(f.herbs) + '</p>' +
          '<p class="tiny">' + esc(f.note) + '</p>' +
        '</article>';
    }).join('');
    var layer = document.createElement('div');
    layer.className = 'modal-layer';
    layer.innerHTML = '' +
      '<section class="paper-panel journal-panel" role="dialog" aria-modal="true" aria-label="方证手札">' +
        '<div class="panel-head"><div><p class="eyebrow">行医录 · 手札</p><h2>三张方证知识卡</h2></div>' +
          '<button type="button" class="icon-btn" data-act="journal-close" aria-label="关闭手札">×</button></div>' +
        '<div class="journal-grid">' + cards + '</div>' +
        '<p class="tiny">手札不显示当前病人的隐藏线索，也不自动推荐处方。材料卡是游戏单位，不是实际临床剂量。</p>' +
        '<p class="tiny">知识来源：香港浸会大学中医药学院中药方剂图像数据库（2026-10-18 据搜索索引核对）；公开发布前仍需专业复核。</p>' +
        '<button type="button" class="btn primary" data-act="journal-close">合上手札</button>' +
      '</section>';
    this.root.appendChild(layer);
  };

  Game.prototype.showHelp = function () {
    var layer = document.createElement('div');
    layer.className = 'modal-layer';
    layer.innerHTML = '' +
      '<section class="paper-panel help-panel" role="dialog" aria-modal="true" aria-label="玩法说明">' +
        '<div class="panel-head"><h2>行医录玩法</h2><button type="button" class="icon-btn" data-act="journal-close" aria-label="关闭说明">×</button></div>' +
        '<ol class="help-list">' +
          '<li>每位病人有主诉与三条隐藏线索。免费问诊两次；之后可花 3 文再问一次。</li>' +
          '<li>点击方证卡只作选择；按“按此方取药”后直接进入配药，不会即时提示对错。交付时才揭晓方证是否匹配。</li>' +
          '<li>方证不符：来访者离开、误诊赔偿 12 文（最多扣到 0）、声望 -1。配药材料与所选方剂不一致时只退回调整，不判误诊。</li>' +
          '<li>正确后按方剂材料卡配药。3D 抽屉与 HTML 药柜等效；取药只改药盘，交付时才扣库存。</li>' +
          '<li>交付成功获得诊金（材料数 × 2 + 16），声望 +1；转介声望 -1，药材不变。</li>' +
          '<li>第一、二天第二位病人结束后进入固定药市；第三天结束后直接总评。</li>' +
          '<li>不设现实时间惩罚。刷新页面会重新开始，不保存进度。</li>' +
        '</ol>' +
        '<p class="tiny">教学情境，不用于实际诊疗。游戏材料卡不代表剂量，省略了炮制与煎服步骤。</p>' +
        '<button type="button" class="btn primary" data-act="journal-close">知道了</button>' +
      '</section>';
    this.root.appendChild(layer);
  };

  /* ------------------------------------------------------------------ */
  /* 3D 同步与生命周期                                                   */
  /* ------------------------------------------------------------------ */
  Game.prototype.syncScene = function () {
    var scene = this.app.scene;
    if (!scene) return;
    var c = this.current;
    if (!this.drawersReady) {
      scene.setDrawerMaterials(D.HERBS);
      this.drawersReady = true;
    }
    if (this.phase === 'dispensing' && c) {
      scene.setView('cabinet');
      scene.setDrawerMaterials(D.HERBS);
      var left = {};
      D.HERBS.forEach(function (h) { left[h.id] = this.leftStock(h.id); }, this);
      scene.syncDrawerStates(left, c.tray.slice());
      scene.setHitTypes(['drawer']);
      scene.setPatients([]);
      scene.setPots([]);
      scene.setBowls([]);
      scene.setSelectedBowl(-1);
      return;
    }
    scene.setHitTypes([]);
    scene.setPots([]);
    scene.setBowls([]);
    scene.setSelectedBowl(-1);
    if (this.phase === 'consult') {
      scene.setView('consult');
      if (c) {
        scene.setPatients([{ outfit: c.outfit, orderId: c.encounterId }], 'single');
      }
    } else if (this.phase === 'dayIntro' || this.phase === 'dayReview' || this.phase === 'ending') {
      scene.setView('wide');
      scene.setPatients([]);
    } else if (this.phase === 'market') {
      scene.setView('wide');
      scene.setPatients([]);
    } else if (this.phase === 'caseReview') {
      scene.setView('wide');
      scene.setPatients([]);
    }
  };

  Game.prototype.handlePick = function (target) {
    if (this.destroyed || this.paused || this.hasModal()) return;
    if (this.phase === 'dispensing' && target && target.type === 'drawer') {
      this.addHerb(target.id);
    }
  };

  Game.prototype.pauseForExit = function () {
    this.paused = true;
  };

  Game.prototype.resumeAfterExitCancel = function () {
    this.paused = false;
  };

  Game.prototype.onVisibilityHidden = function () {};
  Game.prototype.onVisibilityVisible = function () {};

  Game.prototype.getPhase = function () {
    return this.phase;
  };

  Game.prototype.getSnapshot = function () {
    return {
      phase: this.phase,
      day: this.day,
      slot: this.slot,
      coins: this.coins,
      reputation: this.reputation,
      stock: JSON.parse(JSON.stringify(this.stock)),
      successes: this.successes,
      firstTryCorrect: this.firstTryCorrect,
      referrals: this.referrals,
      misdiagnoses: this.misdiagnoses,
      records: this.records.slice(),
      ledger: this.ledger.slice(),
      seed: this.seed,
      endedEarly: this.endedEarly,
      current: this.current ? JSON.parse(JSON.stringify({
        encounterId: this.current.encounterId,
        templateId: this.current.templateId,
        name: this.current.name,
        outfit: this.current.outfit,
        revealed: this.current.revealed,
        evidence: this.current.evidence,
        freeLeft: this.current.freeLeft,
        paidUsed: this.current.paidUsed,
        attempts: this.current.attempts,
        selectedFormulaId: this.current.selectedFormulaId,
        tray: this.current.tray,
        result: this.current.result,
        firstTryCorrect: this.current.firstTryCorrect
      })) : null
    };
  };

  Game.prototype.testInjectSchedule = function (matrix) {
    matrix.forEach(function (row, d) {
      row.forEach(function (templateId, s) {
        if (this.schedule[d] && this.schedule[d][s]) this.schedule[d][s].templateId = templateId;
      }, this);
    }, this);
  };

  Game.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;
    this.root.removeEventListener('click', this.onClick);
    this.closeModal();
    if (this.app.scene) {
      this.app.scene.setHitTypes([]);
      this.app.scene.setPatients([]);
      this.app.scene.setPots([]);
      this.app.scene.setBowls([]);
    }
  };

  global.QH_CHRONICLE = { Game: Game };
})(typeof self !== 'undefined' ? self : this);
