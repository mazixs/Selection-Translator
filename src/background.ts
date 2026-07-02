import { MENU_IDS, setupContextMenus } from "./context-menus.js";
import { getRuntimeMessage, type RuntimeMessage } from "./messages.js";
import { loadSettings } from "./settings.js";
import { translateText } from "./translator.js";

function logContextMenuSetupError(error: unknown) {
  console.warn("Failed to configure context menus", error);
}

function isTrustedContentSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && typeof sender.tab?.id === "number";
}

async function sendToTab(tabId: number | undefined, message: RuntimeMessage) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // The content script is unavailable on browser/system pages.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void setupContextMenus().catch(logContextMenuSetupError);
});

chrome.runtime.onStartup.addListener(() => {
  void setupContextMenus().catch(logContextMenuSetupError);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_IDS.settings) {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId === MENU_IDS.translate) {
    void sendToTab(tab?.id, {
      type: "ST_CONTEXT_TRANSLATE",
      text: info.selectionText || "",
    });
    return;
  }

  if (info.menuItemId === MENU_IDS.copy) {
    void sendToTab(tab?.id, {
      type: "ST_CONTEXT_COPY_SELECTION",
      text: info.selectionText || "",
    });
  }
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const runtimeMessage = getRuntimeMessage(message);
  if (!runtimeMessage || !isTrustedContentSender(sender)) {
    return false;
  }

  if (runtimeMessage.type === "ST_TRANSLATE") {
    (async () => {
      const settings = await loadSettings();
      const result = await translateText({
        text: runtimeMessage.text,
        settings,
      });
      sendResponse(result);
    })();

    return true;
  }

  if (runtimeMessage.type === "ST_GET_SETTINGS") {
    (async () => {
      sendResponse(await loadSettings());
    })();

    return true;
  }

  if (runtimeMessage.type === "ST_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
