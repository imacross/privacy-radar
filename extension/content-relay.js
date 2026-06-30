// Privacy Radar — relay. Runs in the isolated world; bridges fingerprinting
// signals from the page (posted by content-fp.js in the MAIN world) to the
// background service worker, which has no access to page-world events.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.__privacyRadar !== true || !data.api) return;
  try {
    chrome.runtime.sendMessage({ type: "fp", api: data.api });
  } catch {
    /* service worker asleep or context invalidated — ignore */
  }
});
