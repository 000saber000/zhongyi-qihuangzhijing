/* 用户 GLB 的分级加载：HTTP 使用 GLB；file:// 使用同一二进制的本地脚本包装。 */
(function (global) {
  'use strict';

  var IDS = ['jar', 'mortar', 'pot', 'stove', 'balance', 'book', 'house'];

  function selectTier(env) {
    return env.width <= 760 || /Android|iPhone|iPad|Mobile/i.test(env.userAgent || '') ||
      env.coarse ? 'mobile' : 'desktop';
  }

  function create() {
    var tier = selectTier({
      width: global.innerWidth,
      userAgent: global.navigator.userAgent,
      coarse: !!(global.matchMedia && global.matchMedia('(pointer: coarse)').matches)
    });
    var cache = {};
    var loaded = [], failed = [], requested = [];
    var loader = new global.THREE.GLTFLoader();
    loader.setMeshoptDecoder(global.MeshoptDecoder);

    function localBinary(key) {
      return new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = 'assets/models/' + key + '.js';
        script.onload = function () {
          try {
            var text = global.atob(global.QH_MODEL_BIN[key]);
            delete global.QH_MODEL_BIN[key];
            var bytes = new Uint8Array(text.length);
            for (var i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
            resolve(bytes.buffer);
          } catch (e) { reject(e); }
          if (script.parentNode) script.parentNode.removeChild(script);
        };
        script.onerror = function () {
          if (script.parentNode) script.parentNode.removeChild(script);
          reject(new Error('Cannot load model: ' + key));
        };
        document.head.appendChild(script);
      });
    }

    function load(id) {
      if (IDS.indexOf(id) < 0) return Promise.reject(new Error('Unknown model: ' + id));
      if (!cache[id]) {
        var key = id + '-' + tier;
        requested.push(key);
        cache[id] = Promise.resolve().then(function () {
          if (global.location.protocol === 'file:') {
            return localBinary(key).then(function (buffer) {
              return new Promise(function (resolve, reject) { loader.parse(buffer, '', resolve, reject); });
            });
          }
          return loader.loadAsync('assets/models/' + key + '.glb');
        }).then(function (gltf) {
          loaded.push(id);
          return gltf.scene;
        }).catch(function (e) {
          failed.push({ id: id, message: String(e.message || e) });
          throw e;
        });
      }
      return cache[id];
    }

    return {
      tier: tier,
      instantiate: function (id) { return load(id).then(function (scene) { return scene.clone(true); }); },
      getStatus: function () { return { tier: tier, requested: requested.slice(), loaded: loaded.slice(), failed: failed.slice() }; }
    };
  }

  global.QH_MODELS = { selectTier: selectTier, create: create };
})(typeof self !== 'undefined' ? self : this);
