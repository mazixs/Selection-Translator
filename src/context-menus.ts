import { createTranslator, type MessageKey, type UiLocale } from "./i18n.js";

export const MENU_IDS = Object.freeze({
  parent: "selection-translator-parent",
  translate: "selection-translator-translate",
  copy: "selection-translator-copy",
  settings: "selection-translator-settings",
});

type RuntimeWithLastError = {
  readonly lastError: chrome.runtime.LastError | undefined;
};

type ContextMenusApi = {
  removeAll(callback?: () => void): void;
  create(
    properties: chrome.contextMenus.CreateProperties,
    callback?: () => void,
  ): number | string | undefined;
};

export type ContextMenuChromeApi = {
  runtime: RuntimeWithLastError;
  contextMenus: ContextMenusApi;
};

type MenuDefinition = Omit<chrome.contextMenus.CreateProperties, "title"> & {
  titleKey: MessageKey;
};

const MENU_DEFINITIONS: readonly MenuDefinition[] = [
  {
    id: MENU_IDS.parent,
    titleKey: "menu.parent",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.translate,
    parentId: MENU_IDS.parent,
    titleKey: "menu.translate",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.copy,
    parentId: MENU_IDS.parent,
    titleKey: "menu.copy",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.settings,
    parentId: MENU_IDS.parent,
    titleKey: "common.settings",
    contexts: ["selection"],
  },
];

let contextMenuSetupPromise: Promise<void> = Promise.resolve();

function consumeLastError(chromeApi: ContextMenuChromeApi): string | undefined {
  return chromeApi.runtime.lastError?.message;
}

function runContextMenuOperation(
  chromeApi: ContextMenuChromeApi,
  operation: (callback: () => void) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    operation(() => {
      const lastErrorMessage = consumeLastError(chromeApi);

      if (lastErrorMessage) {
        reject(new Error(lastErrorMessage));
        return;
      }

      resolve();
    });
  });
}

async function recreateContextMenus(
  chromeApi: ContextMenuChromeApi,
  locale: UiLocale,
): Promise<void> {
  const t = createTranslator(locale);

  await runContextMenuOperation(chromeApi, (callback) => {
    chromeApi.contextMenus.removeAll(callback);
  });

  for (const { titleKey, ...definition } of MENU_DEFINITIONS) {
    await runContextMenuOperation(chromeApi, (callback) => {
      chromeApi.contextMenus.create({ ...definition, title: t(titleKey) }, callback);
    });
  }
}

/** Menu titles cannot be updated by language, so a language change rebuilds the menu. */
export function setupContextMenus(
  locale: UiLocale,
  chromeApi: ContextMenuChromeApi = chrome,
): Promise<void> {
  contextMenuSetupPromise = contextMenuSetupPromise.then(
    () => recreateContextMenus(chromeApi, locale),
    () => recreateContextMenus(chromeApi, locale),
  );

  return contextMenuSetupPromise;
}
