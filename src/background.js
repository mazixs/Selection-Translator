import { loadSettings } from "./settings.js";
import { translateText } from "./translator.js";

const MENU_IDS = Object.freeze({
  parent: "selection-translator-parent",
  translate: "selection-translator-translate",
  copy: "selection-translator-copy",
  settings: "selection-translator-settings",
});

const YANDEX_WEB_HEADER_RULE_IDS = [7401, 7402];
const YANDEX_WEB_HEADER_RULES = [
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

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.parent,
      title: "Перевод",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: MENU_IDS.translate,
      parentId: MENU_IDS.parent,
      title: "Перевести",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: MENU_IDS.copy,
      parentId: MENU_IDS.parent,
      title: "Скопировать",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: MENU_IDS.settings,
      parentId: MENU_IDS.parent,
      title: "Настройки",
      contexts: ["selection"],
    });
  });
}

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

async function sendToTab(tabId, message) {
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
  createContextMenus();
  void configureYandexWebHeaderRules();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ST_TRANSLATE") {
    (async () => {
      const settings = await loadSettings();
      const result = await translateText({
        text: message.text || "",
        settings,
      });
      sendResponse(result);
    })();

    return true;
  }

  if (message?.type === "ST_GET_SETTINGS") {
    (async () => {
      sendResponse(await loadSettings());
    })();

    return true;
  }

  if (message?.type === "ST_OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
