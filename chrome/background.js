// background.js
async function ensureAuthAgent() {
    if (!(await chrome.offscreen.hasDocument?.())) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_SNAPSHOT],
        justification: 'Keep Firebase Auth alive'
      });
    }
  }
  chrome.runtime.onInstalled.addListener(ensureAuthAgent);
  chrome.runtime.onStartup.addListener(ensureAuthAgent);