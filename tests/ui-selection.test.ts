import test from "node:test";
import assert from "node:assert/strict";

import {
  isSelectableElement,
  isSelectionInsideContainer,
  SELECTABLE_SELECTOR,
} from "../src/ui-selection.js";

function createElement(tagName: string, matchedSelectors: string[] = []) {
  return {
    tagName,
    closest(selector: string) {
      return matchedSelectors.includes(selector) ? { tagName: "DIV" } : null;
    },
  };
}

test("panel text and note stay selectable", () => {
  assert.equal(
    isSelectableElement(createElement("DIV", [SELECTABLE_SELECTOR])),
    true,
  );
});

test("toolbar buttons are not selectable, so the page selection survives", () => {
  assert.equal(isSelectableElement(createElement("BUTTON")), false);
  assert.equal(isSelectableElement(createElement("DIV")), false);
});

test("form controls keep their own mouse behaviour", () => {
  assert.equal(isSelectableElement(createElement("SELECT")), true);
  assert.equal(isSelectableElement(createElement("TEXTAREA")), true);
  assert.equal(isSelectableElement(createElement("INPUT")), true);
});

test("isSelectionInsideContainer detects a selection made inside the panel", () => {
  const panelNode = { id: "panel-text" };
  const pageNode = { id: "article" };
  const container = { contains: (node: unknown) => node === panelNode };

  assert.equal(
    isSelectionInsideContainer(
      { anchorNode: panelNode, focusNode: panelNode },
      container,
    ),
    true,
  );
  assert.equal(
    isSelectionInsideContainer(
      { anchorNode: pageNode, focusNode: panelNode },
      container,
    ),
    true,
  );
  assert.equal(
    isSelectionInsideContainer(
      { anchorNode: pageNode, focusNode: pageNode },
      container,
    ),
    false,
  );
});

test("isSelectionInsideContainer tolerates a missing selection or container", () => {
  const container = { contains: () => true };

  assert.equal(isSelectionInsideContainer(null, container), false);
  assert.equal(isSelectionInsideContainer({}, container), false);
  assert.equal(
    isSelectionInsideContainer({ anchorNode: { id: "x" } }, null),
    false,
  );
});
