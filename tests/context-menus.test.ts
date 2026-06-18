import test from "node:test";
import assert from "node:assert/strict";

import { setupContextMenus, type ContextMenuChromeApi } from "../src/context-menus.js";

const EXPECTED_MENU_IDS = [
  "selection-translator-parent",
  "selection-translator-translate",
  "selection-translator-copy",
  "selection-translator-settings",
];

function createChromeMock() {
  const createdMenuIds = new Set();
  const duplicateErrors: string[] = [];
  let currentLastError: chrome.runtime.LastError | undefined = undefined;
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
            setLastError(undefined);
          }

          queueMicrotask(callback);
          return id;
        },
      },
    } satisfies ContextMenuChromeApi,
    duplicateErrors,
    getCreatedMenuIds: () => [...createdMenuIds],
    getLastErrorReads: () => lastErrorReads,
  };
}

test("setupContextMenus serializes overlapping setup calls and consumes create errors", async () => {
  const mock = createChromeMock();

  await Promise.all([
    setupContextMenus(mock.chromeApi),
    setupContextMenus(mock.chromeApi),
  ]);

  assert.deepEqual(mock.duplicateErrors, []);
  assert.deepEqual(mock.getCreatedMenuIds(), EXPECTED_MENU_IDS);
  assert.ok(mock.getLastErrorReads() >= EXPECTED_MENU_IDS.length);
});
