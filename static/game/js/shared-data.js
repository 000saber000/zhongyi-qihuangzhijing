/* 岐黄堂 v3 · 共享数据与纯规则
 * 两个模式共用材料、方剂、房间外观与调色板；
 * 行医录经济与急症候实时规则分别由各自模块实现。
 */
(function (root) {
  'use strict';

  var C = {
    DAYS: 3,
    CASES_PER_DAY: 2,
    ORDERS_PER_DAY: 4,
    INITIAL_COINS: 40,
    INITIAL_REPUTATION: 3,
    FREE_QUESTIONS: 2,
    EXTRA_QUESTION_COST: 3,
    CORRECTION_COST: 6,
    WRONG_FORMULA_PENALTY: 12,
    SUCCESS_REPUTATION: 1,
    REFERRAL_REPUTATION: -1,
    REPUTATION_MAX: 20,
    MARKET_PRICE: 2,
    TEMP_SUPPLY_PRICE: 3,
    STOCK_MAX: 6,
    STOCK_START: 2,
    ARRIVAL_INTERVAL: 12,
    PROCESS_SECONDS: 3,
    BURN_AGE: 16,
    BURN_COOLDOWN: 5,
    LEAVE_POT_COOLDOWN: 2,
    WRONG_PATIENCE_PENALTY: 5,
    WRONG_MEDICINE_PENALTY: 10,
    PATIENCE: [90, 80, 70]
  };

  var PALETTE = {
    bg: '#0c1b20',
    green: '#214b39',
    wood: '#25463d',
    paper: '#f0dfb7',
    ink: '#173029',
    gold: '#d1b17a'
  };

  var HERBS = [
    { id: 'mahuang', name: '麻黄' },
    { id: 'guizhi', name: '桂枝' },
    { id: 'xingren', name: '杏仁' },
    { id: 'zhigancao', name: '炙甘草' },
    { id: 'shaoyao', name: '芍药' },
    { id: 'shengjiang', name: '生姜' },
    { id: 'dazao', name: '大枣' },
    { id: 'banxia', name: '半夏' },
    { id: 'juhong', name: '橘红' },
    { id: 'baifuling', name: '白茯苓' },
    { id: 'wumei', name: '乌梅' }
  ];

  var HERB_BY_ID = {};
  HERBS.forEach(function (h) { HERB_BY_ID[h.id] = h; });

  var FORMULAS = {
    mahuang: {
      id: 'mahuang',
      name: '麻黄汤',
      herbs: ['mahuang', 'guizhi', 'xingren', 'zhigancao'],
      short: '表实组合：无汗、身痛、喘，苔薄白，脉浮紧。',
      note: '教学卡片按游戏材料单位计，不代表临床剂量。'
    },
    guizhi: {
      id: 'guizhi',
      name: '桂枝汤',
      herbs: ['guizhi', 'shaoyao', 'zhigancao', 'shengjiang', 'dazao'],
      short: '表虚组合：汗出、恶风、干呕，苔白，脉浮缓。',
      note: '所引资料的方解标为白芍；本游戏统一显示“芍药”。'
    },
    erchen: {
      id: 'erchen',
      name: '二陈汤',
      herbs: ['banxia', 'juhong', 'baifuling', 'zhigancao', 'shengjiang', 'wumei'],
      short: '湿痰组合：痰白量多易咯、恶心，苔白腻，脉滑。',
      note: '所引资料中生姜、乌梅属煎服加入项，本游戏把它们计为材料卡，六张卡不等于原文“组成”栏六味。'
    }
  };

  var FORMULA_IDS = ['mahuang', 'guizhi', 'erchen'];
  var FORMULA_LIST = FORMULA_IDS.map(function (id) { return FORMULAS[id]; });

  var CASES = {
    case_a: {
      id: 'case_a',
      formulaId: 'mahuang',
      label: '表实线索练习',
      chief: '身上发热，头部不适。',
      clues: {
        symptom: '畏冷，皮肤没有出汗，身体酸痛并有喘的表现。',
        tongue: '舌面的苔较薄，呈白色。',
        pulse: '脉位偏表，触感较紧。'
      },
      review: '本题把不出汗、身痛和浮紧的脉象放在一起，作为表实的教学组合。只看到发热头痛或白苔，还不足以与 B 区分。',
      source: '香港浸会大学中医药学院中药方剂图像数据库：麻黄汤条目（2026-10-18 据搜索索引核对）'
    },
    case_b: {
      id: 'case_b',
      formulaId: 'guizhi',
      label: '表虚线索练习',
      chief: '身上发热，头部不适。',
      clues: {
        symptom: '身上已经出汗，遇风不舒服，还会干呕。',
        tongue: '舌苔呈白色。',
        pulse: '脉位偏表，触感较缓。'
      },
      review: '本题将自汗、恶风和浮缓的脉象组合为表虚教学线索。与 A 的区别需要结合完整组合，不能教成“只凭出汗一项就开方”。',
      source: '香港浸会大学中医药学院中药方剂图像数据库：桂枝汤条目（2026-10-18 据搜索索引核对）'
    },
    case_c: {
      id: 'case_c',
      formulaId: 'erchen',
      label: '湿痰对照练习',
      chief: '咳嗽，胸口闷闷的。',
      clues: {
        symptom: '痰量较多、颜色发白，比较容易咳出，并有恶心感。',
        tongue: '舌苔发白，表面带有腻感。',
        pulse: '脉的触感较滑。'
      },
      review: '本题以白色易咯的痰、白腻苔和滑脉组成湿痰教学线索，与前两题的表证组合做对照。',
      source: '香港浸会大学中医药学院中药方剂图像数据库：二陈汤条目（2026-10-18 据搜索索引核对）'
    }
  };

  var CLUE_ORDER = ['symptom', 'tongue', 'pulse'];
  var CLUE_LABELS = { symptom: '追问症状', tongue: '察看舌苔', pulse: '了解脉象' };

  var NAMES = ['林客', '周客', '许客', '沈客', '顾客', '陈客'];
  var OUTFITS = ['玉绿长衫', '灰青短褂', '米白直裰', '赭褐短打', '靛蓝宽袖', '绛红披风'];
  var OUTFIT_PAIRS = [
    ['玉绿长衫', '绛红披风'],
    ['米白直裰', '靛蓝宽袖'],
    ['赭褐短打', '灰青短褂']
  ];

  function makeOutfitOrder(rng) {
    var pairs = shuffleWith(OUTFIT_PAIRS, rng);
    var order = [];
    pairs.forEach(function (pair) {
      if (rng() < 0.5) order.push(pair[0], pair[1]);
      else order.push(pair[1], pair[0]);
    });
    return order;
  }

  /* ---------- 随机 ---------- */

  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWith(list, rng) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function randomSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return arr[0];
    }
    return Math.floor(Math.random() * 4294967296);
  }

  function parseSeed(text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: true, seed: randomSeed(), generated: true };
    if (!/^\d+$/.test(raw)) {
      return { ok: false, error: '种子需为 0～4294967295 的整数；留空则随机生成。' };
    }
    var n = Number(raw);
    if (!Number.isSafeInteger(n) || n < 0 || n > 4294967295) {
      return { ok: false, error: '种子超出范围，请使用 0～4294967295 的整数。' };
    }
    return { ok: true, seed: n, generated: false };
  }

  /* ---------- 日程生成 ---------- */

  function makeChronicleSchedule(seed) {
    var rng = mulberry32(seed);
    var x = rng() < 0.5 ? 'case_a' : 'case_b';
    var y = x === 'case_a' ? 'case_b' : 'case_a';
    var templates = [
      shuffleWith(['case_a', 'case_b'], rng),
      shuffleWith(['case_c', x], rng),
      shuffleWith(['case_c', y], rng)
    ];
    var names = shuffleWith(NAMES, rng);
    var outfitOrder = makeOutfitOrder(rng);
    var days = [];
    var n = 0;
    for (var d = 0; d < C.DAYS; d++) {
      var slots = [];
      for (var s = 0; s < C.CASES_PER_DAY; s++) {
        var templateId = templates[d][s];
        var outfit = outfitOrder[n];
        var optionOrder = shuffleWith(FORMULA_IDS, rng);
        slots.push({
          encounterId: 'c' + seed + '-d' + (d + 1) + '-s' + (s + 1),
          templateId: templateId,
          name: names[n],
          outfit: outfit,
          optionOrder: optionOrder
        });
        n++;
      }
      days.push(slots);
    }
    return days;
  }

  function makeAcuteSchedule(seed) {
    var rng = mulberry32(seed);
    var days = [];
    for (var d = 0; d < C.DAYS; d++) {
      var extra = FORMULA_IDS[Math.floor(rng() * FORMULA_IDS.length)];
      var formulas = shuffleWith(['mahuang', 'guizhi', 'erchen', extra], rng);
      var names = shuffleWith(NAMES, rng).slice(0, C.ORDERS_PER_DAY);
      var outfitOrder = makeOutfitOrder(rng);
      var orders = [];
      for (var i = 0; i < C.ORDERS_PER_DAY; i++) {
        orders.push({
          orderId: 'a' + seed + '-d' + (d + 1) + '-o' + (i + 1),
          shortCode: 'D' + (d + 1) + '-' + String(i + 1).padStart(2, '0'),
          formulaId: formulas[i],
          name: names[i],
          outfit: outfitOrder[i],
          patience: C.PATIENCE[d]
        });
      }
      days.push(orders);
    }
    return days;
  }

  /* ---------- 材料与方剂 ---------- */

  function herbName(id) {
    return HERB_BY_ID[id] ? HERB_BY_ID[id].name : id;
  }
  function formulaName(id) {
    return FORMULAS[id] ? FORMULAS[id].name : id;
  }
  function formulaHerbIds(id) {
    return FORMULAS[id] ? FORMULAS[id].herbs.slice() : [];
  }
  function formulaFee(id) {
    return formulaHerbIds(id).length * C.MARKET_PRICE + 16;
  }

  function herbNames(ids) {
    return ids.map(herbName);
  }

  function duplicateIds(ids) {
    var seen = {}, dup = [];
    ids.forEach(function (id) {
      if (seen[id]) { if (dup.indexOf(id) < 0) dup.push(id); }
      seen[id] = true;
    });
    return dup;
  }

  function matchHerbs(formulaId, ids) {
    var need = FORMULAS[formulaId] ? FORMULAS[formulaId].herbs : [];
    var dup = duplicateIds(ids);
    var missing = need.filter(function (id) { return ids.indexOf(id) < 0; });
    var extra = ids.filter(function (id) { return need.indexOf(id) < 0; });
    var needCounts = {};
    need.forEach(function (id) { needCounts[id] = (needCounts[id] || 0) + 1; });
    var countMismatch = [];
    Object.keys(needCounts).forEach(function (id) {
      var have = ids.filter(function (x) { return x === id; }).length;
      if (have !== needCounts[id] && missing.indexOf(id) < 0 && extra.indexOf(id) < 0) {
        countMismatch.push(id);
      }
    });
    return {
      ok: dup.length === 0 && missing.length === 0 && extra.length === 0 && ids.length === need.length,
      missing: missing,
      extra: extra,
      duplicate: dup,
      countMismatch: countMismatch
    };
  }

  function describeMismatch(result) {
    var parts = [];
    if (result.duplicate.length) parts.push('重复：' + herbNames(result.duplicate).join('、'));
    if (result.missing.length) parts.push('缺少：' + herbNames(result.missing).join('、'));
    if (result.extra.length) parts.push('多出：' + herbNames(result.extra).join('、'));
    if (!parts.length && result.countMismatch.length) parts.push('数量不符：' + herbNames(result.countMismatch).join('、'));
    return parts.length ? parts.join('；') : '材料集合与方剂一致。';
  }

  /* ---------- 行医录经济 ---------- */

  function initialStock() {
    var s = {};
    HERBS.forEach(function (h) { s[h.id] = C.STOCK_START; });
    return s;
  }

  function marketTopUpList(stock, target) {
    target = target == null ? C.STOCK_START : target;
    var items = [];
    var total = 0;
    HERBS.forEach(function (h) {
      var have = stock[h.id] || 0;
      if (have < target) {
        var count = target - have;
        items.push({ id: h.id, name: h.name, count: count, subtotal: count * C.MARKET_PRICE });
        total += count * C.MARKET_PRICE;
      }
    });
    return { items: items, total: total, target: target };
  }

  function canBuy(stock, coins, id, count) {
    count = count == null ? 1 : count;
    var have = stock[id] || 0;
    if (count <= 0 || !Number.isInteger(count)) return { ok: false, error: '购买数量需为正整数。' };
    if (have + count > C.STOCK_MAX) return { ok: false, error: herbName(id) + ' 库存上限为 ' + C.STOCK_MAX + ' 张。' };
    var cost = count * C.MARKET_PRICE;
    if (coins < cost) return { ok: false, error: '铜钱不足，需要 ' + cost + ' 文。' };
    return { ok: true, cost: cost };
  }

  function recipeKey(formulaId) {
    return FORMULAS[formulaId].herbs.slice().sort().join('|');
  }

  /* ---------- 急症候火候与星级 ---------- */

  function stewStage(age) {
    if (!isFinite(age) || age < 0) age = 0;
    if (age < 5) return { key: 'raw', label: '生', score: 5, takeable: true };
    if (age < 8) return { key: 'warm', label: '温', score: 15, takeable: true };
    if (age < 13) return { key: 'perfect', label: '完美', score: 25, takeable: true };
    if (age < 16) return { key: 'over', label: '过', score: 5, takeable: true };
    return { key: 'burned', label: '糊', score: 0, takeable: false };
  }

  function starRating(completed, perfect) {
    if (completed >= 4 && perfect >= 3) return 3;
    if (completed >= 3) return 2;
    if (completed >= 2) return 1;
    return 0;
  }

  function chronicleRank(success) {
    if (success >= 5) return '初识门径';
    if (success >= 3) return '仍需磨练';
    return '再读医案';
  }

  /* ---------- 病例冲突提示 ---------- */

  function conflictMessage(templateId, chosenFormulaId, revealed) {
    if (!CASES[templateId] || CASES[templateId].formulaId === chosenFormulaId) return '';
    var hasSymptom = revealed.indexOf('symptom') >= 0;
    var hasTongue = revealed.indexOf('tongue') >= 0;
    var hasPulse = revealed.indexOf('pulse') >= 0;
    if (templateId === 'case_a') {
      if (chosenFormulaId === 'guizhi') {
        if (hasSymptom) return '本题的不出汗与该卡的汗出要点不同。';
        if (hasPulse) return '已知脉象与这张卡的重点不符。';
        return '现有依据不足，可以继续问诊。';
      }
      if (chosenFormulaId === 'erchen') {
        if (hasSymptom) return '已知的无汗身痛组合，不是这张卡的痰湿重点。';
        return '现有依据不足，可以继续问诊。';
      }
    }
    if (templateId === 'case_b') {
      if (chosenFormulaId === 'mahuang') {
        if (hasSymptom) return '本题已出汗，与该卡的不出汗要点不同。';
        if (hasPulse) return '已知脉象并非这张卡所强调的紧象。';
        return '现有依据不足，可以继续问诊。';
      }
      if (chosenFormulaId === 'erchen') {
        if (hasSymptom) return '已知的汗出恶风组合，不是这张卡的痰湿重点。';
        return '现有依据不足，可以继续问诊。';
      }
    }
    if (templateId === 'case_c') {
      if (hasSymptom) return '本题重点是痰的表现，请与所选卡的完整组合比较。';
      if (hasTongue || hasPulse) return '已收集的舌苔或脉象支持另一类教学组合。';
      return '现有依据不足，可以继续问诊。';
    }
    return '这张方证卡与病例不匹配。';
  }

  var API = {
    CONST: C,
    PALETTE: PALETTE,
    HERBS: HERBS,
    HERB_BY_ID: HERB_BY_ID,
    FORMULAS: FORMULAS,
    FORMULA_IDS: FORMULA_IDS,
    FORMULA_LIST: FORMULA_LIST,
    CASES: CASES,
    CASE_IDS: ['case_a', 'case_b', 'case_c'],
    CLUE_ORDER: CLUE_ORDER,
    CLUE_LABELS: CLUE_LABELS,
    NAMES: NAMES,
    OUTFITS: OUTFITS,
    mulberry32: mulberry32,
    shuffleWith: shuffleWith,
    randomSeed: randomSeed,
    parseSeed: parseSeed,
    makeChronicleSchedule: makeChronicleSchedule,
    makeAcuteSchedule: makeAcuteSchedule,
    herbName: herbName,
    herbNames: herbNames,
    formulaName: formulaName,
    formulaHerbIds: formulaHerbIds,
    formulaFee: formulaFee,
    matchHerbs: matchHerbs,
    describeMismatch: describeMismatch,
    duplicateIds: duplicateIds,
    initialStock: initialStock,
    marketTopUpList: marketTopUpList,
    canBuy: canBuy,
    recipeKey: recipeKey,
    stewStage: stewStage,
    starRating: starRating,
    chronicleRank: chronicleRank,
    conflictMessage: conflictMessage
  };

  root.QH_DATA = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
