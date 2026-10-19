/* 岐黄堂 v3 · 3D 场景层
 * 依赖 vendor/three.min.js（three r140 UMD）
 * 对外暴露 QH_SCENE.create(canvas, opts) -> api | null
 * WebGL 不可用时返回 null，由 app.js 降级为图片背景与 HTML 操作。
 */
(function (global) {
  'use strict';

  var PALETTE = {
    bg: 0x0c1b20,
    island: 0x1c3029,
    islandRock: 0x15251f,
    wall: 0x17322a,
    wood: 0x25463d,
    woodDeep: 0x12231d,
    woodLight: 0x31594b,
    brass: 0xa8853c,
    gold: 0xd1b17a,
    paper: 0xe6d5ad,
    warm: 0xffc879
  };

  var OUTFIT_STYLES = {
    '玉绿长衫': { robe: 0x3f6b58, trim: 0xc9a86a, pants: 0x243a31, belt: 0x9c7a3e, style: 'long', hat: 'scholar', skin: 0xc9a882, hair: 0x1b1512, sleeve: 0.13 },
    '灰青短褂': { robe: 0x50636a, trim: 0xb6a888, pants: 0x2f3333, belt: 0x5a4c36, style: 'short', hat: 'headband', skin: 0xbe926d, hair: 0x1a1714, sleeve: 0.14 },
    '米白直裰': { robe: 0xd0c6a4, trim: 0x6f5430, pants: 0x6b5a42, belt: 0x7b5b34, style: 'long', hat: 'bun', skin: 0xd2ad84, hair: 0x211a16, sleeve: 0.12 },
    '赭褐短打': { robe: 0x8a5b36, trim: 0x4a3320, pants: 0x3b2b1d, belt: 0x2f2118, style: 'short', hat: 'straw', skin: 0xb9865f, hair: 0x1b1512, sleeve: 0.15 },
    '靛蓝宽袖': { robe: 0x35506a, trim: 0xaab2b8, pants: 0x222c38, belt: 0x8a9aa8, style: 'wide', hat: 'cap', skin: 0xc9a882, hair: 0x171310, sleeve: 0.18 },
    '绛红披风': { robe: 0x6e2f2a, trim: 0xd1b17a, pants: 0x2a1a18, belt: 0x1e1412, style: 'cloak', hat: 'topknot', skin: 0xd2ad84, hair: 0x211a16, sleeve: 0.13 }
  };
  var OUTFIT_COLORS = {};
  Object.keys(OUTFIT_STYLES).forEach(function (k) { OUTFIT_COLORS[k] = OUTFIT_STYLES[k].robe; });
  var STAGE_COLORS = {
    raw: 0x8a7b55, warm: 0xa98c4f, perfect: 0xc8a95e, over: 0x6f4a33, burned: 0x241c18
  };

  function create(canvas, opts) {
    global.__QH_SCENE_COUNT__ = (global.__QH_SCENE_COUNT__ || 0) + 1;
    var sceneId = global.__QH_SCENE_COUNT__;
    opts = opts || {};
    if (typeof THREE === 'undefined') return null;

    var renderer;
    try {
      var probe = document.createElement('canvas');
      var probeGl = probe.getContext('webgl2') || probe.getContext('webgl') || probe.getContext('experimental-webgl');
      if (!probeGl) return null;
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      if (!renderer.getContext()) return null;
    } catch (e) {
      return null;
    }

    var reduced = !!opts.reducedMotion;
    var modelAssets = global.QH_MODELS ? global.QH_MODELS.create() : null;
    var mobileModels = !!(modelAssets && modelAssets.tier === 'mobile');
    var interiorModelsStarted = false;
    var modelTasks = [];
    var attachedModels = [];
    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2(-10, -10);
    var downPos = null;
    var hoveredTarget = null;
    var pickCb = null;
    var hitTypes = ['door'];
    var mode = 'exterior';
    var running = true;
    var lastTs = performance.now();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileModels ? 1.25 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(PALETTE.bg, 0);
    renderer.shadowMap.enabled = !mobileModels;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var scene = new THREE.Scene();
    scene.background = null;

    var camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
    var camPos = new THREE.Vector3(0, 4.4, 13.6);
    var camLook = new THREE.Vector3(0, 2.5, 1.2);
    var camPosTarget = camPos.clone();
    var camLookTarget = camLook.clone();
    var camSpeed = 3.2;

    var exterior = new THREE.Group();
    var interior = new THREE.Group();
    scene.add(exterior);
    scene.add(interior);
    interior.visible = false;

    /* ------------------------------------------------------------------ */
    /* 纹理工具                                                            */
    /* ------------------------------------------------------------------ */
    function canvasTexture(w, h, draw) {
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      draw(ctx, w, h);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }

    function shade(hex, amt) {
      var r = Math.max(0, Math.min(255, ((hex >> 16) & 255) + amt));
      var g = Math.max(0, Math.min(255, ((hex >> 8) & 255) + amt));
      var b = Math.max(0, Math.min(255, (hex & 255) + amt));
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function woodTexture(baseHex, planks, seed) {
      var n = seed || 7;
      function rnd() { n = (n * 16807) % 2147483647; return n / 2147483647; }
      return canvasTexture(512, 512, function (ctx, w, h) {
        ctx.fillStyle = shade(baseHex, 0);
        ctx.fillRect(0, 0, w, h);
        var ph = h / planks;
        for (var i = 0; i < planks; i++) {
          ctx.fillStyle = shade(baseHex, Math.round((rnd() - 0.5) * 18));
          ctx.fillRect(0, i * ph, w, ph);
          for (var g = 0; g < 20; g++) {
            ctx.strokeStyle = 'rgba(0,0,0,' + (0.02 + rnd() * 0.045).toFixed(3) + ')';
            ctx.lineWidth = 0.6 + rnd() * 1.7;
            var y0 = i * ph + rnd() * ph;
            ctx.beginPath();
            ctx.moveTo(-10, y0);
            for (var x = 0; x <= w + 10; x += 26) {
              ctx.lineTo(x, y0 + Math.sin(x * 0.02 + i * 2) * 1.4);
            }
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(0,0,0,0.26)';
          ctx.fillRect(0, i * ph, w, 1.3);
        }
      });
    }

    function signTexture(text, vertical) {
      return canvasTexture(vertical ? 256 : 512, vertical ? 640 : 160, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2b1a12');
        g.addColorStop(1, '#150d08');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#a8853c';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = '#dcb768';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,200,90,0.55)';
        ctx.shadowBlur = 18;
        if (vertical) {
          ctx.font = 'bold 108px "Songti SC","STSong",SimSun,serif';
          var chars = text.split('');
          for (var i = 0; i < chars.length; i++) {
            ctx.fillText(chars[i], w / 2, h / 2 + (i - (chars.length - 1) / 2) * 132);
          }
        } else {
          ctx.font = 'bold 104px "Songti SC","STSong",SimSun,serif';
          ctx.fillText(text, w / 2, h / 2 + 4);
        }
      });
    }

    /* ------------------------------------------------------------------ */
    /* 外景：星海、浮岛、药馆、双门                                        */
    /* ------------------------------------------------------------------ */
    var extLights = new THREE.Group();
    exterior.add(extLights);

    scene.add(new THREE.AmbientLight(0x36544a, 0.62));
    var extHemi = new THREE.HemisphereLight(0x7aa393, 0x0b1714, 0.58);
    exterior.add(extHemi);

    var moon = new THREE.DirectionalLight(0xbfd8c8, 0.85);
    moon.position.set(9, 14, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -12;
    moon.shadow.camera.right = 12;
    moon.shadow.camera.top = 12;
    moon.shadow.camera.bottom = -8;
    moon.shadow.bias = -0.0012;
    moon.shadow.normalBias = 0.055;
    exterior.add(moon);

    // 星海
    var starCount = 620;
    var starGeo = new THREE.BufferGeometry();
    var starPos = new Float32Array(starCount * 3);
    for (var si = 0; si < starCount; si++) {
      starPos[si * 3] = (Math.random() - 0.5) * 80;
      starPos[si * 3 + 1] = Math.random() * 30 - 3;
      starPos[si * 3 + 2] = -14 - Math.random() * 36;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0x9fc7b6, size: 0.13, transparent: true, opacity: 0.72, depthWrite: false, fog: false
    }));
    exterior.add(stars);

    // 封面图由 CSS 背景承载（file:// 下也不会触发 CORS，且背景不参与射线拾取）
    var extRoot = new THREE.Group();
    exterior.add(extRoot);
    extRoot.position.y = 0.1;

    var extWoodTex = woodTexture(0x1d4036, 6, 11);
    extWoodTex.wrapS = extWoodTex.wrapT = THREE.RepeatWrapping;
    extWoodTex.repeat.set(2, 2);
    var extStoneTex = woodTexture(0x243a33, 4, 23);
    extStoneTex.wrapS = extStoneTex.wrapT = THREE.RepeatWrapping;

    var EXT_MAT = {
      wood: new THREE.MeshStandardMaterial({ map: extWoodTex, color: 0x77907f, roughness: 0.82, metalness: 0.04, emissive: 0x0a1b15, emissiveIntensity: 0.35 }),
      woodDeep: new THREE.MeshStandardMaterial({ color: 0x13261f, roughness: 0.92, emissive: 0x07110d, emissiveIntensity: 0.4 }),
      stone: new THREE.MeshStandardMaterial({ map: extStoneTex, color: 0x5e7568, roughness: 0.95 }),
      brass: new THREE.MeshStandardMaterial({ color: 0x9a7a36, roughness: 0.38, metalness: 0.7 }),
      roof: new THREE.MeshStandardMaterial({
        color: 0x193b32, roughness: 0.62, metalness: 0.15,
        side: THREE.DoubleSide, emissive: 0x102b23, emissiveIntensity: 0.55
      }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffc879, transparent: true, opacity: 0.5 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x13231e, roughness: 1 })
    };

    // 浮岛：分层岩壁 + 苔藓岩缘 + 碎石/垂根 + 雾环（程序几何，随 GLB 建筑一起浮动）
    function hash2(x, y) {
      var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    }

    function islandRockTexture() {
      return canvasTexture(512, 512, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#35483d');
        g.addColorStop(0.45, '#24342d');
        g.addColorStop(1, '#1d2a24');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // 层理
        for (var i = 0; i < 28; i++) {
          var y = (i / 28) * h + (hash2(i, 3) - 0.5) * 12;
          ctx.strokeStyle = 'rgba(150, 168, 150, ' + (0.035 + hash2(i, 5) * 0.05).toFixed(3) + ')';
          ctx.lineWidth = 1 + hash2(i, 7) * 2.4;
          ctx.beginPath();
          for (var x = -8; x <= w + 8; x += 22) {
            var yy = y + Math.sin(x * 0.018 + i) * 2.2;
            if (x < 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
          }
          ctx.stroke();
        }
        // 裂缝
        for (i = 0; i < 34; i++) {
          var x0 = hash2(i, 11) * w;
          var y0 = hash2(i, 13) * h;
          ctx.strokeStyle = 'rgba(3, 8, 6, ' + (0.35 + hash2(i, 15) * 0.35).toFixed(3) + ')';
          ctx.lineWidth = 1 + hash2(i, 17) * 1.6;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          for (var s = 1; s <= 4; s++) {
            ctx.lineTo(x0 + (hash2(i, s + 21) - 0.5) * 38, y0 + s * 14 + hash2(i, s + 31) * 10);
          }
          ctx.stroke();
        }
        // 苔斑
        for (i = 0; i < 46; i++) {
          var mx = hash2(i, 41) * w;
          var my = hash2(i, 43) * h * 0.45;
          ctx.fillStyle = 'rgba(70, 112, 82, ' + (0.06 + hash2(i, 45) * 0.12).toFixed(3) + ')';
          ctx.beginPath();
          ctx.ellipse(mx, my, 8 + hash2(i, 47) * 20, 4 + hash2(i, 49) * 9, hash2(i, 51) * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        // 石粒
        for (i = 0; i < 320; i++) {
          var v = Math.floor(80 + hash2(i, 61) * 55);
          ctx.fillStyle = 'rgba(' + v + ',' + (v + 8) + ',' + (v + 2) + ',' + (0.03 + hash2(i, 63) * 0.07).toFixed(3) + ')';
          ctx.fillRect(hash2(i, 65) * w, hash2(i, 67) * h, 1 + hash2(i, 69) * 2, 1 + hash2(i, 71) * 2);
        }
      });
    }

    function buildFloatingIsland() {
      var group = new THREE.Group();
      group.name = 'floating-island';
      var seg = 56;
      var rings = [
        { y: 0.24, r: 4.25, j: 0.06 },
        { y: 0.10, r: 4.55, j: 0.12 },
        { y: -0.42, r: 4.50, j: 0.18 },
        { y: -0.95, r: 4.25, j: 0.22 },
        { y: -1.05, r: 4.58, j: 0.24 },
        { y: -1.65, r: 4.05, j: 0.28 },
        { y: -2.00, r: 3.82, j: 0.30 },
        { y: -2.70, r: 3.26, j: 0.33 },
        { y: -2.35, r: 3.55, j: 0.31 },
        { y: -3.10, r: 2.95, j: 0.34 },
        { y: -3.52, r: 2.64, j: 0.35 },
        { y: -4.38, r: 1.96, j: 0.35 },
        { y: -3.95, r: 2.30, j: 0.36 },
        { y: -4.85, r: 1.60, j: 0.34 },
        { y: -5.30, r: 1.24, j: 0.32 },
        { y: -6.04, r: 0.56, j: 0.20 },
        { y: -5.70, r: 0.85, j: 0.28 },
        { y: -6.40, r: 0.25, j: 0.10 }
      ];
      var pos = [], col = [], idx = [], uvs = [];
      var cMoss = new THREE.Color(0x2a4132).convertSRGBToLinear();
      var cRock = new THREE.Color(0x22332b).convertSRGBToLinear();
      var cDark = new THREE.Color(0x17251f).convertSRGBToLinear();
      var cLight = new THREE.Color(0x3a5044).convertSRGBToLinear();
      var cWarm = new THREE.Color(0x352b20).convertSRGBToLinear();
      var tmp = new THREE.Color();

      function pushVertex(x, y, z, ringI, ang, j) {
        pos.push(x, y, z);
        uvs.push((Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 3, (y + 6.55) / 6.8 * 1.7);
        var t = Math.max(0, Math.min(1, (-y + 0.2) / 6.4));
        tmp.copy(cMoss).lerp(cRock, Math.min(1, t * 2.4)).lerp(cDark, Math.max(0, t - 0.45) * 1.4);
        if (ringI > 0 && ringI < 6) {
          var band = Math.sin(y * 4.6 + ang * 2.4) * 0.5 + 0.5;
          if (band > 0.78) tmp.lerp(cLight, 0.35);
        }
        if (hash2(j * 4.7, ringI * 9.1) > 0.94) tmp.lerp(cWarm, 0.55);
        tmp.multiplyScalar(0.82 + hash2(j * 7.3, ringI * 3.7) * 0.32);
        col.push(tmp.r, tmp.g, tmp.b);
      }

      var ringStart = [];
      for (var i = 0; i < rings.length; i++) {
        ringStart.push(pos.length / 3);
        for (var j = 0; j < seg; j++) {
          var ang = j / seg * Math.PI * 2;
          var low = 1 + Math.sin(ang * 3 + i * 0.8) * 0.07 + Math.sin(ang * 5 - i * 1.15) * 0.035;
          var r = rings[i].r * low * (1 + (hash2(j * 1.7 + 3.2, i * 3.1) - 0.5) * 2 * rings[i].j);
          var y = rings[i].y + (hash2(j * 2.3 + 5.1, i * 5.7) - 0.5) * 0.2;
          pushVertex(Math.cos(ang) * r, y, Math.sin(ang) * r, i, ang, j);
        }
      }
      for (i = 0; i < rings.length - 1; i++) {
        for (j = 0; j < seg; j++) {
          var a = ringStart[i] + j;
          var b = ringStart[i] + (j + 1) % seg;
          var c = ringStart[i + 1] + j;
          var d = ringStart[i + 1] + (j + 1) % seg;
          idx.push(a, c, b, b, c, d);
        }
      }
      var topCenter = pos.length / 3;
      pushVertex(0, 0.18, 0, 0, 0, 0);
      for (j = 0; j < seg; j++) {
        idx.push(topCenter, ringStart[0] + (j + 1) % seg, ringStart[0] + j);
      }
      var tip = pos.length / 3;
      pushVertex(0, -6.55, 0, rings.length - 1, 0, 0);
      var last = ringStart[rings.length - 1];
      for (j = 0; j < seg; j++) {
        idx.push(tip, last + j, last + (j + 1) % seg);
      }

      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      var rockMap = islandRockTexture();
      rockMap.wrapS = rockMap.wrapT = THREE.RepeatWrapping;
      var mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: rockMap, color: 0xffffff, roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide
      }));
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      group.add(mesh);

      // 大型岩脊，打破圆柱轮廓
      var buttressMat = new THREE.MeshStandardMaterial({
        map: rockMap, color: 0x87998d, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide
      });
      for (i = 0; i < 7; i++) {
        var ba = i / 7 * Math.PI * 2 + 0.7;
        var br = 3.15 + hash2(i, 151) * 0.7;
        var buttress = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), buttressMat);
        buttress.position.set(Math.cos(ba) * br, -1.15 - hash2(i, 153) * 1.6, Math.sin(ba) * br);
        buttress.scale.set(1.1 + hash2(i, 155) * 0.9, 1.5 + hash2(i, 157) * 1.3, 0.9 + hash2(i, 159) * 0.8);
        buttress.rotation.set(hash2(i, 161) * 2, hash2(i, 163) * 2, hash2(i, 165) * 2);
        buttress.castShadow = true;
        group.add(buttress);
      }

      // 岩缘碎石
      var rockGeo = new THREE.IcosahedronGeometry(0.32, 0);
      var rimRockMat = new THREE.MeshStandardMaterial({
        map: rockMap, color: 0x87958a, roughness: 0.98, flatShading: true
      });
      for (i = 0; i < 16; i++) {
        var ra = i / 16 * Math.PI * 2 + hash2(i, 2) * 0.5;
        var rr = 3.95 + hash2(i, 4) * 0.62;
        var rs = 0.35 + hash2(i, 6) * 0.65;
        var rimRock = new THREE.Mesh(rockGeo, rimRockMat);
        rimRock.position.set(Math.cos(ra) * rr, 0.2 + hash2(i, 8) * 0.12, Math.sin(ra) * rr);
        rimRock.scale.set(rs, rs * 0.72, rs);
        rimRock.rotation.set(hash2(i, 10) * 3, hash2(i, 12) * 3, hash2(i, 14) * 3);
        rimRock.castShadow = true;
        group.add(rimRock);
      }

      // 苔草小簇
      var grassMat = new THREE.MeshStandardMaterial({ color: 0x24352a, roughness: 0.98 });
      var bladeGeo = new THREE.ConeGeometry(0.028, 0.12, 4);
      for (i = 0; i < 22; i++) {
        var ga = i / 22 * Math.PI * 2 + hash2(i, 21) * 0.5;
        var gr = 3.45 + hash2(i, 23) * 0.85;
        var gx = Math.cos(ga) * gr, gz = Math.sin(ga) * gr;
        for (var k = 0; k < 2; k++) {
          var blade = new THREE.Mesh(bladeGeo, grassMat);
          blade.position.set(gx + (hash2(i, k + 31) - 0.5) * 0.18, 0.22 + k * 0.02,
            gz + (hash2(i, k + 41) - 0.5) * 0.18);
          blade.rotation.z = (hash2(i, k + 51) - 0.5) * 0.7;
          blade.rotation.x = (hash2(i, k + 61) - 0.5) * 0.5;
          group.add(blade);
        }
      }

      // 垂根与藤叶
      var rootMat = new THREE.MeshStandardMaterial({ color: 0x3b2f22, roughness: 0.98 });
      var leafMat = new THREE.MeshStandardMaterial({ color: 0x2f513f, roughness: 0.95 });
      for (i = 0; i < 12; i++) {
        var va = i / 12 * Math.PI * 2 + 0.4;
        var vr = 3.65 + hash2(i, 71) * 0.5;
        var len = 1.1 + hash2(i, 73) * 2.1;
        var root = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.05, len, 5), rootMat);
        root.position.set(Math.cos(va) * vr, 0.12 - len / 2, Math.sin(va) * vr);
        root.rotation.z = (hash2(i, 75) - 0.5) * 0.18;
        root.rotation.x = (hash2(i, 77) - 0.5) * 0.18;
        group.add(root);
        for (var li = 0; li < 3; li++) {
          var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 4), leafMat);
          leaf.position.set(Math.cos(va) * vr + (hash2(i, li + 81) - 0.5) * 0.22,
            0.02 - li * 0.32, Math.sin(va) * vr + (hash2(i, li + 91) - 0.5) * 0.22);
          leaf.rotation.z = 1.2 + (hash2(i, li + 101) - 0.5);
          group.add(leaf);
        }
      }

      // 悬浮碎岩
      var shards = [];
      var shardMat = new THREE.MeshStandardMaterial({
        map: rockMap, color: 0xd2dad2, roughness: 0.96, flatShading: true
      });
      for (i = 0; i < 12; i++) {
        var sa = i / 12 * Math.PI * 2 + 0.8;
        var sr = 5.0 + hash2(i, 111) * 2.4;
        var shard = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), shardMat);
        shard.position.set(Math.cos(sa) * sr, -1.4 - hash2(i, 113) * 3.4, Math.sin(sa) * sr);
        shard.scale.set(0.6 + hash2(i, 115) * 1.5, 0.5 + hash2(i, 117) * 1.1, 0.6 + hash2(i, 119) * 1.2);
        shard.rotation.set(hash2(i, 121) * 3, hash2(i, 123) * 3, hash2(i, 125) * 3);
        shard.userData.baseY = shard.position.y;
        shard.castShadow = true;
        shards.push(shard);
        group.add(shard);
      }

      // 房子两侧的漂浮岩块：更高、更显眼，但不阻挡双门
      var sideRocks = [
        [-6.9, 1.7, 1.2, 1.25], [-8.2, 2.7, -0.6, 1.55], [-6.2, 3.0, -1.8, 0.85],
        [-7.5, 0.9, 2.6, 0.7], [-9.0, 1.4, 1.6, 1.0],
        [6.6, 1.9, 1.0, 1.35], [8.0, 2.9, -0.8, 1.7], [6.1, 3.3, -1.9, 0.8],
        [7.2, 0.8, 2.7, 0.65], [9.1, 1.6, 1.5, 1.05],
        [-5.8, 2.2, 3.0, 0.55], [5.7, 2.5, 3.1, 0.5]
      ];
      for (i = 0; i < sideRocks.length; i++) {
        var srk = sideRocks[i];
        var rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), shardMat);
        rock.position.set(srk[0], srk[1], srk[2]);
        rock.scale.set(srk[3] * (0.8 + hash2(i, 171) * 0.5), srk[3] * (0.55 + hash2(i, 173) * 0.45),
          srk[3] * (0.7 + hash2(i, 175) * 0.5));
        rock.scale.multiplyScalar(0.82);
        rock.rotation.set(hash2(i, 177) * 3, hash2(i, 179) * 3, hash2(i, 181) * 3);
        rock.userData.baseY = rock.position.y;
        rock.castShadow = true;
        shards.push(rock);
        group.add(rock);
      }
      group.userData.shards = shards;

      // 底部薄雾
      var mistTex = canvasTexture(128, 128, function (ctx, w, h) {
        var g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(150, 195, 175, 0.34)');
        g.addColorStop(0.55, 'rgba(120, 160, 145, 0.12)');
        g.addColorStop(1, 'rgba(120, 160, 145, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });
      for (i = 0; i < 6; i++) {
        var mistMat = new THREE.SpriteMaterial({
          map: mistTex, transparent: true, opacity: 0.10, depthWrite: false,
          blending: THREE.AdditiveBlending
        });
        var mist = new THREE.Sprite(mistMat);
        var ma = i / 6 * Math.PI * 2 + 0.3;
        mist.position.set(Math.cos(ma) * (4.0 + hash2(i, 131) * 1.6), -2.8 - hash2(i, 133) * 2.6,
          Math.sin(ma) * (4.0 + hash2(i, 135) * 1.6));
        mist.scale.set(4.5 + hash2(i, 137) * 3.0, 3.0 + hash2(i, 139) * 2.0, 1);
        group.add(mist);
      }

      return group;
    }

    var islandGroup = buildFloatingIsland();
    islandGroup.position.set(0.4, 0, 0);
    extRoot.add(islandGroup);

    // 台基
    var platform = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.42, 5.2), EXT_MAT.stone);
    platform.position.set(0.4, 0.42, 0);
    platform.castShadow = true;
    platform.receiveShadow = true;
    extRoot.add(platform);
    var step1 = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 0.8), EXT_MAT.stone);
    step1.position.set(0.4, 0.28, 2.9);
    extRoot.add(step1);
    var step2 = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 1.0), EXT_MAT.stone);
    step2.position.set(0.4, 0.14, 3.7);
    extRoot.add(step2);

    // 主殿
    var hall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.0, 4.1), EXT_MAT.wood);
    hall.position.set(0.4, 2.1, 0);
    hall.castShadow = true;
    hall.receiveShadow = true;
    extRoot.add(hall);

    // 立柱
    for (var ci = 0; ci < 4; ci++) {
      var col = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 3.0, 10), EXT_MAT.woodDeep);
      col.position.set(-2.3 + ci * 1.8, 2.1, 2.06);
      col.castShadow = true;
      extRoot.add(col);
    }
    var beam = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.24, 0.34), EXT_MAT.woodDeep);
    beam.position.set(0.4, 3.6, 2.1);
    extRoot.add(beam);

    // 屋顶（两级）
    function roof(width, depth, y, height, topScale) {
      var g = new THREE.Group();
      var lower = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.09, width, height, 4, 1), EXT_MAT.roof);
      lower.rotation.y = Math.PI / 4;
      lower.scale.z = depth / width;
      lower.castShadow = true;
      g.add(lower);
      var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, width * 0.1, height * 0.25, 4, 1), EXT_MAT.brass);
      cap.rotation.y = Math.PI / 4;
      cap.scale.z = depth / width;
      cap.position.y = height * 0.62;
      g.add(cap);
      g.position.y = y;
      return g;
    }
    extRoot.add(roof(5.6, 4.4, 3.62, 1.4, 0.2));
    var upper = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.9, 2.0), EXT_MAT.wood);
    upper.position.set(0.4, 5.02, 0);
    extRoot.add(upper);
    extRoot.add(roof(3.2, 2.8, 5.52, 1.15, 0.2));

    // 匾额
    var plaqueTex = signTexture('岐 黄 堂', false);
    var plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.62),
      new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.6, metalness: 0.1, emissive: 0x2a1a06, emissiveIntensity: 0.55 }));
    plaque.position.set(0.4, 3.22, 2.11);
    extRoot.add(plaque);

    // 双门
    var doors = {};
    var doorHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    function buildDoor(key, x, title, vertical) {
      var group = new THREE.Group();
      group.position.set(x, 0.62, 2.12);
      extRoot.add(group);

      var glow = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 1.92), EXT_MAT.glow.clone());
      glow.position.set(0, 0.96, -0.04);
      group.add(glow);

      var frameMat = new THREE.MeshStandardMaterial({
        color: 0x2a4a3e, roughness: 0.7, metalness: 0.18,
        emissive: 0xd1b17a, emissiveIntensity: 0.02
      });
      var frame = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.2, 0.18), frameMat);
      frame.position.set(0, 0.96, 0);
      group.add(frame);

      var inner = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 1.96), new THREE.MeshBasicMaterial({ color: 0x050b09 }));
      inner.position.set(0, 0.96, 0.02);
      group.add(inner);

      var panelMat = new THREE.MeshStandardMaterial({ color: 0x2e5749, roughness: 0.7, metalness: 0.08 });
      var leftPivot = new THREE.Group();
      leftPivot.position.set(-0.68, 0.96, 0.1);
      var rightPivot = new THREE.Group();
      rightPivot.position.set(0.68, 0.96, 0.1);
      var lp = new THREE.Mesh(new THREE.BoxGeometry(0.67, 1.92, 0.08), panelMat);
      lp.position.set(0.335, 0, 0);
      var rp = new THREE.Mesh(new THREE.BoxGeometry(0.67, 1.92, 0.08), panelMat);
      rp.position.set(-0.335, 0, 0);
      leftPivot.add(lp);
      rightPivot.add(rp);
      group.add(leftPivot, rightPivot);

      // 门环
      [-0.3, 0.3].forEach(function (dx) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 14), EXT_MAT.brass);
        ring.position.set(dx, 0.88, 0.16);
        group.add(ring);
      });

      // 门牌
      var sign = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.5 : 0.9, vertical ? 1.25 : 0.28),
        new THREE.MeshStandardMaterial({ map: signTexture(title, vertical), roughness: 0.6, emissive: 0x201306, emissiveIntensity: 0.45 }));
      sign.position.set(0, 2.38, 0.1);
      group.add(sign);
      var signBack = new THREE.Mesh(new THREE.BoxGeometry(vertical ? 0.58 : 0.98, vertical ? 1.34 : 0.36, 0.07), EXT_MAT.woodDeep);
      signBack.position.set(0, 2.38, 0.05);
      group.add(signBack);

      // 射线命中区（不可见，但与门同大的真实 3D 对象）
      var hit = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.4, 0.35), doorHitMat);
      hit.position.set(0, 0.95, 0.12);
      hit.userData.qh = { type: 'door', door: key };
      group.add(hit);

      doors[key] = {
        group: group, leftPivot: leftPivot, rightPivot: rightPivot,
        frameMat: frameMat, glow: glow, hit: hit, open: 0, openTarget: 0,
        hover: false, persistent: false
      };
    }

    buildDoor('acute', 1.55, '急症候', true);
    buildDoor('chronicle', -1.55, '行医录', true);

    // 灯笼与浮石
    function extLantern(x, y, z) {
      var g = new THREE.Group();
      g.position.set(x, y, z);
      var body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0x6f1c15, roughness: 0.6, emissive: 0xff6230, emissiveIntensity: 0.7 }));
      body.scale.set(1, 0.9, 1);
      g.add(body);
      var light = new THREE.PointLight(0xffa860, 0.75, 7, 1.8);
      g.add(light);
      extRoot.add(g);
      return g;
    }
    extLantern(-2.6, 3.0, 2.5);
    extLantern(3.4, 3.0, 2.5);

    var extDoorLight = new THREE.PointLight(0xffc879, 0.55, 8, 1.8);
    extDoorLight.position.set(0.4, 2.2, 3.6);
    exterior.add(extDoorLight);

    // 浮岛前侧冷色补光：只提亮岩壁，不抢建筑主光
    var islandFill = new THREE.PointLight(0x5c8f7d, 1.65, 16, 1.8);
    islandFill.position.set(0.4, -2.7, 4.2);
    exterior.add(islandFill);
    var islandFillBack = new THREE.PointLight(0x4f7f70, 0.75, 16, 1.8);
    islandFillBack.position.set(0.4, -3.3, -3.5);
    exterior.add(islandFillBack);
    var islandRim = new THREE.PointLight(0x3f6f66, 0.4, 14, 1.8);
    islandRim.position.set(-5.5, -2.2, 2.5);
    exterior.add(islandRim);

    // 外景机位
    var EXT_DEFAULT = { pos: new THREE.Vector3(0.4, 4.5, 13.8), look: new THREE.Vector3(0.4, 2.45, 1.2) };
    var EXT_APPROACH = {
      acute: { pos: new THREE.Vector3(1.63, 2.6, 7.0), look: new THREE.Vector3(1.63, 2.15, 2.0) },
      chronicle: { pos: new THREE.Vector3(-1.06, 2.6, 7.0), look: new THREE.Vector3(-1.06, 2.15, 2.0) }
    };

    /* ------------------------------------------------------------------ */
    /* 内景                                                                */
    /* ------------------------------------------------------------------ */
    var inLights = new THREE.Group();
    interior.add(inLights);

    var floorTex = woodTexture(0x2a2b22, 10, 31);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);
    var woodTex = woodTexture(0x332a1e, 7, 47);
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
    woodTex.repeat.set(2, 2);

    var plasterTex = canvasTexture(512, 512, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#c9b88f');
      g.addColorStop(0.55, '#b7a47c');
      g.addColorStop(1, '#a08c68');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var lightFiber = hash2(i, 201) > 0.5;
        ctx.fillStyle = lightFiber
          ? 'rgba(255, 248, 228, ' + (0.02 + hash2(i, 203) * 0.05).toFixed(3) + ')'
          : 'rgba(58, 44, 26, ' + (0.02 + hash2(i, 205) * 0.04).toFixed(3) + ')';
        ctx.fillRect(hash2(i, 207) * w, hash2(i, 209) * h,
          1 + hash2(i, 211) * 3, 1 + hash2(i, 213) * 1.5);
      }
      for (i = 0; i < 9; i++) {
        var cx = hash2(i, 221) * w, cy = hash2(i, 223) * h;
        var rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 40 + hash2(i, 225) * 90);
        rg.addColorStop(0, 'rgba(74, 56, 32, 0.05)');
        rg.addColorStop(1, 'rgba(74, 56, 32, 0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
    });
    plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
    plasterTex.repeat.set(2.4, 1.4);

    var windowTex = canvasTexture(512, 512, function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fff4d2');
      g.addColorStop(0.45, '#e6eccb');
      g.addColorStop(1, '#a9bfa0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 竹影
      ctx.strokeStyle = 'rgba(48, 82, 58, 0.22)';
      for (var b = 0; b < 5; b++) {
        var x = 70 + b * 92 + (hash2(b, 231) - 0.5) * 30;
        ctx.lineWidth = 3 + hash2(b, 233) * 4;
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + 12, h * 0.55, x - 6, 0);
        ctx.stroke();
        for (var l = 0; l < 12; l++) {
          var ly = h * (0.1 + hash2(b, l + 241) * 0.8);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, ly);
          ctx.lineTo(x + (hash2(b, l + 251) - 0.5) * 70, ly - 10 - hash2(b, l + 261) * 18);
          ctx.stroke();
        }
      }
      var v = ctx.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, h * 0.7);
      v.addColorStop(0, 'rgba(255,255,240,0)');
      v.addColorStop(1, 'rgba(70, 90, 62, 0.18)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, w, h);
    });

    var rugTex = canvasTexture(512, 256, function (ctx, w, h) {
      ctx.fillStyle = '#223b30';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#b08b45';
      ctx.lineWidth = 8;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.strokeStyle = 'rgba(176,139,69,0.55)';
      for (var i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(50 + i * 44, 38);
        ctx.lineTo(74 + i * 44, h / 2);
        ctx.lineTo(50 + i * 44, h - 38);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
      ctx.strokeStyle = '#b08b45';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(176,139,69,0.35)';
      for (i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(a) * 62, h / 2 + Math.sin(a) * 62, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    var panelInkTex = canvasTexture(512, 512, function (ctx, w, h) {
      ctx.fillStyle = '#e3d1a6';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        ctx.fillStyle = 'rgba(90,70,40,' + (0.012 + hash2(i, 351) * 0.03).toFixed(3) + ')';
        ctx.fillRect(hash2(i, 353) * w, hash2(i, 355) * h, 1 + hash2(i, 357) * 2, 1);
      }
      ctx.strokeStyle = 'rgba(34, 45, 36, 0.42)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(20, h * 0.68);
      ctx.bezierCurveTo(w * 0.18, h * 0.38, w * 0.30, h * 0.60, w * 0.44, h * 0.34);
      ctx.bezierCurveTo(w * 0.58, h * 0.12, w * 0.70, h * 0.52, w * 0.90, h * 0.30);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(34, 45, 36, 0.26)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(20, h * 0.75);
      ctx.bezierCurveTo(w * 0.28, h * 0.55, w * 0.42, h * 0.68, w * 0.58, h * 0.48);
      ctx.bezierCurveTo(w * 0.74, h * 0.30, w * 0.84, h * 0.55, w * 0.94, h * 0.44);
      ctx.stroke();
      ctx.fillStyle = 'rgba(160, 60, 42, 0.65)';
      ctx.fillRect(w - 74, h - 86, 30, 30);
      ctx.strokeStyle = 'rgba(240, 223, 183, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(w - 69, h - 81, 20, 20);
    });

    function scrollTexture(kind) {
      return canvasTexture(256, 640, function (ctx, w, h) {
        ctx.fillStyle = '#e5d3a8';
        ctx.fillRect(0, 0, w, h);
        for (var i = 0; i < 700; i++) {
          ctx.fillStyle = 'rgba(90,70,40,' + (0.015 + hash2(i, 271) * 0.035).toFixed(3) + ')';
          ctx.fillRect(hash2(i, 273) * w, hash2(i, 275) * h, 1 + hash2(i, 277) * 2, 1);
        }
        ctx.strokeStyle = 'rgba(34,45,36,0.72)';
        ctx.lineWidth = 3;
        if (kind === 'bamboo') {
          for (var b = 0; b < 3; b++) {
            var x = w * (0.3 + b * 0.2);
            ctx.beginPath();
            ctx.moveTo(x, h * 0.85);
            ctx.quadraticCurveTo(x + 10, h * 0.5, x - 4, h * 0.14);
            ctx.stroke();
            for (var l = 0; l < 9; l++) {
              var y = h * (0.18 + l * 0.07);
              ctx.lineWidth = 1.8;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + (l % 2 ? 1 : -1) * (18 + hash2(b, l + 281) * 18), y - 8);
              ctx.stroke();
            }
          }
        } else {
          ctx.beginPath();
          ctx.moveTo(10, h * 0.62);
          ctx.bezierCurveTo(w * 0.2, h * 0.36, w * 0.3, h * 0.5, w * 0.46, h * 0.3);
          ctx.bezierCurveTo(w * 0.62, h * 0.12, w * 0.75, h * 0.36, w * 0.92, h * 0.22);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(10, h * 0.68);
          ctx.bezierCurveTo(w * 0.28, h * 0.5, w * 0.42, h * 0.62, w * 0.58, h * 0.44);
          ctx.bezierCurveTo(w * 0.74, h * 0.28, w * 0.82, h * 0.5, w * 0.92, h * 0.4);
          ctx.stroke();
          ctx.fillStyle = 'rgba(34,45,36,0.35)';
          ctx.beginPath();
          ctx.ellipse(w * 0.25, h * 0.84, 34, 10, -0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(140, 45, 36, 0.8)';
        ctx.fillRect(w - 54, h - 70, 26, 26);
        ctx.strokeStyle = 'rgba(240, 223, 183, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(w - 50, h - 66, 18, 18);
      });
    }

    var MAT = {
      floor: new THREE.MeshStandardMaterial({
        map: floorTex, bumpMap: floorTex, bumpScale: 0.02,
        color: 0xcbb58d, roughness: 0.72, metalness: 0.02
      }),
      wood: new THREE.MeshStandardMaterial({
        map: woodTex, bumpMap: woodTex, bumpScale: 0.012,
        color: 0xc2a97c, roughness: 0.8, metalness: 0.03
      }),
      woodDeep: new THREE.MeshStandardMaterial({
        map: woodTex, color: 0x4a3826, roughness: 0.86, metalness: 0.02
      }),
      wall: new THREE.MeshStandardMaterial({ map: plasterTex, color: 0xffffff, roughness: 0.96 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb08b45, roughness: 0.38, metalness: 0.72 }),
      paper: new THREE.MeshStandardMaterial({ color: 0xe0cfa6, roughness: 0.92 })
    };

    var ROOM = { x: 6.5, z: 5.0, h: 4.6 };
    var inRoot = new THREE.Group();
    interior.add(inRoot);

    function plane(w, h, mat) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.receiveShadow = true;
      return m;
    }

    var floor = plane(ROOM.x * 2, ROOM.z * 2, MAT.floor);
    floor.rotation.x = -Math.PI / 2;
    inRoot.add(floor);
    var backWall = plane(ROOM.x * 2, ROOM.h, MAT.wall);
    backWall.position.set(0, ROOM.h / 2, -ROOM.z);
    inRoot.add(backWall);
    var leftWall = plane(ROOM.z * 2, ROOM.h, MAT.wall);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-ROOM.x, ROOM.h / 2, 0);
    inRoot.add(leftWall);
    var rightWall = plane(ROOM.z * 2, ROOM.h, MAT.wall);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(ROOM.x, ROOM.h / 2, 0);
    inRoot.add(rightWall);
    var ceiling = plane(ROOM.x * 2, ROOM.z * 2, new THREE.MeshStandardMaterial({ color: 0x0e211c, roughness: 1 }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = ROOM.h;
    inRoot.add(ceiling);

    for (var bi = 0; bi < 3; bi++) {
      var ibeam = new THREE.Mesh(new THREE.BoxGeometry(ROOM.x * 2, 0.18, 0.24), MAT.woodDeep);
      ibeam.position.set(0, ROOM.h - 0.1, -3 + bi * 3);
      inRoot.add(ibeam);
    }

    function trimBox(w, h, d, x, y, z, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || MAT.woodDeep);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      inRoot.add(m);
      return m;
    }

    // 后墙护墙板与木作
    trimBox(ROOM.x * 2, 1.08, 0.10, 0, 0.54, -ROOM.z + 0.06);
    trimBox(ROOM.x * 2, 0.06, 0.16, 0, 1.10, -ROOM.z + 0.08, MAT.brass);
    trimBox(ROOM.x * 2, 0.05, 0.14, 0, 0.04, -ROOM.z + 0.08, MAT.woodDeep);
    for (var pxi = 0; pxi < 6; pxi++) {
      var px = -5.0 + pxi * 2.0;
      trimBox(1.55, 0.58, 0.035, px, 0.55, -ROOM.z + 0.125, MAT.wood);
      trimBox(1.33, 0.42, 0.025, px, 0.55, -ROOM.z + 0.148, MAT.woodDeep);
    }
    [-0.15, 2.35, 4.55].forEach(function (px2) {
      trimBox(0.15, 3.45, 0.18, px2, 2.0, -ROOM.z + 0.10);
      trimBox(0.20, 0.06, 0.22, px2, 1.12, -ROOM.z + 0.11, MAT.brass);
    });
    trimBox(ROOM.x * 2, 0.18, 0.24, 0, 3.74, -ROOM.z + 0.10);
    trimBox(ROOM.x * 2, 0.10, 0.18, 0, 4.36, -ROOM.z + 0.08, MAT.woodDeep);

    // 侧墙护墙板
    [-1, 1].forEach(function (side) {
      var wx = side * (ROOM.x - 0.06);
      trimBox(0.10, 1.08, ROOM.z * 2, wx, 0.54, 0);
      trimBox(0.16, 0.06, ROOM.z * 2, wx - side * 0.02, 1.10, 0, MAT.brass);
      for (var pz = -3.5; pz <= 3.5; pz += 1.75) {
        trimBox(0.035, 0.58, 1.48, wx - side * 0.065, 0.55, pz, MAT.wood);
        trimBox(0.025, 0.42, 1.26, wx - side * 0.085, 0.55, pz, MAT.woodDeep);
      }
    });

    // 侧墙纸面嵌板
    var sidePaperMat = new THREE.MeshStandardMaterial({ map: panelInkTex, roughness: 0.95 });
    function sidePanel(side, z, y, wz, hy) {
      var sx = side * (ROOM.x - 0.095);
      trimBox(0.05, 0.10, wz, sx, y + hy / 2, z, MAT.woodDeep);
      trimBox(0.05, 0.10, wz, sx, y - hy / 2, z, MAT.woodDeep);
      trimBox(0.05, hy, 0.10, sx, y, z - wz / 2, MAT.woodDeep);
      trimBox(0.05, hy, 0.10, sx, y, z + wz / 2, MAT.woodDeep);
      var paper = new THREE.Mesh(new THREE.PlaneGeometry(wz - 0.14, hy - 0.14), sidePaperMat);
      paper.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      paper.position.set(side * (ROOM.x - 0.125), y, z);
      inRoot.add(paper);
    }
    sidePanel(-1, -2.2, 2.55, 2.0, 1.75);
    sidePanel(-1, 1.8, 2.55, 2.0, 1.75);
    sidePanel(1, 0.7, 2.55, 1.8, 1.75);
    sidePanel(1, 2.9, 2.55, 1.4, 1.75);

    // 百子柜 6×4，仅前 11 格绑定材料
    var CAB = { x0: -5.6, x1: -0.4, y0: 0.55, y1: 3.85, z: -4.85 };
    var COLS = 6, ROWS = 4;
    var cabW = CAB.x1 - CAB.x0;
    var cabH = CAB.y1 - CAB.y0;
    var colW = cabW / COLS;
    var rowH = cabH / ROWS;
    var DW = colW - 0.09;
    var DH = rowH - 0.09;
    var DD = 0.16;

    var carcass = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.18, cabH + 0.18, 0.5), MAT.woodDeep);
    carcass.position.set((CAB.x0 + CAB.x1) / 2, (CAB.y0 + CAB.y1) / 2, CAB.z - 0.26);
    inRoot.add(carcass);
    var plinth = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.3, 0.55, 0.7), MAT.wood);
    plinth.position.set((CAB.x0 + CAB.x1) / 2, 0.275, CAB.z - 0.1);
    inRoot.add(plinth);
    var cornice = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.34, 0.16, 0.68), MAT.wood);
    cornice.position.set((CAB.x0 + CAB.x1) / 2, CAB.y1 + 0.12, CAB.z - 0.08);
    inRoot.add(cornice);

    function drawerFaceTexture(name) {
      return canvasTexture(256, 160, function (ctx, w, h) {
        var g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#2b5045');
        g.addColorStop(0.55, '#224238');
        g.addColorStop(1, '#1a342c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(8,20,16,0.85)';
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.strokeStyle = 'rgba(190,220,190,0.07)';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        if (name) {
          var pw = w * 0.68, ph = h * 0.46;
          var px = (w - pw) / 2, py = h * 0.16;
          ctx.fillStyle = '#e3d4b0';
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = 'rgba(60,40,18,0.5)';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(px, py, pw, ph);
          ctx.fillStyle = '#22352b';
          ctx.font = 'bold ' + (name.length >= 3 ? 40 : 50) + 'px "Songti SC","STSong",SimSun,serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, w / 2, py + ph / 2 + 2);
        } else {
          var pw2 = w * 0.4, ph2 = h * 0.3;
          ctx.fillStyle = 'rgba(227,212,176,0.55)';
          ctx.fillRect((w - pw2) / 2, h * 0.34, pw2, ph2);
          ctx.strokeStyle = 'rgba(20,35,28,0.5)';
          ctx.lineWidth = 2;
          ctx.strokeRect((w - pw2) / 2, h * 0.34, pw2, ph2);
        }
      });
    }

    var drawers = [];
    var drawerById = {};
    var drawerGroup = new THREE.Group();
    inRoot.add(drawerGroup);
    var sideMat = new THREE.MeshStandardMaterial({ color: 0x1d3a31, roughness: 0.9 });

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cx = CAB.x0 + colW * (c + 0.5);
        var cy = CAB.y1 - rowH * (r + 0.5);
        var faceMat = new THREE.MeshStandardMaterial({
          map: drawerFaceTexture(null), roughness: 0.82, metalness: 0.02,
          emissive: 0x6ad0a0, emissiveIntensity: 0
        });
        var mesh = new THREE.Mesh(new THREE.BoxGeometry(DW, DH, DD), [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat]);
        mesh.position.set(cx, cy, CAB.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          baseZ: CAB.z, targetZ: CAB.z, faceMat: faceMat,
          materialId: null, qh: null, hoverBoost: 0
        };
        drawerGroup.add(mesh);
        var pull = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14), MAT.brass);
        pull.position.set(cx, cy - DH * 0.3, CAB.z + DD / 2 + 0.006);
        drawerGroup.add(pull);
        drawers.push(mesh);
      }
    }

    // 柜台
    var CTR = { x0: -4.8, x1: 2.6, z0: 1.95, z1: 2.75, h: 1.02 };
    var ctrBody = new THREE.Mesh(new THREE.BoxGeometry(CTR.x1 - CTR.x0, CTR.h, CTR.z1 - CTR.z0), MAT.wood);
    ctrBody.position.set((CTR.x0 + CTR.x1) / 2, CTR.h / 2, (CTR.z0 + CTR.z1) / 2);
    ctrBody.castShadow = true;
    ctrBody.receiveShadow = true;
    inRoot.add(ctrBody);
    var ctrTop = new THREE.Mesh(new THREE.BoxGeometry(CTR.x1 - CTR.x0 + 0.2, 0.09, CTR.z1 - CTR.z0 + 0.2), MAT.woodDeep);
    ctrTop.position.set((CTR.x0 + CTR.x1) / 2, CTR.h + 0.045, (CTR.z0 + CTR.z1) / 2);
    inRoot.add(ctrTop);

    // 柜台正面嵌板、抽屉、铜饰与桌面镶嵌
    var ctrFrontZ = CTR.z1 + 0.015;
    [-3.9, -2.1, -0.3, 1.5].forEach(function (px) {
      trimBox(1.42, 0.60, 0.035, px, 0.50, ctrFrontZ, MAT.woodDeep);
      trimBox(1.20, 0.43, 0.025, px, 0.50, ctrFrontZ + 0.022, MAT.wood);
    });
    [-3.9, -2.1, -0.3, 1.5].forEach(function (px) {
      trimBox(1.30, 0.20, 0.04, px, 0.86, ctrFrontZ + 0.005, MAT.wood);
      var pull = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 16), MAT.brass);
      pull.position.set(px, 0.84, ctrFrontZ + 0.045);
      pull.rotation.x = Math.PI / 2;
      inRoot.add(pull);
      trimBox(0.10, 0.025, 0.025, px, 0.90, ctrFrontZ + 0.04, MAT.brass);
    });
    trimBox(CTR.x1 - CTR.x0 + 0.22, 0.035, 0.035, 0.2, CTR.h + 0.10, CTR.z0 - 0.08, MAT.brass);
    trimBox(CTR.x1 - CTR.x0 + 0.22, 0.035, 0.035, 0.2, CTR.h + 0.10, CTR.z1 + 0.08, MAT.brass);
    trimBox(0.035, 0.035, CTR.z1 - CTR.z0 + 0.2, CTR.x0 - 0.08, CTR.h + 0.10, 2.35, MAT.brass);
    trimBox(0.035, 0.035, CTR.z1 - CTR.z0 + 0.2, CTR.x1 + 0.08, CTR.h + 0.10, 2.35, MAT.brass);

    // 柜台上的深红桌旗
    trimBox(3.2, 0.008, 0.70, 0.2, CTR.h + 0.094, 2.35, new THREE.MeshStandardMaterial({ color: 0x223b30, roughness: 0.94 }));
    trimBox(3.2, 0.01, 0.025, 0.2, CTR.h + 0.098, 2.0, MAT.brass);
    trimBox(3.2, 0.01, 0.025, 0.2, CTR.h + 0.098, 2.7, MAT.brass);

    // 茶具与书册
    var teaMat = new THREE.MeshStandardMaterial({ color: 0x2f4438, roughness: 0.55, metalness: 0.05 });
    var teaTray = trimBox(0.55, 0.035, 0.38, -3.55, CTR.h + 0.11, 2.28, MAT.woodDeep);
    var teapot = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), teaMat);
    teapot.position.set(-3.55, CTR.h + 0.22, 2.28);
    teapot.scale.set(1, 0.82, 1);
    inRoot.add(teapot);
    var spout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.16, 6), teaMat);
    spout.position.set(-3.40, CTR.h + 0.24, 2.28);
    spout.rotation.z = -0.7;
    inRoot.add(spout);
    for (var ti = 0; ti < 3; ti++) {
      var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.055, 10), teaMat);
      cup.position.set(-3.72 + ti * 0.14, CTR.h + 0.15, 2.17 + (ti % 2) * 0.14);
      inRoot.add(cup);
    }
    for (var bki = 0; bki < 3; bki++) {
      var bk = trimBox(0.36, 0.045, 0.26, -2.55, CTR.h + 0.12 + bki * 0.045, 2.18, MAT.paper);
      bk.rotation.y = 0.08 * (bki - 1);
    }

    var book = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.46), MAT.paper);
    book.position.set(-1.2, CTR.h + 0.12, 2.3);
    book.rotation.y = 0.18;
    inRoot.add(book);
    var balanceBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 14), MAT.brass);
    balanceBase.position.set(1.55, CTR.h + 0.11, 2.3);
    inRoot.add(balanceBase);
    var balancePost = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), MAT.brass);
    balancePost.position.set(1.55, CTR.h + 0.26, 2.3);
    inRoot.add(balancePost);
    var balanceBeam = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.012, 0.012), MAT.brass);
    balanceBeam.position.set(1.55, CTR.h + 0.39, 2.3);
    inRoot.add(balanceBeam);

    // 右墙药架与罐
    var shelfX = 3.5;
    for (var ssi = 0; ssi < 3; ssi++) {
      var shelf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.34), MAT.wood);
      shelf.position.set(shelfX, 1.15 + ssi * 0.72, -4.62);
      inRoot.add(shelf);
    }
    var jarMat = new THREE.MeshStandardMaterial({ color: 0x9aa48c, roughness: 0.55 });
    var jarMat2 = new THREE.MeshStandardMaterial({ color: 0x6f8478, roughness: 0.5 });
    var jarObjects = [];
    for (var ji = 0; ji < 3; ji++) {
      for (var jj = 0; jj < 3; jj++) {
        var jh = 0.2 + ((ji * 7 + jj * 11) % 5) * 0.02;
        var jar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, jh, 12), (ji + jj) % 3 === 0 ? jarMat2 : jarMat);
        jar.position.set(shelfX - 0.55 + jj * 0.55, 1.18 + ji * 0.72 + jh / 2, -4.62);
        inRoot.add(jar);
        jarObjects.push(jar);
      }
    }

    // 窗：竹影纸窗 + 木格 + 窗台坐榻
    var winGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.4),
      new THREE.MeshBasicMaterial({ map: windowTex, fog: false }));
    winGlow.rotation.y = -Math.PI / 2;
    winGlow.position.set(ROOM.x - 0.03, 2.1, -2.4);
    inRoot.add(winGlow);
    trimBox(0.14, 0.14, 2.95, ROOM.x - 0.10, 3.35, -2.4, MAT.woodDeep);
    trimBox(0.14, 0.12, 2.95, ROOM.x - 0.10, 0.85, -2.4, MAT.woodDeep);
    trimBox(0.14, 2.55, 0.14, ROOM.x - 0.10, 2.1, -3.78, MAT.woodDeep);
    trimBox(0.14, 2.55, 0.14, ROOM.x - 0.10, 2.1, -1.02, MAT.woodDeep);
    trimBox(0.50, 0.09, 3.0, ROOM.x - 0.25, 0.80, -2.4, MAT.wood);
    for (var wi = 0; wi < 6; wi++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 2.42, 0.045), MAT.woodDeep);
      bar.position.set(ROOM.x - 0.14, 2.1, -3.55 + wi * 0.46);
      inRoot.add(bar);
    }
    for (var wh = 0; wh < 5; wh++) {
      var hbar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 2.62), MAT.woodDeep);
      hbar.position.set(ROOM.x - 0.14, 1.02 + wh * 0.53, -2.4);
      inRoot.add(hbar);
    }
    // 半卷竹帘
    var blindMat = new THREE.MeshStandardMaterial({ color: 0x4f4730, roughness: 0.95 });
    for (var bli = 0; bli < 8; bli++) {
      var slat = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, 2.55), blindMat);
      slat.position.set(ROOM.x - 0.21, 3.18 - bli * 0.075, -2.4);
      inRoot.add(slat);
    }
    var blindCord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7, 5), MAT.brass);
    blindCord.position.set(ROOM.x - 0.22, 2.8, -3.55);
    inRoot.add(blindCord);
    // 窗下坐榻
    trimBox(0.62, 0.82, 2.35, ROOM.x - 0.48, 0.41, -2.4, MAT.wood);
    trimBox(0.70, 0.07, 2.45, ROOM.x - 0.50, 0.84, -2.4, MAT.woodDeep);
    trimBox(0.07, 0.82, 0.12, ROOM.x - 0.18, 0.41, -3.50, MAT.woodDeep);
    trimBox(0.07, 0.82, 0.12, ROOM.x - 0.18, 0.41, -1.30, MAT.woodDeep);
    // 窗台植物
    var plantPot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x5a4a36, roughness: 0.8 }));
    plantPot.position.set(ROOM.x - 0.55, 0.99, -1.35);
    inRoot.add(plantPot);
    var plantStemMat = new THREE.MeshStandardMaterial({ color: 0x3d5a3c, roughness: 0.9 });
    var leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3f6a4a, roughness: 0.9 });
    for (var pli = 0; pli < 6; pli++) {
      var pa = pli / 6 * Math.PI * 2;
      var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.42 + hash2(pli, 301) * 0.25, 5), plantStemMat);
      stem.position.set(ROOM.x - 0.55 + Math.cos(pa) * 0.10, 1.22, -1.35 + Math.sin(pa) * 0.10);
      stem.rotation.z = Math.cos(pa) * 0.22;
      stem.rotation.x = Math.sin(pa) * 0.22;
      inRoot.add(stem);
      var leaf = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 5), leafMat2);
      leaf.position.set(ROOM.x - 0.55 + Math.cos(pa) * 0.20, 1.48 + hash2(pli, 303) * 0.14, -1.35 + Math.sin(pa) * 0.20);
      leaf.rotation.z = Math.cos(pa) * 0.9;
      leaf.rotation.x = Math.sin(pa) * 0.9;
      inRoot.add(leaf);
    }

    // 内景灯光
    inLights.add(new THREE.AmbientLight(0x6a5f4c, 0.4));
    inLights.add(new THREE.HemisphereLight(0xd2d9b8, 0x2a1e14, 0.42));
    var winLight = new THREE.DirectionalLight(0xffe3b0, 0.82);
    winLight.position.set(8, 6, -1);
    winLight.target.position.set(0, 1, 1);
    winLight.castShadow = true;
    winLight.shadow.mapSize.set(1024, 1024);
    winLight.shadow.camera.left = -9;
    winLight.shadow.camera.right = 9;
    winLight.shadow.camera.top = 9;
    winLight.shadow.camera.bottom = -9;
    winLight.shadow.bias = -0.0012;
    winLight.shadow.normalBias = 0.03;
    inLights.add(winLight, winLight.target);

    var keyLight = new THREE.SpotLight(0xffcf9a, 0.66, 22, Math.PI * 0.45, 0.7, 1.3);
    keyLight.position.set(-1.2, 5.2, 3.0);
    keyLight.target.position.set(-1.6, 0.4, -0.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0012;
    keyLight.shadow.normalBias = 0.03;
    inLights.add(keyLight, keyLight.target);

    var cabFill = new THREE.PointLight(0xffd9a0, 0.42, 10, 1.6);
    cabFill.position.set(-3.0, 2.6, -1.6);
    inLights.add(cabFill);
    var faceFill = new THREE.PointLight(0xffe8cc, 0.48, 7, 1.6);
    faceFill.position.set(0.4, 2.4, 3.2);
    inLights.add(faceFill);
    var prepFill = new THREE.PointLight(0xffc879, 0.48, 6, 1.6);
    prepFill.position.set(3.9, 2.0, 1.4);
    inLights.add(prepFill);

    // 匾额
    var inPlaque = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.5),
      new THREE.MeshStandardMaterial({ map: signTexture('岐 黄 堂', false), roughness: 0.55, metalness: 0.2, emissive: 0x241708, emissiveIntensity: 0.5 })
    );
    inPlaque.position.set(1.55, 2.98, -ROOM.z + 0.08);
    inRoot.add(inPlaque);
    var plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.62, 0.1), MAT.woodDeep);
    plaqueFrame.position.set(1.55, 2.98, -ROOM.z + 0.02);
    inRoot.add(plaqueFrame);

    function lantern(x, y, z) {
      var g = new THREE.Group();
      g.position.set(x, y, z);
      var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.56, 5), MAT.woodDeep);
      cord.position.y = 0.46;
      g.add(cord);
      var capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.045, 8), MAT.woodDeep);
      capTop.position.y = 0.31;
      g.add(capTop);
      var capBot = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.04, 8), MAT.woodDeep);
      capBot.position.y = -0.03;
      g.add(capBot);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.19, 0.34, 6),
        new THREE.MeshStandardMaterial({
          color: 0xffc777, emissive: 0xff7a2e, emissiveIntensity: 0.8,
          roughness: 0.55, transparent: true, opacity: 0.94
        }));
      body.position.y = 0.14;
      g.add(body);
      for (var ri = 0; ri < 6; ri++) {
        var ra = ri / 6 * Math.PI * 2;
        var rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.34, 0.012), MAT.woodDeep);
        rib.position.set(Math.cos(ra) * 0.19, 0.14, Math.sin(ra) * 0.19);
        g.add(rib);
      }
      var tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5),
        new THREE.MeshStandardMaterial({ color: 0x7d2a22, roughness: 0.9 }));
      tassel.position.y = -0.13;
      g.add(tassel);
      var light = new THREE.PointLight(0xffa860, 0.65, 8, 1.7);
      g.add(light);
      inRoot.add(g);
    }
    lantern(-4.6, 3.5, 0.2);
    lantern(2.35, 3.5, 0.45);

    // 地毯
    var rug = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.0),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.92, metalness: 0.01 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.2, 0.016, 3.45);
    rug.receiveShadow = true;
    inRoot.add(rug);

    // 匾下条案、香炉、烛台与花瓶
    trimBox(2.4, 0.09, 0.62, 1.55, 0.92, -4.55, MAT.wood);
    trimBox(0.08, 0.88, 0.08, 0.62, 0.44, -4.34, MAT.woodDeep);
    trimBox(0.08, 0.88, 0.08, 2.48, 0.44, -4.34, MAT.woodDeep);
    trimBox(0.08, 0.88, 0.08, 0.62, 0.44, -4.76, MAT.woodDeep);
    trimBox(0.08, 0.88, 0.08, 2.48, 0.44, -4.76, MAT.woodDeep);
    var bronze = new THREE.MeshStandardMaterial({ color: 0x6f5a35, roughness: 0.42, metalness: 0.65 });
    var censer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.20, 14), bronze);
    censer.position.set(1.55, 1.08, -4.55);
    inRoot.add(censer);
    var censerLid = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 12), bronze);
    censerLid.position.set(1.55, 1.23, -4.55);
    inRoot.add(censerLid);
    var incense = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 4),
      new THREE.MeshBasicMaterial({ color: 0xffb36a }));
    incense.position.set(1.55, 1.36, -4.55);
    inRoot.add(incense);
    [0.72, 2.38].forEach(function (cx) {
      var candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 10), MAT.paper);
      candle.position.set(cx, 1.10, -4.55);
      inRoot.add(candle);
      var flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 6),
        new THREE.MeshBasicMaterial({ color: 0xffc06a }));
      flame.position.set(cx, 1.25, -4.55);
      inRoot.add(flame);
    });
    var vase = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x46685a, roughness: 0.55 }));
    vase.position.set(2.05, 1.10, -4.55);
    inRoot.add(vase);
    for (var vbi = 0; vbi < 4; vbi++) {
      var branch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.55 + hash2(vbi, 311) * 0.2, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a4b32, roughness: 0.95 }));
      branch.position.set(2.05 + (hash2(vbi, 313) - 0.5) * 0.16, 1.42, -4.55 + (hash2(vbi, 315) - 0.5) * 0.12);
      branch.rotation.z = (hash2(vbi, 317) - 0.5) * 0.5;
      inRoot.add(branch);
    }

    // 悬挂药束
    for (var hbi = 0; hbi < 3; hbi++) {
      var hx = 3.30 + hbi * 0.55;
      var hg = new THREE.Group();
      hg.position.set(hx, 3.42, -4.60);
      var hcord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.34, 4), MAT.brass);
      hcord.position.y = -0.17;
      hg.add(hcord);
      for (var hli = 0; hli < 7; hli++) {
        var hleaf = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 4),
          new THREE.MeshStandardMaterial({ color: hbi % 2 ? 0x6b5a38 : 0x4c5a3d, roughness: 0.95 }));
        hleaf.position.set((hash2(hbi, hli + 321) - 0.5) * 0.12, -0.42, (hash2(hbi, hli + 331) - 0.5) * 0.12);
        hleaf.rotation.z = (hash2(hbi, hli + 341) - 0.5) * 0.5;
        hg.add(hleaf);
      }
      inRoot.add(hg);
    }

    // 挂轴
    function hangScroll(x, kind) {
      var sg = new THREE.Group();
      sg.position.set(x, 2.72, -4.91);
      var paper = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.85),
        new THREE.MeshStandardMaterial({ map: scrollTexture(kind), roughness: 0.94 }));
      paper.position.y = 0;
      sg.add(paper);
      var rodTop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.035, 0.035), MAT.woodDeep);
      rodTop.position.y = 0.94;
      sg.add(rodTop);
      var rodBot = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.035, 0.035), MAT.woodDeep);
      rodBot.position.y = -0.94;
      sg.add(rodBot);
      var hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), MAT.brass);
      hook.position.y = 1.18;
      sg.add(hook);
      inRoot.add(sg);
    }
    hangScroll(-0.05, 'landscape');
    hangScroll(5.15, 'bamboo');

    // 顶部梁架
    trimBox(0.18, 0.18, ROOM.z * 2, -3.8, 4.48, 0);
    trimBox(0.18, 0.18, ROOM.z * 2, 3.8, 4.48, 0);
    trimBox(ROOM.x * 2, 0.16, 0.18, 0, 4.48, -4.15);
    trimBox(ROOM.x * 2, 0.16, 0.18, 0, 4.48, 4.15);

    /* ---------------- 病人 ---------------- */
    var patientSlots = [
      { key: null, group: null, hit: null, ring: null, x: -1.25 },
      { key: null, group: null, hit: null, ring: null, x: 0.95 }
    ];
    var singleSlot = { key: null, group: null, hit: null, ring: null, x: 0.7 };
    var patientVis = [];

    function buildPatient(outfitName) {
      var style = OUTFIT_STYLES[outfitName] || OUTFIT_STYLES['玉绿长衫'];
      var g = new THREE.Group();

      function pmat(color, rough) {
        return new THREE.MeshStandardMaterial({ color: color, roughness: rough || 0.9, metalness: 0.02 });
      }
      var skinMat = pmat(style.skin, 0.84);
      var hairMat = pmat(style.hair, 0.96);
      var robeMat = pmat(style.robe, 0.9);
      var trimMat = pmat(style.trim, 0.72);
      var pantsMat = pmat(style.pants, 0.94);
      var beltMat = pmat(style.belt, 0.8);
      var shoeMat = pmat(0x1a1511, 0.95);
      var eyeMat = pmat(0x120d09, 0.5);
      var mouthMat = pmat(0x7a3a32, 0.85);
      var strawMat = pmat(0xb08a4a, 0.9);
      var capMat = pmat(0x3d4d5a, 0.85);

      function block(w, h, d, mat, x, y, z) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        return m;
      }

      var longRobe = style.style === 'long' || style.style === 'wide' || style.style === 'cloak';

      // 方块腿与鞋
      block(0.15, 0.55, 0.17, pantsMat, -0.105, 0.34, 0);
      block(0.15, 0.55, 0.17, pantsMat, 0.105, 0.34, 0);
      block(0.17, 0.08, 0.22, shoeMat, -0.105, 0.04, 0.03);
      block(0.17, 0.08, 0.22, shoeMat, 0.105, 0.04, 0.03);

      // 长衫下摆 / 短褂露裤
      if (longRobe) {
        block(0.47, 0.64, 0.30, robeMat, 0, 0.55, 0);
        block(0.49, 0.06, 0.32, trimMat, 0, 0.24, 0);
      } else {
        block(0.46, 0.14, 0.30, robeMat, 0, 0.79, 0);
      }

      // 躯干与衣襟
      block(0.44, 0.44, 0.28, robeMat, 0, 1.05, 0);
      block(0.30, 0.05, 0.30, trimMat, 0, 1.26, 0);
      block(0.045, 0.34, 0.02, trimMat, 0, 1.08, 0.15);
      block(0.46, 0.09, 0.30, beltMat, 0, 0.90, 0);
      block(0.10, 0.10, 0.04, trimMat, 0, 0.88, 0.17);
      block(0.04, 0.26, 0.02, trimMat, -0.04, 0.72, 0.17);
      block(0.04, 0.22, 0.02, trimMat, 0.04, 0.74, 0.17);

      // 方块手臂 / 手
      block(style.sleeve, 0.46, 0.17, robeMat, -0.29, 1.05, 0);
      block(style.sleeve, 0.46, 0.17, robeMat, 0.29, 1.05, 0);
      if (style.style === 'wide' || style.style === 'long' || style.style === 'cloak') {
        block(style.sleeve + 0.01, 0.06, 0.18, trimMat, -0.29, 0.83, 0);
        block(style.sleeve + 0.01, 0.06, 0.18, trimMat, 0.29, 0.83, 0);
      }
      block(0.10, 0.12, 0.12, skinMat, -0.29, 0.79, 0.01);
      block(0.10, 0.12, 0.12, skinMat, 0.29, 0.79, 0.01);

      // 脖子与方块头
      block(0.10, 0.08, 0.10, skinMat, 0, 1.31, 0);
      block(0.34, 0.34, 0.34, skinMat, 0, 1.52, 0);
      block(0.36, 0.26, 0.08, hairMat, 0, 1.55, -0.17);
      // 发顶略前移并减薄，避免与额头共面产生深度闪烁。
      block(0.36, 0.09, 0.34, hairMat, 0, 1.69, 0.01);
      block(0.04, 0.16, 0.20, hairMat, -0.16, 1.55, 0.02);
      block(0.04, 0.16, 0.20, hairMat, 0.16, 1.55, 0.02);

      // 像素脸
      block(0.05, 0.05, 0.012, eyeMat, -0.08, 1.55, 0.172);
      block(0.05, 0.05, 0.012, eyeMat, 0.08, 1.55, 0.172);
      block(0.07, 0.015, 0.012, hairMat, -0.08, 1.60, 0.172);
      block(0.07, 0.015, 0.012, hairMat, 0.08, 1.60, 0.172);
      block(0.03, 0.05, 0.03, skinMat, 0, 1.50, 0.185);
      block(0.08, 0.015, 0.012, mouthMat, 0, 1.44, 0.172);

      // 帽子 / 发髻
      if (style.hat === 'scholar') {
        block(0.38, 0.09, 0.36, hairMat, 0, 1.75, -0.01);
        block(0.38, 0.03, 0.36, trimMat, 0, 1.72, -0.01);
        block(0.06, 0.08, 0.06, trimMat, 0, 1.82, -0.01);
      } else if (style.hat === 'headband') {
        block(0.37, 0.06, 0.37, trimMat, 0, 1.66, 0);
        block(0.05, 0.12, 0.04, trimMat, 0, 1.61, -0.19);
      } else if (style.hat === 'bun') {
        block(0.13, 0.12, 0.10, hairMat, 0, 1.75, -0.14);
        block(0.06, 0.06, 0.06, trimMat, 0, 1.83, -0.14);
      } else if (style.hat === 'straw') {
        block(0.52, 0.04, 0.52, strawMat, 0, 1.72, 0);
        block(0.28, 0.13, 0.28, strawMat, 0, 1.79, 0);
        block(0.29, 0.03, 0.29, trimMat, 0, 1.75, 0);
      } else if (style.hat === 'cap') {
        block(0.37, 0.13, 0.36, capMat, 0, 1.74, 0);
        block(0.30, 0.16, 0.04, capMat, 0, 1.64, -0.19);
      } else {
        block(0.09, 0.10, 0.09, hairMat, 0, 1.77, -0.02);
        block(0.10, 0.03, 0.10, trimMat, 0, 1.73, -0.02);
      }

      // 披风
      if (style.style === 'cloak') {
        block(0.50, 0.78, 0.06, robeMat, 0, 1.12, -0.19);
        block(0.54, 0.10, 0.36, trimMat, 0, 1.29, 0);
      }

      g.scale.setScalar(1.12);
      g.userData.time = Math.random() * 6;
      return g;
    }

    var patientHitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    function patientRing() {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xd1b17a, transparent: true, opacity: 0.9 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      ring.visible = false;
      return ring;
    }

    function makeSlot(slot, x) {
      if (slot.group) {
        inRoot.remove(slot.group);
        var ownedMaterials = [];
        slot.group.traverse(function (o) {
          if (o.geometry) o.geometry.dispose();
          if (o.material && o.material !== MAT.paper && o.material !== MAT.woodDeep && ownedMaterials.indexOf(o.material) < 0) {
            ownedMaterials.push(o.material);
          }
        });
        ownedMaterials.forEach(function (m) { m.dispose(); });
      }
      if (slot.hit) {
        inRoot.remove(slot.hit);
        slot.hit.geometry.dispose();
        if (hoveredTarget === slot.hit) hoveredTarget = null;
      }
      if (slot.ring) {
        inRoot.remove(slot.ring);
        slot.ring.geometry.dispose();
        slot.ring.material.dispose();
      }
      slot.group = null; slot.hit = null; slot.ring = null; slot.key = null;
      slot.x = x;
    }

    function assignSlot(slot, item) {
      var key = item ? item.outfit + '|' + item.orderId : null;
      if (slot.key === key) {
        if (slot.hit) slot.hit.userData.qh = item ? { type: 'patient', orderId: item.orderId } : null;
        if (slot.ring) slot.ring.visible = !!(item && item.selected);
        return;
      }
      makeSlot(slot, slot.x);
      if (!item) return;
      var g = buildPatient(item.outfit);
      g.position.set(slot.x, 0, 1.32);
      g.rotation.y = 0;
      inRoot.add(g);
      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 2.0, 10), patientHitMat);
      hit.position.set(slot.x, 1.0, 1.32);
      hit.userData.qh = { type: 'patient', orderId: item.orderId };
      inRoot.add(hit);
      var ring = patientRing();
      ring.position.set(slot.x, 0.03, 1.32);
      ring.visible = !!item.selected;
      inRoot.add(ring);
      slot.key = key; slot.group = g; slot.hit = hit; slot.ring = ring;
    }

    function setPatients(list, layout) {
      list = list || [];
      if (layout !== 'double') {
        makeSlot(patientSlots[0], -1.25);
        makeSlot(patientSlots[1], 0.95);
        assignSlot(singleSlot, list[0] || null);
      } else {
        makeSlot(singleSlot, 0.7);
        var a = null, b = null;
        list.forEach(function (it) { if (it.slot === 1) b = it; else a = it; });
        assignSlot(patientSlots[0], a);
        assignSlot(patientSlots[1], b);
      }
      patientVis = list;
    }

    /* ---------------- 炮制台、双锅、碗架 ---------------- */
    var prepTable = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.92, 1.6), MAT.wood);
    prepTable.position.set(3.9, 0.46, 1.25);
    prepTable.castShadow = true;
    prepTable.receiveShadow = true;
    inRoot.add(prepTable);
    var prepTop = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 1.8), MAT.woodDeep);
    prepTop.position.set(3.9, 0.94, 1.25);
    inRoot.add(prepTop);
    var mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.24, 14), new THREE.MeshStandardMaterial({ color: 0x6f7468, roughness: 0.9 }));
    mortar.position.set(3.9, 1.1, 1.75);
    inRoot.add(mortar);
    var pestle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x8a8c7e, roughness: 0.8 }));
    pestle.position.set(3.94, 1.34, 1.72);
    pestle.rotation.z = 0.35;
    inRoot.add(pestle);

    function buildPot(x, z) {
      var g = new THREE.Group();
      g.position.set(x, 1.0, z);
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b2a24, roughness: 0.55, metalness: 0.45 });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.2, 0.30, 18), bodyMat);
      body.position.y = 0.15;
      body.castShadow = true;
      g.add(body);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 8, 22), bodyMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.3;
      g.add(rim);
      var liquid = new THREE.Mesh(new THREE.CircleGeometry(0.235, 22),
        new THREE.MeshStandardMaterial({ color: STAGE_COLORS.raw, roughness: 0.35, metalness: 0.1, emissive: 0x1a1206, emissiveIntensity: 0.2 }));
      liquid.rotation.x = -Math.PI / 2;
      liquid.position.y = 0.27;
      g.add(liquid);
      var handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 6, 14), bodyMat);
      handle.position.set(0.3, 0.18, 0);
      handle.rotation.y = Math.PI / 2;
      g.add(handle);
      var lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.05, 18), bodyMat);
      lid.position.set(-0.32, 0.22, 0.16);
      lid.rotation.z = 0.2;
      g.add(lid);

      var flame = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 10),
        new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.85 }));
      flame.position.y = -0.12;
      flame.visible = false;
      g.add(flame);
      var flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
      flame2.position.y = -0.16;
      flame2.visible = false;
      g.add(flame2);

      var steam = [];
      for (var k = 0; k < 3; k++) {
        var s = new THREE.Mesh(new THREE.SphereGeometry(0.07 + k * 0.015, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xd8e6dc, transparent: true, opacity: 0 }));
        s.position.set(0, 0.38, 0);
        s.userData.phase = k / 3;
        g.add(s);
        steam.push(s);
      }

      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 10), patientHitMat);
      hit.position.y = 0.2;
      g.add(hit);
      inRoot.add(g);
      return { group: g, bodyMat: bodyMat, liquid: liquid, flame: flame, flame2: flame2, steam: steam, hit: hit, x: x, z: z,
        originalVisuals: [body, rim, handle, lid], steamBaseY: 0.35 };
    }

    var potObjs = [buildPot(3.35, 1.18), buildPot(4.45, 1.18)];
    potObjs[0].hit.userData.qh = { type: 'pot', index: 0 };
    potObjs[1].hit.userData.qh = { type: 'pot', index: 1 };

    var bowlObjs = [];
    function buildBowl(x, z) {
      var g = new THREE.Group();
      g.position.set(x, 0.99, z);
      var mat = new THREE.MeshStandardMaterial({ color: 0xd8cba6, roughness: 0.5, metalness: 0.05, emissive: 0xd1b17a, emissiveIntensity: 0.05 });
      var half = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), mat);
      half.position.y = 0.2;
      g.add(half);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.016, 6, 20), mat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.2;
      g.add(rim);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xd1b17a }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.03;
      ring.visible = false;
      g.add(ring);
      var hit = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), patientHitMat);
      hit.position.y = 0.15;
      g.add(hit);
      g.visible = false;
      inRoot.add(g);
      return { group: g, ring: ring, hit: hit, mat: mat };
    }
    bowlObjs.push(buildBowl(4.72, 0.55));
    bowlObjs.push(buildBowl(4.72, 0.95));
    bowlObjs[0].hit.userData.qh = { type: 'bowl', index: 0 };
    bowlObjs[1].hit.userData.qh = { type: 'bowl', index: 1 };

    var trayBoard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.5), MAT.paper);
    trayBoard.position.set(3.9, 1.0, 0.5);
    inRoot.add(trayBoard);

    /* ---------------- 内景机位 ---------------- */
    var VIEWS = {
      consult: { pos: new THREE.Vector3(-0.15, 2.55, 4.35), look: new THREE.Vector3(0.55, 0.30, 0.9) },
      cabinet: { pos: new THREE.Vector3(-2.9, 3.35, 1.05), look: new THREE.Vector3(-2.9, 3.02, -4.9) },
      patients: { pos: new THREE.Vector3(0.0, 2.65, 5.4), look: new THREE.Vector3(0.0, 0.45, 1.0) },
      prep: { pos: new THREE.Vector3(3.95, 2.8, 4.8), look: new THREE.Vector3(3.95, 0.9, 1.15) },
      acute: { pos: new THREE.Vector3(0.6, 3.05, 7.4), look: new THREE.Vector3(0.8, 1.2, -0.2) },
      wide: { pos: new THREE.Vector3(-0.2, 2.9, 6.2), look: new THREE.Vector3(-0.8, 1.4, -0.6) }
    };

    /* ------------------------------------------------------------------ */
    /* 射线拾取                                                            */
    /* ------------------------------------------------------------------ */
    function collectPickables() {
      var list = [];
      if (mode === 'exterior' && hitTypes.indexOf('door') >= 0) {
        list.push(doors.acute.hit, doors.chronicle.hit);
      }
      if (mode === 'interior') {
        if (hitTypes.indexOf('drawer') >= 0) {
          drawers.forEach(function (m) { if (m.userData.materialId) list.push(m); });
        }
        if (hitTypes.indexOf('patient') >= 0) {
          patientObjHits().forEach(function (h) { if (h.userData.qh) list.push(h); });
        }
        if (hitTypes.indexOf('pot') >= 0) {
          potObjs.forEach(function (p) { list.push(p.hit); });
        }
        if (hitTypes.indexOf('bowl') >= 0) {
          bowlObjs.forEach(function (b, i) { if (b.group.visible) list.push(b.hit); });
        }
      }
      return list;
    }

    function patientObjHits() {
      var hits = [];
      if (singleSlot.hit) hits.push(singleSlot.hit);
      if (patientSlots[0].hit) hits.push(patientSlots[0].hit);
      if (patientSlots[1].hit) hits.push(patientSlots[1].hit);
      return hits;
    }

    /* 新 GLB 只替换外观，订单、命中体和工作区仍由现有场景管理。 */
    function attachModel(id, parent, placement, done) {
      if (!modelAssets) return Promise.resolve();
      var task = modelAssets.instantiate(id).then(function (model) {
        if (!running) return;
        model.rotation.y += placement.yaw || 0;
        model.rotation.z += placement.roll || 0;
        var bounds = new THREE.Box3().setFromObject(model);
        var center = bounds.getCenter(new THREE.Vector3());
        var size = bounds.getSize(new THREE.Vector3());
        model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
        var placed = new THREE.Group();
        placed.name = 'tripo-' + id;
        placed.userData.modelId = id;
        placed.userData.modelTier = modelAssets.tier;
        placed.add(model);
        var scale = placement.width / size.x;
        placed.scale.setScalar(scale);
        placed.position.set(placement.x, placement.y, placement.z);
        model.traverse(function (o) {
          if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; }
        });
        parent.add(placed);
        attachedModels.push(placed);
        if (done) done(placed, size.y * scale);
      }).catch(function () {
        // 原几何保持可见；资源失败不阻塞接诊和计时。
      });
      modelTasks.push(task);
      return task;
    }

    function makePlaque(text, width, height) {
      var group = new THREE.Group();
      var tex = signTexture(text, false);
      var back = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.08, height + 0.08, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x14251e, roughness: 0.85, metalness: 0.1 })
      );
      back.position.z = -0.02;
      var face = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.6, metalness: 0.12,
          emissive: 0x241708, emissiveIntensity: 0.38
        })
      );
      face.position.z = 0.025;
      group.add(back, face);
      return group;
    }

    function addPlaque(text, x, y, z, width, height) {
      var plaque = makePlaque(text, width, height);
      var pos = new THREE.Vector3(x, y, z);
      extRoot.worldToLocal(pos);
      plaque.position.copy(pos);
      extRoot.add(plaque);
      return plaque;
    }

    function makeDoorLoading(key, size) {
      var label = key === 'acute' ? '急症候' : '行医录';
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 512;
      var ctx = canvas.getContext('2d');
      var tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding;
      function draw(phase) {
        var g = ctx.createLinearGradient(0, 0, 0, 512);
        g.addColorStop(0, '#081614');
        g.addColorStop(0.55, '#15342c');
        g.addColorStop(1, '#081614');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 512, 512);
        var rg = ctx.createRadialGradient(256, 300, 10, 256, 300, 250);
        rg.addColorStop(0, 'rgba(255,196,110,.20)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, 512, 512);
        ctx.strokeStyle = 'rgba(209,177,122,.75)';
        ctx.lineWidth = 6;
        ctx.strokeRect(18, 18, 476, 476);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#e6d5ad';
        ctx.font = 'bold 50px "Songti SC","STSong",SimSun,serif';
        ctx.fillText('正在进入', 256, 190);
        ctx.fillStyle = '#d1b17a';
        ctx.font = 'bold 68px "Songti SC","STSong",SimSun,serif';
        ctx.fillText('岐黄堂', 256, 270);
        ctx.fillStyle = 'rgba(230,213,173,.72)';
        ctx.font = '24px "Songti SC","STSong",SimSun,serif';
        ctx.fillText('· ' + label + ' ·', 256, 335);
        for (var i = 0; i < 3; i++) {
          var active = (phase % 4) === i;
          ctx.beginPath();
          ctx.arc(226 + i * 30, 392, active ? 7 : 4, 0, Math.PI * 2);
          ctx.fillStyle = active ? '#ffd98f' : 'rgba(230,213,173,.28)';
          ctx.fill();
        }
        tex.needsUpdate = true;
      }
      draw(0);
      var plane = new THREE.Mesh(
        new THREE.PlaneGeometry(size.x + 0.08, size.y + 0.08),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.96, side: THREE.DoubleSide, depthWrite: true })
      );
      plane.visible = false;
      plane.userData.draw = draw;
      plane.userData.canvas = canvas;
      plane.userData.texture = tex;
      return plane;
    }

    function setupHouseDoors(placed) {
      if (!placed) return;
      // 右侧门洞原本用的是厚门模；换成薄的双面门模后，需要把两扇门扇各翻 180°，
      // 让拉环回到门缝中间。
      ['Door_R_L', 'Door_R_R'].forEach(function (name) {
        var leaf = placed.getObjectByName(name);
        if (leaf) leaf.rotation.y += Math.PI;
      });
      extRoot.updateMatrixWorld(true);
      var groups = {
        chronicle: ['Door_L_L_Hinge', 'Door_L_R_Hinge'],
        acute: ['Door_R_L_Hinge', 'Door_R_R_Hinge']
      };
      var plaqueInfo = {};
      ['chronicle', 'acute'].forEach(function (key) {
        var d = doors[key];
        var h1 = placed.getObjectByName(groups[key][0]);
        var h2 = placed.getObjectByName(groups[key][1]);
        if (!h1 || !h2) return;
        var box = new THREE.Box3().setFromObject(h1);
        box.expandByObject(h2);
        var center = box.getCenter(new THREE.Vector3());
        var size = box.getSize(new THREE.Vector3());
        var hit = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(size.x + 0.3, 0.7), Math.max(size.y + 0.2, 1.0), 0.55),
          doorHitMat
        );
        hit.position.copy(center);
        extRoot.worldToLocal(hit.position);
        hit.userData.qh = { type: 'door', door: key };
        extRoot.add(hit);
        if (d.hit && d.hit.parent) d.hit.visible = false;
        d.hit = hit;
        if (d.group) d.group.visible = false;

        d.hinges = [
          { obj: h1, sign: 1, base: h1.rotation.y },
          { obj: h2, sign: -1, base: h2.rotation.y }
        ];
        d.frameMat = null;

        var glow = new THREE.Mesh(
          new THREE.PlaneGeometry(size.x + 0.35, size.y + 0.25),
          new THREE.MeshBasicMaterial({
            color: 0xffb060, transparent: true, opacity: 0.02,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
          })
        );
        glow.position.copy(center);
        glow.position.z += 0.18;
        extRoot.worldToLocal(glow.position);
        extRoot.add(glow);
        d.glow = glow;

        var light = new THREE.PointLight(0xffb060, 0.35, 3.5, 1.7);
        light.position.copy(center);
        light.position.z += 0.9;
        extRoot.worldToLocal(light.position);
        extRoot.add(light);
        d.light = light;

        var innerLight = new THREE.PointLight(0xffb060, 0.25, 2.6, 1.8);
        innerLight.position.copy(center);
        innerLight.position.z -= 0.12;
        extRoot.worldToLocal(innerLight.position);
        extRoot.add(innerLight);
        d.innerLight = innerLight;

        var loading = makeDoorLoading(key, size);
        loading.position.copy(center);
        loading.position.z -= 0.25;
        extRoot.worldToLocal(loading.position);
        extRoot.add(loading);
        d.loading = loading;
        d.loadingPhase = -1;

        d.layout = { total: size.x, height: size.y, x: center.x, z: center.z };
        plaqueInfo[key] = { center: center, size: size };
      });
      if (plaqueInfo.chronicle) {
        var lc = plaqueInfo.chronicle;
        addPlaque('行医录', lc.center.x, lc.center.y + lc.size.y / 2 + 0.28, lc.center.z + 0.30, 0.78, 0.24);
      }
      if (plaqueInfo.acute) {
        var rc = plaqueInfo.acute;
        addPlaque('急症候', rc.center.x, rc.center.y + rc.size.y / 2 + 0.28, rc.center.z + 0.30, 0.78, 0.24);
      }
      if (plaqueInfo.chronicle && plaqueInfo.acute) {
        var c1 = plaqueInfo.chronicle, c2 = plaqueInfo.acute;
        var midX = (c1.center.x + c2.center.x) / 2;
        var topY = Math.max(c1.center.y + c1.size.y / 2, c2.center.y + c2.size.y / 2);
        var midZ = Math.max(c1.center.z, c2.center.z) + 0.66;
        addPlaque('岐黄堂', midX, topY + 0.30, midZ, 1.15, 0.35);
      }
      document.body.classList.add('models-doors-ready');
    }

    function loadExteriorModel() {
      var original = extRoot.children.slice();
      // 旧程序几何只作为极端失败时的内部兜底，不参与首屏展示。
      original.forEach(function (o) {
        if ([islandGroup, doors.acute.group, doors.chronicle.group].indexOf(o) < 0) o.visible = false;
      });
      ['acute', 'chronicle'].forEach(function (key) {
        doors[key].group.children.forEach(function (o) { if (o !== doors[key].hit) o.visible = false; });
      });
      attachModel('house', extRoot, { width: 8, yaw: -Math.PI / 2, x: 0.4, y: 0.29, z: 0 }, function (placed) {
        original.forEach(function (o) {
          if ([islandGroup, doors.acute.group, doors.chronicle.group].indexOf(o) < 0) o.visible = false;
        });
        ['acute', 'chronicle'].forEach(function (key) {
          doors[key].group.children.forEach(function (o) { if (o !== doors[key].hit) o.visible = false; });
        });
        document.body.classList.add('models-exterior-ready');
        setupHouseDoors(placed);
      });
    }

    function loadInteriorModels() {
      if (interiorModelsStarted || !modelAssets) return;
      interiorModelsStarted = true;
      document.body.classList.add('models-interior-ready');
      attachModel('book', inRoot, { width: 0.54, yaw: 0.18, roll: Math.PI / 2,
        x: book.position.x, y: CTR.h + 0.09, z: book.position.z }, function () { book.visible = false; });
      jarObjects.forEach(function (jar) {
        attachModel('jar', inRoot, { width: 0.23, yaw: -Math.PI / 2, x: jar.position.x,
          y: jar.position.y - jar.geometry.parameters.height / 2, z: jar.position.z }, function () { jar.visible = false; });
      });
      attachModel('balance', inRoot, { width: 0.68, yaw: -Math.PI / 2, x: 1.55, y: CTR.h + 0.09, z: 2.3 }, function () {
        balanceBase.visible = balancePost.visible = balanceBeam.visible = false;
      });
      attachModel('mortar', inRoot, { width: 0.85, yaw: 0, x: 3.55, y: 0.99, z: 1.8 }, function () {
        mortar.visible = pestle.visible = false;
      });
      potObjs.forEach(function (p) {
        attachModel('stove', p.group, { width: 0.57, yaw: -Math.PI / 2, x: 0, y: 0, z: 0 });
        attachModel('pot', p.group, { width: 0.65, yaw: Math.PI, x: 0, y: 0.49, z: 0 }, function (placed, height) {
          p.originalVisuals.forEach(function (o) { o.visible = false; });
          p.liquid.visible = false;
          p.steamBaseY = 0.49 + height;
          p.flame.position.y = 0.12;
          p.flame2.position.y = 0.08;
          p.hit.position.y = 0.72;
          p.hit.scale.y = 1.2;
        });
      });
      bowlObjs[0].group.position.set(4.72, 0.99, 1.55);
      bowlObjs[1].group.position.set(4.72, 0.99, 2.0);
    }

    function setPointer(e) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function projectObject(obj) {
      if (!obj) return null;
      var v = new THREE.Vector3();
      obj.getWorldPosition(v);
      v.project(camera);
      var rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (v.x * 0.5 + 0.5) * rect.width,
        y: rect.top + (-v.y * 0.5 + 0.5) * rect.height
      };
    }

    function pick() {
      camera.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(collectPickables(), false);
      if (!hits.length) return { mesh: null, target: null };
      var mesh = hits[0].object;
      var target = mesh.userData.qh || null;
      if (!target && mesh.userData.materialId) target = { type: 'drawer', id: mesh.userData.materialId };
      return { mesh: mesh, target: target };
    }

    function highlightTarget(mesh, on) {
      if (!mesh) return;
      if (mesh.userData.materialId) {
        mesh.userData.hoverBoost = on ? 0.18 : 0;
      } else if (mesh.userData.qh && mesh.userData.qh.type === 'door') {
        var d = doors[mesh.userData.qh.door];
        if (d) d.hover = on;
      } else if (mesh.userData.qh && mesh.userData.qh.type === 'patient') {
        var slot = patientSlots[0].hit === mesh ? patientSlots[0] : (patientSlots[1].hit === mesh ? patientSlots[1] : singleSlot);
        if (slot && slot.ring) slot.ring.visible = on || !!(slot.ring.userData.forced);
      } else if (mesh.userData.qh && mesh.userData.qh.type === 'pot') {
        var p = potObjs[mesh.userData.qh.index];
        if (p) p.hover = on;
      } else if (mesh.userData.qh && mesh.userData.qh.type === 'bowl') {
        var b = bowlObjs[mesh.userData.qh.index];
        if (b) b.ring.visible = on || b.ring.userData.forced;
      }
    }

    function onMove(e) {
      setPointer(e);
      var r = pick();
      if (hoveredTarget && hoveredTarget !== r.mesh) highlightTarget(hoveredTarget, false);
      hoveredTarget = r.mesh;
      if (r.mesh) {
        highlightTarget(r.mesh, true);
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    }

    function onDown(e) {
      downPos = { x: e.clientX, y: e.clientY };
    }

    function onUp(e) {
      if (!downPos) return;
      var dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      downPos = null;
      if (dist > 9) return;
      setPointer(e);
      var r = pick();
      if (r.target && pickCb) pickCb(r.target);
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', function () {
      if (hoveredTarget) highlightTarget(hoveredTarget, false);
      hoveredTarget = null;
      canvas.style.cursor = 'default';
    });

    /* ------------------------------------------------------------------ */
    /* 尺寸与循环                                                          */
    /* ------------------------------------------------------------------ */
    function resize() {
      var rect = canvas.getBoundingClientRect();
      var W = Math.max(1, Math.round(rect.width));
      var H = Math.max(1, Math.round(rect.height));
      renderer.setSize(W, H, false);
      var aspect = W / H;
      var baseFov = mode === 'exterior' ? 46 : 50;
      var targetAspect = 16 / 9;
      var fov = baseFov;
      if (aspect < targetAspect) {
        fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) * (targetAspect / aspect)) * 180 / Math.PI;
      }
      camera.fov = Math.min(fov, 92);
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    var view = 'exterior';
    var extFocus = null;

    function setView(name) {
      if (name === 'exterior') {
        var target = extFocus ? EXT_APPROACH[extFocus] : EXT_DEFAULT;
        camPosTarget.copy(target.pos);
        camLookTarget.copy(target.look);
        if (mobileModels && window.innerWidth <= 720 && !extFocus) camLookTarget.y = -0.2;
        return;
      }
      var v = VIEWS[name] || VIEWS.consult;
      camPosTarget.copy(v.pos);
      camLookTarget.copy(v.look);
    }

    function forceView(name) {
      setView(name);
      camPos.copy(camPosTarget);
      camLook.copy(camLookTarget);
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      camera.updateMatrixWorld(true);
      renderer.render(scene, camera);
    }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      var dt = Math.min((now - lastTs) / 1000, 0.05);
      lastTs = now;
      var t = now / 1000;

      var k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
      camPos.lerp(camPosTarget, k);
      camLook.lerp(camLookTarget, k);
      camera.position.copy(camPos);
      camera.lookAt(camLook);

      if (mode === 'exterior') {
        stars.rotation.y = t * 0.004;
        extRoot.position.y = 0.1 + Math.sin(t * 0.5) * 0.015;
        var shards = islandGroup.userData.shards || [];
        for (var sh = 0; sh < shards.length; sh++) {
          var s = shards[sh];
          s.position.y = s.userData.baseY + Math.sin(t * 0.7 + sh * 1.3) * 0.14;
          s.rotation.y += dt * 0.12;
          s.rotation.x += dt * 0.035;
        }
        ['acute', 'chronicle'].forEach(function (key) {
          var d = doors[key];
          d.lastSeenTarget = d.openTarget;
          var hover = d.hover ? 1 : 0;
          var lit = hover || d.persistent;
          if (d.openStart === undefined || d.openSeenTarget !== d.openTarget) {
            d.openStart = performance.now();
            d.openFrom = d.open;
            d.openSeenTarget = d.openTarget;
          }
          var openProgress = reduced ? 1 : Math.min(1, (performance.now() - d.openStart) / 450);
          var openEase = 1 - Math.pow(1 - openProgress, 3);
          d.open = d.openFrom + (d.openTarget - d.openFrom) * openEase;
          var openK = d.open;
          if (d.frameMat) d.frameMat.emissiveIntensity += (((lit ? 0.55 : 0.04)) - d.frameMat.emissiveIntensity) * Math.min(1, dt * 8);
          if (d.glow) d.glow.material.opacity += ((0.03 + (openK > 0.5 ? 0.38 : 0) + (d.persistent ? 0.12 : 0) + hover * 0.2) - d.glow.material.opacity) * Math.min(1, dt * 6);
          if (d.hinges) {
            d.hinges.forEach(function (h) { h.obj.rotation.y = h.base + h.sign * 1.31 * openK; });
          } else if (d.leftPivot && d.rightPivot) {
            d.leftPivot.rotation.y = 1.15 * openK;
            d.rightPivot.rotation.y = -1.15 * openK;
          }
          if (d.light) {
            var targetLight = 0.18 + lit * 0.32 + openK * 0.26 + Math.sin(t * 2.6 + (key === 'acute' ? 1.2 : 2.1)) * 0.02;
            d.light.intensity += (targetLight - d.light.intensity) * Math.min(1, dt * 6);
          }
          if (d.innerLight) {
            var innerTarget = 0.16 + openK * 0.9 + lit * 0.24 + Math.sin(t * 3.1 + (key === 'acute' ? 1.7 : 2.4)) * 0.02;
            d.innerLight.intensity += (innerTarget - d.innerLight.intensity) * Math.min(1, dt * 6);
          }
          if (d.loading) {
            var loadShow = openK > 0.03;
            d.loading.visible = loadShow;
            if (loadShow) {
              var phase = Math.floor(t * 3) % 4;
              if (phase !== d.loadingPhase) {
                d.loadingPhase = phase;
                d.loading.userData.draw(phase);
              }
              d.loading.material.opacity = 0.92 + Math.sin(t * 5) * 0.05;
            }
          }
        });
      } else {
        // 抽屉开合与高亮
        for (var i = 0; i < drawers.length; i++) {
          var m = drawers[i];
          var ud = m.userData;
          m.position.z += (ud.targetZ - m.position.z) * Math.min(1, dt * 12);
          if (ud.materialId) {
            var base = ud.syncedGlow || 0;
            var boost = ud.hoverBoost || 0;
            ud.faceMat.emissiveIntensity += (((base + boost) - ud.faceMat.emissiveIntensity) * Math.min(1, dt * 10));
          }
        }
        // 病人呼吸
        patientObjGroups().forEach(function (g) {
          g.userData.time += dt;
          g.position.y = Math.sin(g.userData.time * 1.5) * 0.012;
        });
        // 锅与蒸汽
        potObjs.forEach(function (p, idx) {
          var st = (p.state || 'empty');
          p.flame.visible = st === 'cooking';
          p.flame2.visible = st === 'cooking';
          if (st === 'cooking') {
            p.flame.scale.y = 0.85 + Math.sin(t * 13 + idx) * 0.18;
            p.flame2.scale.y = 0.9 + Math.sin(t * 17 + idx * 2) * 0.15;
            p.liquid.material.color.setHex(STAGE_COLORS[p.stageKey || 'raw']);
            p.liquid.material.emissiveIntensity = 0.35 + Math.sin(t * 4 + idx) * 0.12;
            p.steam.forEach(function (s) {
              var ph = ((t * 0.32 + s.userData.phase) % 1);
              s.position.y = p.steamBaseY + ph * 0.75;
              s.position.x = Math.sin(ph * 6 + idx) * 0.1;
              s.material.opacity = (1 - ph) * 0.32;
            });
          } else {
            p.liquid.material.color.setHex(st === 'cooldown' ? 0x2a2a24 : 0x3a3326);
            p.steam.forEach(function (s) { s.material.opacity *= 0.88; });
          }
          if (p.hover) p.group.position.y = 1.0 + Math.sin(t * 6) * 0.012;
          else p.group.position.y += (1.0 - p.group.position.y) * Math.min(1, dt * 10);
        });
        // 药碗轻微浮动（选中环）
        bowlObjs.forEach(function (b, idx) {
          if (b.group.visible) {
            b.group.position.y = 0.99 + Math.sin(t * 2 + idx) * 0.006;
          }
        });
      }

      renderer.render(scene, camera);
    }

    function patientObjGroups() {
      var out = [];
      if (singleSlot.group) out.push(singleSlot.group);
      if (patientSlots[0].group) out.push(patientSlots[0].group);
      if (patientSlots[1].group) out.push(patientSlots[1].group);
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* 对外 API                                                            */
    /* ------------------------------------------------------------------ */
    resize();
    setView('exterior');
    forceView('exterior');
    requestAnimationFrame(frame);
    loadExteriorModel();

    return {
      getModelStatus: function () {
        var status = modelAssets ? modelAssets.getStatus() : { tier: 'procedural', requested: [], loaded: [], failed: [] };
        status.instances = attachedModels.map(function (o) { return o.userData.modelId; });
        return status;
      },
      whenModelsReady: function () { return Promise.all(modelTasks); },
      setHitTypes: function (types) { hitTypes = types.slice(); },
      setReducedMotion: function (v) { reduced = !!v; },
      onPick: function (fn) { pickCb = fn; },
      setView: setView,
      forceView: forceView,
      showExterior: function () {
        mode = 'exterior';
        hitTypes = ['door'];
        exterior.visible = true;
        interior.visible = false;
        extFocus = null;
        scene.fog = new THREE.FogExp2(PALETTE.bg, 0.012);
        renderer.setClearColor(PALETTE.bg, 0);
        resize();
        setView('exterior');
      },
      showInterior: function (name) {
        mode = 'interior';
        exterior.visible = false;
        interior.visible = true;
        scene.fog = new THREE.FogExp2(PALETTE.bg, 0.018);
        renderer.setClearColor(PALETTE.bg, 1);
        resize();
        setView(name || 'consult');
        loadInteriorModels();
      },
      getDoorState: function () {
        var out = {};
        ['acute', 'chronicle'].forEach(function (k) {
          var d = doors[k];
          out[k] = {
            open: d.open, target: d.openTarget, lastSeen: d.lastSeenTarget,
            left: d.leftPivot ? d.leftPivot.rotation.y : null,
            right: d.rightPivot ? d.rightPivot.rotation.y : null,
            light: d.light ? d.light.intensity : null,
            hinges: d.hinges ? d.hinges.map(function (h) { return h.obj.rotation.y; }) : null,
            total: d.layout ? d.layout.total : null,
            x: d.layout ? d.layout.x : null
          };
        });
        out.sceneId = sceneId;
        out.count = global.__QH_SCENE_COUNT__;
        return out;
      },
      debugSetDoor: function (key, openK) {
        var d = doors[key];
        if (!d) return;
        d.open = openK;
        d.openTarget = openK;
        if (d.hinges) d.hinges.forEach(function (h) { h.obj.rotation.y = h.base + h.sign * 1.31 * openK; });
        else if (d.leftPivot) { d.leftPivot.rotation.y = 1.15 * openK; d.rightPivot.rotation.y = -1.15 * openK; }
        if (d.light) d.light.intensity = 0.8;
      },
      focusDoor: function (key) {
        extFocus = key;
        setView('exterior');
      },
      openDoor: function (key) {
        ['acute', 'chronicle'].forEach(function (k) {
          if (doors[k]) doors[k].openTarget = k === key ? 1 : 0;
        });
      },
      closeDoors: function () {
        ['acute', 'chronicle'].forEach(function (k) {
          if (doors[k]) { doors[k].open = 0; doors[k].openTarget = 0; }
        });
      },
      setDoorHover: function (key, on) {
        if (doors[key]) doors[key].hover = on;
      },
      setDoorHighlight: function (key) {
        ['acute', 'chronicle'].forEach(function (k) {
          if (doors[k]) doors[k].persistent = k === key;
        });
      },
      setDrawerMaterials: function (list) {
        var byId = {};
        drawers.forEach(function (m, i) {
          var item = list[i];
          var ud = m.userData;
          ud.materialId = item ? item.id : null;
          if (ud.faceMat.map) ud.faceMat.map.dispose();
          ud.faceMat.map = drawerFaceTexture(item ? item.name : null);
          ud.faceMat.needsUpdate = true;
          ud.faceMat.emissiveIntensity = 0;
          ud.syncedGlow = 0;
          m.position.z = ud.baseZ;
          ud.targetZ = ud.baseZ;
          if (item) byId[item.id] = m;
        });
        drawerById = byId;
      },
      nudgeDrawer: function (id) {
        var m = drawerById[id];
        if (!m) return;
        var ud = m.userData;
        ud.targetZ = ud.baseZ + 0.14;
        setTimeout(function () { if (ud) ud.targetZ = ud.baseZ; }, 180);
      },
      projectMaterial: function (id) {
        var m = drawerById[id];
        if (!m) return null;
        return projectObject(m);
      },
      projectDoor: function (key) {
        return doors[key] ? projectObject(doors[key].hit) : null;
      },
      projectPatient: function (orderId) {
        var hits = patientObjHits();
        for (var i = 0; i < hits.length; i++) {
          if (hits[i].userData.qh && hits[i].userData.qh.orderId === orderId) return projectObject(hits[i]);
        }
        return null;
      },
      projectPot: function (index) {
        return potObjs[index] ? projectObject(potObjs[index].hit) : null;
      },
      projectBowl: function (index) {
        return bowlObjs[index] ? projectObject(bowlObjs[index].hit) : null;
      },
      debugRaycast: function (clientX, clientY) {
        setPointer({ clientX: clientX, clientY: clientY });
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        var meshes = [];
        attachedModels.forEach(function (g) {
          g.traverse(function (o) { if (o.isMesh) meshes.push(o); });
        });
        var hits = raycaster.intersectObjects(meshes, false);
        if (!hits.length) return null;
        var h = hits[0];
        var n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : new THREE.Vector3();
        return {
          x: h.point.x, y: h.point.y, z: h.point.z,
          nx: n.x, ny: n.y, nz: n.z,
          distance: h.distance,
          name: h.object.name || ''
        };
      },
      debugSceneRaycast: function (clientX, clientY) {
        setPointer({ clientX: clientX, clientY: clientY });
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(scene.children, true).slice(0, 6).map(function (h) {
          return {
            type: h.object.type, name: h.object.name || '', uuid: h.object.uuid,
            x: h.point.x, y: h.point.y, z: h.point.z, distance: h.distance,
            visible: h.object.visible
          };
        });
      },
      debugModels: function () {
        return attachedModels.map(function (g) {
          var box = new THREE.Box3().setFromObject(g);
          var size = box.getSize(new THREE.Vector3());
          var meshes = [];
          g.traverse(function (o) {
            if (o.isMesh) meshes.push({ type: o.type, uuid: o.uuid, visible: o.visible, raycast: typeof o.raycast, materialSide: o.material && o.material.side });
          });
          return { id: g.userData.modelId, meshes: meshes, min: box.min.toArray(), max: box.max.toArray(), size: size.toArray() };
        });
      },
      debugModelRay: function (clientX, clientY, modelIndex) {
        setPointer({ clientX: clientX, clientY: clientY });
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        var g = attachedModels[modelIndex || 0];
        var mesh = null;
        if (g) g.traverse(function (o) { if (!mesh && o.isMesh) mesh = o; });
        if (!mesh) return null;
        var hits = raycaster.intersectObject(mesh, false);
        var sphere = mesh.geometry.boundingSphere;
        var center = sphere ? sphere.center.clone().applyMatrix4(mesh.matrixWorld) : null;
        return {
          uuid: mesh.uuid,
          layers: mesh.layers.mask,
          rayLayers: raycaster.layers.mask,
          matrixWorld: mesh.matrixWorld.elements.slice(),
          sphereCenter: center ? center.toArray() : null,
          sphereRadius: sphere ? sphere.radius : null,
          rayOrigin: raycaster.ray.origin.toArray(),
          rayDir: raycaster.ray.direction.toArray(),
          hits: hits.slice(0, 3).map(function (h) { return { x: h.point.x, y: h.point.y, z: h.point.z, distance: h.distance }; })
        };
      },
      pickAt: function (clientX, clientY) {
        setPointer({ clientX: clientX, clientY: clientY });
        var r = pick();
        return {
          target: r.target,
          materialId: r.mesh ? r.mesh.userData.materialId : null,
          hitTypes: hitTypes.slice()
        };
      },
      syncDrawerStates: function (leftCounts, trayIds) {
        var tray = {};
        (trayIds || []).forEach(function (id) { tray[id] = true; });
        drawers.forEach(function (m) {
          var ud = m.userData;
          if (!ud.materialId) return;
          var left = leftCounts ? (leftCounts[ud.materialId] || 0) : 1;
          ud.syncedGlow = tray[ud.materialId] ? 0.22 : (left <= 0 ? 0 : 0.04);
          ud.dim = left <= 0;
        });
      },
      setPatients: setPatients,
      setSelectedBowl: function (index) {
        bowlObjs.forEach(function (b, i) {
          b.ring.userData.forced = i === index;
          b.ring.visible = i === index;
        });
      },
      setPots: function (list) {
        list = list || [];
        potObjs.forEach(function (p, i) {
          var it = list[i] || { state: 'empty' };
          p.state = it.state;
          p.stageKey = it.stageKey;
        });
      },
      setBowls: function (list) {
        list = list || [];
        bowlObjs.forEach(function (b, i) {
          var it = list[i];
          b.group.visible = !!it;
          if (it) {
            b.mat.color.setHex((OUTFIT_COLORS[it.outfit] || 0xd8cba6) + 0x202020);
          }
        });
      },
      setPatientSelection: function (orderId) {
        patientObjHits().forEach(function (h) {
          var slot = h === singleSlot.hit ? singleSlot : (h === patientSlots[0].hit ? patientSlots[0] : patientSlots[1]);
          if (slot.ring) {
            var forced = !!(h.userData.qh && h.userData.qh.orderId === orderId);
            slot.ring.userData.forced = forced;
            slot.ring.visible = forced;
          }
        });
      },
      pulsePot: function (index) {
        var p = potObjs[index];
        if (!p) return;
        p.hover = true;
        setTimeout(function () { p.hover = false; }, 180);
      },
      pulseBowl: function (index) {
        var b = bowlObjs[index];
        if (!b) return;
        b.ring.userData.forced = true;
        b.ring.visible = true;
        setTimeout(function () { if (!b.ring.userData.forced) b.ring.visible = false; }, 220);
      },
      project: function (object3d) {
        var v = new THREE.Vector3();
        object3d.getWorldPosition(v);
        v.project(camera);
        var rect = canvas.getBoundingClientRect();
        return { x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height };
      },
      dispose: function () {
        running = false;
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        renderer.dispose();
      }
    };
  }

  global.QH_SCENE = { create: create };
})(typeof self !== 'undefined' ? self : this);
