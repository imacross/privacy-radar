// Privacy Radar — fingerprinting probe. Runs in the page's MAIN world at
// document_start so it can wrap the real APIs before any tracker script loads.
// When the page actually invokes a known fingerprinting surface, we post a
// message that content-relay.js (isolated world) forwards to the background.
(function () {
  const report = (api) => {
    try {
      window.postMessage({ __privacyRadar: true, api }, "*");
    } catch {
      /* ignore */
    }
  };

  const wrap = (obj, name, api) => {
    if (!obj || typeof obj[name] !== "function") return;
    const orig = obj[name];
    obj[name] = function (...args) {
      report(api);
      return orig.apply(this, args);
    };
  };

  // Canvas fingerprinting
  wrap(HTMLCanvasElement.prototype, "toDataURL", "canvas.toDataURL");
  wrap(HTMLCanvasElement.prototype, "toBlob", "canvas.toBlob");
  wrap(CanvasRenderingContext2D.prototype, "getImageData", "canvas.getImageData");

  // WebGL fingerprinting (renderer/vendor strings)
  const wrapWebGL = (proto) => {
    if (!proto) return;
    wrap(proto, "getParameter", "webgl.getParameter");
    wrap(proto, "getExtension", "webgl.getExtension");
    wrap(proto, "getSupportedExtensions", "webgl.getSupportedExtensions");
  };
  wrapWebGL(typeof WebGLRenderingContext !== "undefined" && WebGLRenderingContext.prototype);
  wrapWebGL(typeof WebGL2RenderingContext !== "undefined" && WebGL2RenderingContext.prototype);

  // Audio fingerprinting
  if (typeof AnalyserNode !== "undefined") {
    wrap(AnalyserNode.prototype, "getFloatFrequencyData", "audio.getFloatFrequencyData");
  }
  if (typeof OfflineAudioContext !== "undefined") {
    wrap(OfflineAudioContext.prototype, "startRendering", "audio.offlineContext");
  }

  // Font / hardware enumeration signals
  wrap(navigator, "getBattery", "navigator.getBattery");
  if (navigator.mediaDevices) {
    wrap(navigator.mediaDevices, "enumerateDevices", "mediaDevices.enumerateDevices");
  }
})();
