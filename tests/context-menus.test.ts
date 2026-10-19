import assert from "node:assert/strict";
import test from "node:test";

import { type ContextMenuChromeApi, setupContextMenus } from "../src/context-menus.js";

const EXPECTED_MENU_IDS = [
  "selection-translator-parent",
  "selection-translator-translate",
  "selection-translator-copy",
  "selection-translator-settings",
];

function createChromeMock() {
  const createdMenuIds = new Set();
  const titles = new Map<string, string | undefined>();
  const duplicateErrors: string[] = [];
  let currentLastError: chrome.runtime.LastError | undefined;
  let lastErrorReads = 0;

  function setLastError(message?: string) {
    currentLastError = message ? { message } : undefined;
  }

  const runtime: ContextMenuChromeApi["runtime"] = {
    get lastError() {
      lastErrorReads += 1;
      return currentLastError;
    },
  };

  return {
    chromeApi: {
      runtime,
      contextMenus: {
        removeAll(callback = () => {}) {
          createdMenuIds.clear();
          setLastError(undefined);
          queueMicrotask(callback);
        },
        create(item: chrome.contextMenus.CreateProperties, callback = () => {}) {
          const id = String(item.id);

          if (createdMenuIds.has(id)) {
            const message = `Cannot create item with duplicate id ${id}`;
            duplicateErrors.push(message);
            setLastError(message);
          } else {
            createdMenuIds.add(id);
            titles.set(id, item.title);
            setLastError(undefined);
          }

          queueMicrotask(callback);
          return id;
        },
      },
    } satisfies ContextMenuChromeApi,
    duplicateErrors,
    getCreatedMenuIds: () => [...createdMenuIds],
    getTitles: () => Object.fromEntries(titles),
    getLastErrorReads: () => lastErrorReads,
  };
}

test("setupContextMenus serializes overlapping setup calls and consumes create errors", async () => {
  const mock = createChromeMock();

  await Promise.all([
    setupContextMenus("en", mock.chromeApi),
    setupContextMenus("en", mock.chromeApi),
  ]);

  assert.deepEqual(mock.duplicateErrors, []);
  assert.deepEqual(mock.getCreatedMenuIds(), EXPECTED_MENU_IDS);
  assert.ok(mock.getLastErrorReads() >= EXPECTED_MENU_IDS.length);
});

test("setupContextMenus titles the menu in the requested language", async () => {
  const mock = createChromeMock();

  await setupContextMenus("es", mock.chromeApi);
  assert.deepEqual(mock.getTitles(), {
    "selection-translator-parent": "Traducción",
    "selection-translator-translate": "Traducir",
    "selection-translator-copy": "Copiar",
    "selection-translator-settings": "Ajustes",
  });

  await setupContextMenus("ru", mock.chromeApi);
  assert.equal(mock.getTitles()["selection-translator-translate"], "Перевести");
});
