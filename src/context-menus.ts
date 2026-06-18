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
  ): number | string | void;
};

export type ContextMenuChromeApi = {
  runtime: RuntimeWithLastError;
  contextMenus: ContextMenusApi;
};

type MenuDefinition = chrome.contextMenus.CreateProperties;

const MENU_DEFINITIONS: readonly MenuDefinition[] = [
  {
    id: MENU_IDS.parent,
    title: "Перевод",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.translate,
    parentId: MENU_IDS.parent,
    title: "Перевести",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.copy,
    parentId: MENU_IDS.parent,
    title: "Скопировать",
    contexts: ["selection"],
  },
  {
    id: MENU_IDS.settings,
    parentId: MENU_IDS.parent,
    title: "Настройки",
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

async function recreateContextMenus(chromeApi: ContextMenuChromeApi): Promise<void> {
  await runContextMenuOperation(chromeApi, (callback) => {
    chromeApi.contextMenus.removeAll(callback);
  });

  for (const definition of MENU_DEFINITIONS) {
    await runContextMenuOperation(chromeApi, (callback) => {
      chromeApi.contextMenus.create(definition, callback);
    });
  }
}

export function setupContextMenus(
  chromeApi: ContextMenuChromeApi = chrome,
): Promise<void> {
  contextMenuSetupPromise = contextMenuSetupPromise.then(
    () => recreateContextMenus(chromeApi),
    () => recreateContextMenus(chromeApi),
  );

  return contextMenuSetupPromise;
}
