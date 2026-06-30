// Injected via evaluateOnNewDocument BEFORE any page script runs. It wraps the
// browser APIs commonly abused for device fingerprinting and reports the *call*
// (not the value) through window.__fpReport. We observe what the site does; the
// stealth layer separately controls what those APIs return, so the two don't fight.

export const FP_HOOK_SOURCE = `
(() => {
  try {
    var report = function (api) { try { if (window.__fpReport) window.__fpReport(api); } catch (e) {} };
    var seen = Object.create(null);
    var once = function (api) { if (seen[api]) return; seen[api] = 1; report(api); };

    // ---- Canvas ----
    try {
      var cproto = HTMLCanvasElement.prototype;
      var toDataURL = cproto.toDataURL;
      cproto.toDataURL = function () { once('canvas.toDataURL'); return toDataURL.apply(this, arguments); };
      if (cproto.toBlob) {
        var toBlob = cproto.toBlob;
        cproto.toBlob = function () { once('canvas.toBlob'); return toBlob.apply(this, arguments); };
      }
      var ctx2d = CanvasRenderingContext2D.prototype;
      var getImageData = ctx2d.getImageData;
      ctx2d.getImageData = function () { once('canvas.getImageData'); return getImageData.apply(this, arguments); };
    } catch (e) {}

    // ---- WebGL ----
    try {
      var hookGL = function (P) {
        if (!P || !P.prototype) return;
        var gp = P.prototype.getParameter;
        P.prototype.getParameter = function (p) {
          if (p === 37445 || p === 37446) once('webgl.getParameter(UNMASKED_RENDERER)');
          else once('webgl.getParameter');
          return gp.apply(this, arguments);
        };
        var ge = P.prototype.getExtension;
        P.prototype.getExtension = function (n) {
          if (String(n).indexOf('debug_renderer') >= 0) once('webgl.debugRendererInfo');
          return ge.apply(this, arguments);
        };
      };
      hookGL(window.WebGLRenderingContext);
      hookGL(window.WebGL2RenderingContext);
    } catch (e) {}

    // ---- AudioContext ----
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC && AC.prototype.createAnalyser) {
        var ca = AC.prototype.createAnalyser;
        AC.prototype.createAnalyser = function () { once('audio.createAnalyser'); return ca.apply(this, arguments); };
      }
      if (AC && AC.prototype.createOscillator) {
        var co = AC.prototype.createOscillator;
        AC.prototype.createOscillator = function () { once('audio.createOscillator'); return co.apply(this, arguments); };
      }
    } catch (e) {}

    // ---- navigator enumeration (weaker signals) ----
    try {
      var navProbe = function (prop, api) {
        try {
          var d = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
          if (d && d.get && d.configurable) {
            Object.defineProperty(Navigator.prototype, prop, {
              configurable: true,
              get: function () { once(api); return d.get.call(this); },
            });
          }
        } catch (e) {}
      };
      navProbe('plugins', 'navigator.plugins');
      navProbe('hardwareConcurrency', 'navigator.hardwareConcurrency');
      navProbe('deviceMemory', 'navigator.deviceMemory');
    } catch (e) {}
  } catch (e) {}
})();
`;
