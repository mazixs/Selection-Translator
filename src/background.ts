import { MENU_IDS, setupContextMenus } from "./context-menus.js";
import { getUiLocale, parseUiLanguagePreference, type UiLocale } from "./i18n.js";
import { getRuntimeMessage, type RuntimeMessage } from "./messages.js";
import { loadSettings } from "./settings.js";
import { translateText } from "./translator.js";

function logContextMenuSetupError(error: unknown) {
  console.warn("Failed to configure context menus", error);
}

let menuRefreshId = 0;

/**
 * Only the latest call builds the menu: a call that waits for settings must
 * not overwrite a newer one that already knew its locale.
 */
async function refreshContextMenus(locale?: UiLocale) {
  const refreshId = ++menuRefreshId;
  const nextLocale = locale ?? (await loadMenuLocale());

  if (refreshId === menuRefreshId) {
    await setupContextMenus(nextLocale);
  }
}

/** A failed read must not leave the browser without the menu: the browser language will do. */
async function loadMenuLocale(): Promise<UiLocale> {
  try {
    return getUiLocale((await loadSettings()).uiLanguage);
  } catch (error) {
    logContextMenuSetupError(error);
    return getUiLocale("auto");
  }
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
  void refreshContextMenus().catch(logContextMenuSetupError);
});

chrome.runtime.onStartup.addListener(() => {
  void refreshContextMenus().catch(logContextMenuSetupError);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  // The change carries the new value, so the menu needs no storage read.
  if (changes.uiLanguage) {
    const locale = getUiLocale(parseUiLanguagePreference(changes.uiLanguage.newValue));
    void refreshContextMenus(locale).catch(logContextMenuSetupError);
  }
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
      // Storage is read per request: the worker may stop at any time, and a
      // copy kept in memory could miss a change written just before this message.
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
