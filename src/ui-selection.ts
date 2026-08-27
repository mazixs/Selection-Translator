export type SelectableElement = {
  tagName: string;
  closest(selector: string): unknown;
};

export type SelectionLike = {
  anchorNode?: unknown;
  focusNode?: unknown;
} | null;

export type ContainerLike = {
  contains(node: unknown): boolean;
} | null;

/** Panel areas the user is allowed to select with the mouse. */
export const SELECTABLE_SELECTOR =
  ".stx-panel-body, .stx-panel-text, .stx-panel-note";

export const EDITABLE_TAGS = ["INPUT", "TEXTAREA", "SELECT", "OPTION"];

export function isSelectableElement(element: SelectableElement): boolean {
  if (EDITABLE_TAGS.includes(element.tagName)) {
    return true;
  }

  return Boolean(element.closest(SELECTABLE_SELECTOR));
}

/**
 * A selection living inside our own panel means the user is copying the
 * translation by hand, so page-selection tracking has to stay out of the way.
 */
export function isSelectionInsideContainer(
  selection: SelectionLike,
  container: ContainerLike,
): boolean {
  if (!selection || !container) {
    return false;
  }

  return (
    Boolean(selection.anchorNode && container.contains(selection.anchorNode)) ||
    Boolean(selection.focusNode && container.contains(selection.focusNode))
  );
}
