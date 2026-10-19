import { getRequiredElement } from "./dom.js";
import {
  createTranslator,
  getUiLocale,
  type MessageKey,
  type Translate,
} from "./i18n.js";
import { appendLanguageOptions, localizeTree } from "./i18n-dom.js";
import { shouldRefreshSelectionForKey } from "./keyboard.js";
import { getRuntimeMessage, type RuntimeMessage } from "./messages.js";
import {
  clampPanelOpacity,
  DEFAULT_SETTINGS,
  mergeSettings,
  type Settings,
  type SettingsInput,
} from "./settings.js";
import { normalizeSelectionText } from "./text.js";
import { type CopyOutcome, translateAndCopy } from "./translate-copy.js";
import {
  describeTranslationFailure,
  describeTranslationNote,
} from "./translation-messages.js";
import type { TranslationResult } from "./translator.js";
import { isSelectableElement, isSelectionInsideContainer } from "./ui-selection.js";

/** A text in whatever language `t` speaks, so it can be shown again after a switch. */
type Wording = (t: Translate) => string;

const NO_TEXT: Wording = () => "";

function wording(key: MessageKey): Wording {
  return (t) => t(key);
}

/** Text that is not ours to translate, such as the translation itself. */
function verbatim(text: string): Wording {
  return () => text;
}

function joinWordings(...parts: Wording[]): Wording {
  return (t) =>
    parts
      .map((part) => part(t))
      .filter(Boolean)
      .join(" ");
}

(() => {
  const ROOT_ID = "selection-translator-root";
  const HIDDEN_CLASS = "stx-hidden";
  const UI_Z_INDEX = 2147483647;

  type ToolbarAction =
    | "translate"
    | "copy-selected"
    | "translate-copy"
    | "settings"
    | "close";
  type PanelState = "loading" | "ready" | "error";
  type UsefulRect = Pick<
    DOMRect,
    "left" | "right" | "top" | "bottom" | "width" | "height"
  >;
  type SelectionSnapshot = {
    text: string;
    rect: UsefulRect;
  };

  let root: HTMLDivElement | null = null;
  let toolbar: HTMLDivElement | null = null;
  let panel: HTMLDivElement | null = null;
  let currentSelection: SelectionSnapshot | null = null;
  let currentTranslation = "";
  let selectionTimer: ReturnType<typeof setTimeout> | undefined;
  let ignoreSelectionUntil = 0;
  let activeTranslationRequestId = 0;
  // What the panel and the toolbar show from code, kept as wordings so that a
  // language change can render them again: the panel text, the note the panel
  // rests on, the part of it that came with the result, and running flashes.
  let panelText: Wording = NO_TEXT;
  let panelNote: Wording = NO_TEXT;
  let resultNote: Wording = NO_TEXT;
  let panelFlash: Wording | null = null;
  let toolbarFlash: Wording | null = null;
  let panelFlashTimer: ReturnType<typeof setTimeout> | undefined;
  let toolbarFlashTimer: ReturnType<typeof setTimeout> | undefined;
  let cachedSettings: Settings = { ...DEFAULT_SETTINGS };
  // The browser language until the settings arrive; `applyLocale` then corrects it.
  let t: Translate = createTranslator(getUiLocale("auto"));

  function isHTMLElement(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement;
  }

  function isTrustedUserEvent(event: Event): boolean {
    return event.isTrusted === true;
  }

  function getToolbarAction(action: string | undefined): ToolbarAction | null {
    return action === "translate" ||
      action === "copy-selected" ||
      action === "translate-copy" ||
      action === "settings" ||
      action === "close"
      ? action
      : null;
  }

  function sendMessage<TResponse>(message: RuntimeMessage): Promise<TResponse | null> {
    return new Promise((resolve) => {
      if (!globalThis.chrome?.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response);
      });
    });
  }

  async function refreshSettings(): Promise<Settings> {
    const settings = await sendMessage<Settings>({ type: "ST_GET_SETTINGS" });
    cachedSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    applyAppearance();
    applyLocale();
    return cachedSettings;
  }

  function getLocale() {
    return getUiLocale(getSettings().uiLanguage);
  }

  /** Re-labels the UI already on the page, including the texts set from code. */
  function applyLocale() {
    const locale = getLocale();
    t = createTranslator(locale);

    if (!root) {
      return;
    }

    root.lang = locale;
    localizeTree(root, t);

    const panelTextElement = panel?.querySelector(".stx-panel-text");
    if (panelTextElement) {
      panelTextElement.textContent = panelText(t);
    }

    const panelNoteElement = panel?.querySelector(".stx-panel-note");
    if (panelNoteElement) {
      panelNoteElement.textContent = (panelFlash ?? panelNote)(t);
    }

    // localizeTree has just put the resting label back over a running flash.
    const translateButton = toolbar?.querySelector('[data-action="translate"]');
    if (translateButton && toolbarFlash) {
      translateButton.textContent = toolbarFlash(t);
    }
  }

  function getSettings(): Settings {
    return cachedSettings;
  }

  function isSelectableTarget(target: EventTarget | null): boolean {
    return isHTMLElement(target) && isSelectableElement(target);
  }

  function isSelectionInsideUi(selection: Selection | null): boolean {
    return isSelectionInsideContainer(selection, root);
  }

  function ensureRoot(): HTMLDivElement {
    if (root && document.documentElement.contains(root)) {
      return root;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.style.zIndex = String(UI_Z_INDEX);
    root.addEventListener(
      "mousedown",
      (event) => {
        event.stopPropagation();

        // Preventing the default keeps the page selection alive while the
        // toolbar is clicked, but inside the panel it would block the user
        // from selecting the translation by hand.
        if (!isSelectableTarget(event.target)) {
          event.preventDefault();
        }
      },
      true,
    );

    applyAppearance(root);
    root.lang = getLocale();
    document.documentElement.append(root);
    return root;
  }

  /**
   * Only the surface goes translucent: the text, borders and shadows stay
   * opaque, and the blur keeps the translation readable over a busy page.
   */
  function applyAppearance(target: HTMLDivElement | null = root) {
    if (!target) {
      return;
    }

    const opacity = clampPanelOpacity(getSettings().panelOpacity);
    target.style.setProperty("--stx-alpha", String(opacity / 100));
    target.dataset.translucent = String(opacity < 100);
  }

  function createButton(action: ToolbarAction): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stx-button";
    button.dataset.action = action;
    return button;
  }

  function ensureToolbar(): HTMLDivElement {
    const nextRoot = ensureRoot();

    if (toolbar) {
      return toolbar;
    }

    toolbar = document.createElement("div");
    toolbar.className = `stx-toolbar ${HIDDEN_CLASS}`;
    toolbar.setAttribute("role", "menu");
    const translateButton = createButton("translate");
    translateButton.dataset.i18n = "toolbar.translate";
    translateButton.dataset.i18nTitle = "toolbar.translate";
    toolbar.append(createBadge());
    toolbar.append(translateButton);
    toolbar.append(createIconButton("⧉", "copy-selected", "toolbar.copySelection"));
    toolbar.append(createIconButton("⇄", "translate-copy", "toolbar.translateAndCopy"));
    toolbar.append(createIconButton("⋮", "settings", "common.settings"));
    toolbar.append(createIconButton("×", "close", "common.close"));
    localizeTree(toolbar, t);
    nextRoot.append(toolbar);

    toolbar.addEventListener("click", (event) => {
      if (!isTrustedUserEvent(event)) {
        return;
      }

      if (!isHTMLElement(event.target)) {
        return;
      }

      const button = event.target.closest<HTMLButtonElement>("button[data-action]");
      if (!button) {
        return;
      }

      const action = getToolbarAction(button.dataset.action);
      if (!action) {
        return;
      }

      ignoreSelectionUntil = Date.now() + 400;
      void handleToolbarAction(action);
    });

    return toolbar;
  }

  function createBadge(): HTMLSpanElement {
    const badge = document.createElement("span");
    badge.className = "stx-badge";
    badge.dataset.i18nTitle = "app.name";

    const icon = document.createElement("img");
    icon.className = "stx-badge-icon";
    icon.src = chrome.runtime.getURL("assets/icon.svg");
    icon.alt = "";
    icon.decoding = "async";
    badge.append(icon);

    return badge;
  }

  function createIconButton(
    symbol: string,
    action: ToolbarAction,
    titleKey: MessageKey,
  ): HTMLButtonElement {
    const button = createButton(action);
    button.classList.add("stx-icon-button");
    button.textContent = symbol;
    button.dataset.i18nTitle = titleKey;
    button.dataset.i18nAriaLabel = titleKey;
    return button;
  }

  function ensurePanel(): HTMLDivElement {
    const nextRoot = ensureRoot();

    if (panel) {
      return panel;
    }

    panel = document.createElement("div");
    panel.className = `stx-panel ${HIDDEN_CLASS}`;
    panel.setAttribute("role", "dialog");
    panel.dataset.i18nAriaLabel = "panel.label";
    panel.innerHTML = `
      <div class="stx-panel-header">
        <label class="stx-language-label">
          <span class="stx-visually-hidden" data-i18n="panel.targetLanguage"></span>
          <select class="stx-language-select"></select>
        </label>
        <div class="stx-panel-actions">
          <button type="button" class="stx-icon-button stx-panel-copy" data-i18n-title="panel.copyTranslation" data-i18n-aria-label="panel.copyTranslation">⧉</button>
          <button type="button" class="stx-icon-button stx-panel-close" data-i18n-title="common.close" data-i18n-aria-label="common.close">×</button>
        </div>
      </div>
      <div class="stx-panel-body">
        <div class="stx-panel-text" aria-live="polite"></div>
        <div class="stx-skeleton" aria-hidden="true">
          <div class="stx-skeleton-line"></div>
          <div class="stx-skeleton-line"></div>
          <div class="stx-skeleton-line"></div>
        </div>
        <div class="stx-panel-note"></div>
      </div>
      <div class="stx-panel-footer">
        <button type="button" class="stx-copy-translation" data-i18n="panel.copyTranslation"></button>
      </div>
    `;

    appendLanguageOptions(
      getRequiredElement(".stx-language-select", HTMLSelectElement, panel),
    );
    localizeTree(panel, t);
    nextRoot.append(panel);

    getRequiredElement(".stx-panel-close", HTMLButtonElement, panel).addEventListener(
      "click",
      (event) => {
        if (!isTrustedUserEvent(event)) {
          return;
        }

        hidePanel();
      },
    );
    for (const selector of [".stx-panel-copy", ".stx-copy-translation"]) {
      getRequiredElement(selector, HTMLButtonElement, panel).addEventListener(
        "click",
        handlePanelCopyClick,
      );
    }
    getRequiredElement(".stx-language-select", HTMLSelectElement, panel).addEventListener(
      "change",
      handleLanguageChange,
    );

    return panel;
  }

  function handlePanelCopyClick(event: Event) {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    void copyTranslation();
  }

  function getSelectionSnapshot(forcedText = ""): SelectionSnapshot | null {
    const selection = window.getSelection();

    if (!forcedText && isSelectionInsideUi(selection)) {
      return null;
    }

    const text = normalizeSelectionText(forcedText || selection?.toString());

    if (!text) {
      return null;
    }

    let rect: UsefulRect | null = null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      rect = getUsefulRect(range);
    }

    return {
      text,
      rect: rect || getCenteredRect(),
    };
  }

  function getUsefulRect(range: Range): UsefulRect | null {
    const rects = [...range.getClientRects()].filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );

    if (rects.length > 0) {
      return rects[rects.length - 1] ?? null;
    }

    const rect = range.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 ? rect : null;
  }

  function getCenteredRect(): UsefulRect {
    return {
      left: window.innerWidth / 2 - 80,
      right: window.innerWidth / 2 + 80,
      top: window.innerHeight / 2 - 20,
      bottom: window.innerHeight / 2 + 20,
      width: 160,
      height: 40,
    };
  }

  async function updateSelectionFromPage(): Promise<void> {
    if (Date.now() < ignoreSelectionUntil) {
      return;
    }

    if (isSelectionInsideUi(window.getSelection())) {
      return;
    }

    const settings = getSettings();
    if (!settings.showSelectionToolbar) {
      hideToolbar();
      return;
    }

    const snapshot = getSelectionSnapshot();
    if (!snapshot) {
      if (!settings.keepPanelOpen) {
        hideAll();
      } else {
        hideToolbar();
      }
      return;
    }

    currentSelection = snapshot;
    currentTranslation = "";
    showToolbar(snapshot.rect);
  }

  function scheduleSelectionUpdate() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(updateSelectionFromPage, 80);
  }

  function showToolbar(rect: UsefulRect) {
    const nextToolbar = ensureToolbar();
    nextToolbar.classList.remove(HIDDEN_CLASS);
    positionElement(nextToolbar, rect, "toolbar");
  }

  function showPanel(rect: UsefulRect) {
    const nextPanel = ensurePanel();
    nextPanel.classList.remove(HIDDEN_CLASS);
    positionElement(nextPanel, rect, "panel");
  }

  function positionElement(
    element: HTMLElement,
    rect: UsefulRect,
    mode: "toolbar" | "panel",
  ) {
    element.style.position = "fixed";
    element.style.left = "0px";
    element.style.top = "0px";
    element.style.visibility = "hidden";

    requestAnimationFrame(() => {
      const box = element.getBoundingClientRect();
      const gap = mode === "panel" ? 14 : 8;
      const viewportPadding = 8;
      const maxLeft = window.innerWidth - box.width - viewportPadding;
      const maxTop = window.innerHeight - box.height - viewportPadding;

      let left: number;
      let top: number;

      if (mode === "panel" && rect.right + box.width + gap < window.innerWidth) {
        left = rect.right + gap;
        top = Math.max(viewportPadding, rect.top - 4);
      } else {
        left = rect.left;
        top = rect.bottom + gap;
      }

      left = Math.max(viewportPadding, Math.min(left, maxLeft));
      top = Math.max(viewportPadding, Math.min(top, maxTop));

      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.style.visibility = "visible";

      if (mode === "panel") {
        playEnterAnimation(element);
      }
    });
  }

  function playEnterAnimation(element: HTMLElement) {
    element.classList.remove("stx-enter");
    // Reading the layout restarts the animation on a repeated open.
    void element.offsetWidth;
    element.classList.add("stx-enter");
  }

  function hideToolbar() {
    toolbar?.classList.add(HIDDEN_CLASS);
  }

  function hidePanel() {
    panel?.classList.add(HIDDEN_CLASS);
    // A reply still on its way must neither fill nor be copied from a dismissed panel.
    activeTranslationRequestId++;
  }

  function hideAll() {
    hideToolbar();
    hidePanel();
  }

  /**
   * `textLanguage` names the language of a translation. Loading and error
   * texts have none and inherit the interface language from the root.
   */
  function setPanelState(
    kind: PanelState,
    text: Wording,
    note: Wording = NO_TEXT,
    textLanguage = "",
  ) {
    const nextPanel = ensurePanel();
    nextPanel.dataset.state = kind;
    panelText = text;

    const textElement = getRequiredElement(".stx-panel-text", HTMLDivElement, nextPanel);
    textElement.textContent = text(t);
    if (textLanguage) {
      textElement.lang = textLanguage;
    } else {
      textElement.removeAttribute("lang");
    }

    resultNote = note;
    setPanelNote(note);
  }

  /** Sets the note the panel rests on, and drops a flash that would overwrite it. */
  function setPanelNote(note: Wording) {
    clearTimeout(panelFlashTimer);
    panelFlash = null;
    panelNote = note;
    getRequiredElement(".stx-panel-note", HTMLDivElement, ensurePanel()).textContent =
      note(t);
  }

  async function handleToolbarAction(action: ToolbarAction) {
    if (action === "translate") {
      await openTranslationPanel();
      return;
    }

    if (action === "copy-selected") {
      await copySelectedText();
      return;
    }

    if (action === "translate-copy") {
      // The panel opens over the toolbar, so the copy has to ride on the same click.
      showCopyOutcome(
        await translateAndCopy({
          translate: () => openTranslationPanel(),
          hasFocus: () => document.hasFocus(),
          copy: () => copyText(currentTranslation),
        }),
      );
      return;
    }

    if (action === "settings") {
      await sendMessage({ type: "ST_OPEN_OPTIONS" });
      return;
    }

    if (action === "close") {
      hideAll();
    }
  }

  /** Resolves to true only when this request's translation is the one on screen. */
  async function openTranslationPanel(forcedText = ""): Promise<boolean> {
    const snapshot = getSelectionSnapshot(forcedText) || currentSelection;
    if (!snapshot?.text) {
      return false;
    }

    currentSelection = snapshot;
    currentTranslation = "";
    const requestId = ++activeTranslationRequestId;
    showPanel(snapshot.rect);
    setPanelState("loading", wording("panel.loading"));

    const settings = getSettings();
    const languageSelect = getRequiredElement(
      ".stx-language-select",
      HTMLSelectElement,
      ensurePanel(),
    );
    languageSelect.value = settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage;

    const result = await sendMessage<TranslationResult>({
      type: "ST_TRANSLATE",
      text: snapshot.text,
    });

    if (requestId !== activeTranslationRequestId) {
      return false;
    }

    if (!result) {
      setPanelState(
        "error",
        wording("panel.noConnection"),
        wording("panel.noConnectionHint"),
      );
      return false;
    }

    if (!result.ok) {
      setPanelState("error", (t) => describeTranslationFailure(result, t));
      return false;
    }

    currentTranslation = result.translatedText;
    setPanelState(
      "ready",
      verbatim(result.translatedText),
      (t) => describeTranslationNote(result, t),
      result.targetLanguage,
    );
    return true;
  }

  async function copySelectedText(forcedText = "") {
    const text =
      forcedText || currentSelection?.text || getSelectionSnapshot()?.text || "";
    const copied = await copyText(text);
    flashToolbar(wording(copied ? "toolbar.copied" : "toolbar.copyFailed"));
  }

  async function copyTranslation() {
    if (!currentTranslation) {
      return;
    }

    showCopyOutcome((await copyText(currentTranslation)) ? "copied" : "failed");
  }

  function showCopyOutcome(outcome: CopyOutcome) {
    switch (outcome) {
      case "not-ready":
        // The panel already shows why (loading, error) or is gone, so there is nothing to add.
        return;
      case "unfocused":
        // The hint stays until the next state: the user is likely to be away longer than a flash.
        setPanelNote(joinWordings(resultNote, wording("panel.unfocused")));
        return;
      case "copied":
        clearCopyHint();
        flashPanel(wording("panel.copied"));
        return;
      case "failed":
        clearCopyHint();
        flashPanel(wording("panel.copyBlocked"), 5_000);
        return;
      default: {
        const unhandled: never = outcome;
        return unhandled;
      }
    }
  }

  /** Any copy attempt from the panel has served the "press ⧉" hint, whatever its result. */
  function clearCopyHint() {
    setPanelNote(resultNote);
  }

  async function copyText(text: unknown): Promise<boolean> {
    const value = String(text || "");
    if (!value) {
      return false;
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Some pages block the clipboard API, so the textarea path stays.
      }
    }

    return copyThroughTextarea(value);
  }

  function copyThroughTextarea(value: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    ensureRoot().append(textarea);

    const previousFocus = document.activeElement;
    textarea.focus();
    textarea.select();

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }

    textarea.remove();

    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }

    return copied;
  }

  function flashToolbar(message: Wording) {
    const translateButton = toolbar?.querySelector<HTMLButtonElement>(
      '[data-action="translate"]',
    );
    if (!translateButton) {
      return;
    }

    // Restoring the label from the catalog, not a captured one: a second flash
    // would otherwise capture the first message and leave it on the button.
    clearTimeout(toolbarFlashTimer);
    toolbarFlash = message;
    translateButton.textContent = message(t);
    toolbarFlashTimer = setTimeout(() => {
      toolbarFlash = null;
      translateButton.textContent = t("toolbar.translate");
    }, 900);
  }

  function flashPanel(message: Wording, durationMs = 1200) {
    const note = panel?.querySelector<HTMLDivElement>(".stx-panel-note");
    if (!note) {
      return;
    }

    // The note is restored from state, not from what it showed when the flash
    // began, so a result that arrives meanwhile keeps its own note.
    clearTimeout(panelFlashTimer);
    panelFlash = message;
    note.textContent = message(t);
    panelFlashTimer = setTimeout(() => {
      panelFlash = null;
      note.textContent = panelNote(t);
    }, durationMs);
  }

  async function handleLanguageChange(event: Event) {
    if (!isTrustedUserEvent(event)) {
      return;
    }

    if (!(event.target instanceof HTMLSelectElement)) {
      return;
    }

    const targetLanguage = event.target.value;
    const currentSettings = getSettings();
    cachedSettings = {
      ...currentSettings,
      targetLanguage,
    };
    // Only this field: a whole copy could put back values changed elsewhere.
    await chrome.storage.sync.set({ targetLanguage });

    if (currentSelection?.text) {
      await openTranslationPanel(currentSelection.text);
    }
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const runtimeMessage = getRuntimeMessage(message);

    if (runtimeMessage?.type === "ST_CONTEXT_TRANSLATE") {
      void openTranslationPanel(runtimeMessage.text);
      sendResponse({ ok: true });
      return true;
    }

    if (runtimeMessage?.type === "ST_CONTEXT_COPY_SELECTION") {
      void copySelectedText(runtimeMessage.text);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  document.addEventListener("selectionchange", scheduleSelectionUpdate);
  document.addEventListener("mouseup", scheduleSelectionUpdate);
  document.addEventListener("keyup", (event) => {
    if (shouldRefreshSelectionForKey(event.key)) {
      scheduleSelectionUpdate();
    }
  });
  window.addEventListener("scroll", () => {
    if (currentSelection?.rect && toolbar && !toolbar.classList.contains(HIDDEN_CLASS)) {
      hideToolbar();
    }
  });

  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") {
        return;
      }

      const changedSettings = Object.fromEntries(
        Object.entries(changes).map(([key, change]) => [key, change.newValue]),
      ) as SettingsInput;
      cachedSettings = mergeSettings({
        ...cachedSettings,
        ...changedSettings,
      });
      applyAppearance();

      if (changes?.uiLanguage) {
        applyLocale();
      }

      if (changes?.targetLanguage && panel && !panel.classList.contains(HIDDEN_CLASS)) {
        const languageSelect = getRequiredElement(
          ".stx-language-select",
          HTMLSelectElement,
          panel,
        );
        languageSelect.value = cachedSettings.targetLanguage;
      }
    });
  }

  void refreshSettings();
})();
