import { getRuntimeMessage, type RuntimeMessage } from "./messages.js";
import { shouldRefreshSelectionForKey } from "./keyboard.js";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type Settings,
  type SettingsInput,
} from "./settings.js";
import type { TranslationResult } from "./translator.js";

(() => {
  const ROOT_ID = "selection-translator-root";
  const HIDDEN_CLASS = "stx-hidden";
  const UI_Z_INDEX = 2147483647;

  type ToolbarAction =
    | "translate"
    | "copy-selected"
    | "copy-translation"
    | "settings"
    | "close";
  type PanelState = "loading" | "ready" | "error";
  type UsefulRect = Pick<DOMRect, "left" | "right" | "top" | "bottom" | "width" | "height">;
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
  let cachedSettings: Settings = { ...DEFAULT_SETTINGS };

  function isHTMLElement(target: EventTarget | null): target is HTMLElement {
    return target instanceof HTMLElement;
  }

  function isTrustedUserEvent(event: Event): boolean {
    return event.isTrusted === true;
  }

  function getRequiredElement<T extends Element>(
    parent: ParentNode,
    selector: string,
    constructor: { new (...args: never[]): T },
  ): T {
    const element = parent.querySelector(selector);

    if (!(element instanceof constructor)) {
      throw new Error(`Missing required element: ${selector}`);
    }

    return element;
  }

  function getToolbarAction(action: string | undefined): ToolbarAction | null {
    return action === "translate" ||
      action === "copy-selected" ||
      action === "copy-translation" ||
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
    return cachedSettings;
  }

  function getSettings(): Settings {
    return cachedSettings;
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

        const tagName = isHTMLElement(event.target) ? event.target.tagName : "";
        if (!["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(tagName)) {
          event.preventDefault();
        }
      },
      true,
    );

    document.documentElement.append(root);
    return root;
  }

  function createButton(
    label: string,
    action: ToolbarAction,
    title = label,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stx-button";
    button.dataset.action = action;
    button.title = title;
    button.textContent = label;
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
    toolbar.append(createBadge());
    toolbar.append(createButton("Перевести", "translate"));
    toolbar.append(createIconButton("⧉", "copy-selected", "Скопировать выделенное"));
    toolbar.append(createIconButton("⇄", "copy-translation", "Скопировать перевод"));
    toolbar.append(createIconButton("⋮", "settings", "Настройки"));
    toolbar.append(createIconButton("×", "close", "Закрыть"));
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
    badge.title = "Selection Translator";

    const icon = document.createElement("img");
    icon.className = "stx-badge-icon";
    icon.src = chrome.runtime.getURL("assets/icon-32.png");
    icon.alt = "";
    icon.decoding = "async";
    badge.append(icon);

    return badge;
  }

  function createIconButton(
    label: string,
    action: ToolbarAction,
    title: string,
  ): HTMLButtonElement {
    const button = createButton(label, action, title);
    button.classList.add("stx-icon-button");
    button.setAttribute("aria-label", title);
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
    panel.setAttribute("aria-label", "Перевод");
    panel.innerHTML = `
      <div class="stx-panel-header">
        <label class="stx-language-label">
          <span class="stx-visually-hidden">Язык перевода</span>
          <select class="stx-language-select">
            <option value="ru">Русский</option>
            <option value="en">Английский</option>
            <option value="de">Немецкий</option>
            <option value="fr">Французский</option>
            <option value="es">Испанский</option>
            <option value="it">Итальянский</option>
            <option value="tr">Турецкий</option>
            <option value="uk">Украинский</option>
          </select>
        </label>
        <div class="stx-panel-actions">
          <button type="button" class="stx-icon-button stx-panel-copy" title="Скопировать перевод" aria-label="Скопировать перевод">⧉</button>
          <button type="button" class="stx-icon-button stx-panel-close" title="Закрыть" aria-label="Закрыть">×</button>
        </div>
      </div>
      <div class="stx-panel-body">
        <div class="stx-panel-text" aria-live="polite"></div>
        <div class="stx-panel-note"></div>
      </div>
      <div class="stx-panel-footer">
        <button type="button" class="stx-copy-translation">Скопировать перевод</button>
      </div>
    `;

    nextRoot.append(panel);

    getRequiredElement(panel, ".stx-panel-close", HTMLButtonElement).addEventListener(
      "click",
      (event) => {
        if (!isTrustedUserEvent(event)) {
          return;
        }

        hidePanel();
      },
    );
    getRequiredElement(panel, ".stx-panel-copy", HTMLButtonElement).addEventListener(
      "click",
      (event) => {
        if (!isTrustedUserEvent(event)) {
          return;
        }

        void copyTranslation();
      },
    );
    getRequiredElement(panel, ".stx-copy-translation", HTMLButtonElement).addEventListener(
      "click",
      (event) => {
        if (!isTrustedUserEvent(event)) {
          return;
        }

        void copyTranslation();
      },
    );
    getRequiredElement(panel, ".stx-language-select", HTMLSelectElement).addEventListener(
      "change",
      handleLanguageChange,
    );

    return panel;
  }

  function getSelectionSnapshot(forcedText = ""): SelectionSnapshot | null {
    const selection = window.getSelection();
    const text = String(forcedText || selection?.toString() || "").trim();

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
    setButtonEnabled("copy-translation", false);
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

      let left;
      let top;

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
    });
  }

  function hideToolbar() {
    toolbar?.classList.add(HIDDEN_CLASS);
  }

  function hidePanel() {
    panel?.classList.add(HIDDEN_CLASS);
  }

  function hideAll() {
    hideToolbar();
    hidePanel();
  }

  function setPanelState(kind: PanelState, text: string, note = "") {
    const nextPanel = ensurePanel();
    nextPanel.dataset.state = kind;
    getRequiredElement(nextPanel, ".stx-panel-text", HTMLDivElement).textContent = text;
    getRequiredElement(nextPanel, ".stx-panel-note", HTMLDivElement).textContent = note;
  }

  function setButtonEnabled(action: ToolbarAction, enabled: boolean) {
    const button = toolbar?.querySelector<HTMLButtonElement>(
      `[data-action="${action}"]`,
    );
    if (button) {
      button.disabled = !enabled;
    }
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

    if (action === "copy-translation") {
      await copyTranslation();
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

  function getPanelNote(result: TranslationResult): string {
    if (!result.ok) {
      return "";
    }

    const notes = [
      result.note || "",
      result.wasTrimmed ? "Текст был обрезан по лимиту из настроек." : "",
    ];

    return notes.filter(Boolean).join(" ");
  }

  async function openTranslationPanel(forcedText = "") {
    const snapshot = getSelectionSnapshot(forcedText) || currentSelection;
    if (!snapshot?.text) {
      return;
    }

    currentSelection = snapshot;
    currentTranslation = "";
    const requestId = ++activeTranslationRequestId;
    showPanel(snapshot.rect);
    setPanelState("loading", "Перевожу...");
    setButtonEnabled("copy-translation", false);

    const settings = getSettings();
    const languageSelect = getRequiredElement(
      ensurePanel(),
      ".stx-language-select",
      HTMLSelectElement,
    );
    languageSelect.value = settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage;

    const result = await sendMessage<TranslationResult>({
      type: "ST_TRANSLATE",
      text: snapshot.text,
    });

    if (requestId !== activeTranslationRequestId) {
      return;
    }

    if (!result) {
      setPanelState(
        "error",
        "Не удалось связаться с расширением.",
        "Попробуй обновить страницу и повторить.",
      );
      return;
    }

    if (!result.ok) {
      setPanelState("error", result.message || "Не удалось перевести текст.");
      return;
    }

    currentTranslation = result.translatedText;
    setButtonEnabled("copy-translation", true);
    setPanelState("ready", result.translatedText, getPanelNote(result));
  }

  async function copySelectedText(forcedText = "") {
    const text = forcedText || currentSelection?.text || getSelectionSnapshot()?.text || "";
    await copyText(text);
    flashToolbar("Скопировано");
  }

  async function copyTranslation() {
    if (!currentTranslation) {
      return;
    }

    await copyText(currentTranslation);
    flashPanel("Перевод скопирован");
  }

  async function copyText(text: unknown) {
    const value = String(text || "");
    if (!value) {
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function flashToolbar(message: string) {
    const translateButton = toolbar?.querySelector<HTMLButtonElement>(
      '[data-action="translate"]',
    );
    if (!translateButton) {
      return;
    }

    const previous = translateButton.textContent;
    translateButton.textContent = message;
    setTimeout(() => {
      translateButton.textContent = previous;
    }, 900);
  }

  function flashPanel(message: string) {
    const note = panel?.querySelector<HTMLDivElement>(".stx-panel-note");
    if (!note) {
      return;
    }

    const previous = note.textContent;
    note.textContent = message;
    setTimeout(() => {
      note.textContent = previous;
    }, 1200);
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
    await chrome.storage.sync.set({
      ...cachedSettings,
    });

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

      if (changes?.targetLanguage && panel && !panel.classList.contains(HIDDEN_CLASS)) {
        const languageSelect = getRequiredElement(
          panel,
          ".stx-language-select",
          HTMLSelectElement,
        );
        languageSelect.value = cachedSettings.targetLanguage;
      }
    });
  }

  void refreshSettings();
})();
