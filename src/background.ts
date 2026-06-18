import { MENU_IDS, setupContextMenus } from "./context-menus.js";
import { getRuntimeMessage, type RuntimeMessage } from "./messages.js";
import { loadSettings } from "./settings.js";
import { translateText } from "./translator.js";

const YANDEX_WEB_HEADER_RULE_IDS = [7401, 7402];
const YANDEX_WEB_HEADER_RULES: chrome.declarativeNetRequest.Rule[] = [
  {
    id: 7401,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "Referer",
          operation: "set",
          value: "https://translate.yandex.ru/",
        },
        {
          header: "Origin",
          operation: "set",
          value: "https://translate.yandex.ru",
        },
      ],
    },
    condition: {
      urlFilter: "||translate.yandex.ru/props/api/v1.0/sessions",
      resourceTypes: ["xmlhttprequest"],
    },
  },
  {
    id: 7402,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: "Referer",
          operation: "set",
          value: "https://translate.yandex.ru/",
        },
        {
          header: "Origin",
          operation: "set",
          value: "https://translate.yandex.ru",
        },
      ],
    },
    condition: {
      urlFilter: "||translate.yandex.net/api/v1/tr.json/translateSentence",
      resourceTypes: ["xmlhttprequest"],
    },
  },
];

async function configureYandexWebHeaderRules() {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    return;
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: YANDEX_WEB_HEADER_RULE_IDS,
      addRules: YANDEX_WEB_HEADER_RULES,
    });
  } catch (error) {
    console.warn("Failed to configure Yandex web header rules", error);
  }
}

function logContextMenuSetupError(error: unknown) {
  console.warn("Failed to configure context menus", error);
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
  void configureYandexWebHeaderRules();
});

chrome.runtime.onStartup.addListener(() => {
  void setupContextMenus().catch(logContextMenuSetupError);
  void configureYandexWebHeaderRules();
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

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  const runtimeMessage = getRuntimeMessage(message);

  if (runtimeMessage?.type === "ST_TRANSLATE") {
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

  if (runtimeMessage?.type === "ST_GET_SETTINGS") {
    (async () => {
      sendResponse(await loadSettings());
    })();

    return true;
  }

  if (runtimeMessage?.type === "ST_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
