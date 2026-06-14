(() => {
  const DEFAULT_SETTINGS = {
    provider: "google",
    targetLanguage: "ru",
    sourceLanguage: "auto",
    endpoint: "",
    apiKey: "",
    yandexFolderId: "",
    autoDetectSource: true,
    showSelectionToolbar: true,
    keepPanelOpen: false,
    maxCharacters: 5000,
  };

  const ROOT_ID = "selection-translator-root";
  const HIDDEN_CLASS = "stx-hidden";
  const UI_Z_INDEX = 2147483647;

  let root;
  let toolbar;
  let panel;
  let currentSelection = null;
  let currentTranslation = "";
  let selectionTimer = 0;
  let ignoreSelectionUntil = 0;
  let activeTranslationRequestId = 0;
  let cachedSettings = { ...DEFAULT_SETTINGS };

  function sendMessage(message) {
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

  async function refreshSettings() {
    const settings = await sendMessage({ type: "ST_GET_SETTINGS" });
    cachedSettings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    return cachedSettings;
  }

  function getSettings() {
    return cachedSettings;
  }

  function ensureRoot() {
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

        if (!["INPUT", "TEXTAREA", "SELECT", "OPTION"].includes(event.target.tagName)) {
          event.preventDefault();
        }
      },
      true,
    );

    document.documentElement.append(root);
    return root;
  }

  function createButton(label, action, title = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stx-button";
    button.dataset.action = action;
    button.title = title;
    button.textContent = label;
    return button;
  }

  function ensureToolbar() {
    ensureRoot();

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
    root.append(toolbar);

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }

      ignoreSelectionUntil = Date.now() + 400;
      handleToolbarAction(button.dataset.action);
    });

    return toolbar;
  }

  function createBadge() {
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

  function createIconButton(label, action, title) {
    const button = createButton(label, action, title);
    button.classList.add("stx-icon-button");
    button.setAttribute("aria-label", title);
    return button;
  }

  function ensurePanel() {
    ensureRoot();

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

    root.append(panel);

    panel.querySelector(".stx-panel-close").addEventListener("click", hidePanel);
    panel.querySelector(".stx-panel-copy").addEventListener("click", copyTranslation);
    panel
      .querySelector(".stx-copy-translation")
      .addEventListener("click", copyTranslation);
    panel
      .querySelector(".stx-language-select")
      .addEventListener("change", handleLanguageChange);

    return panel;
  }

  function getSelectionSnapshot(forcedText = "") {
    const selection = window.getSelection();
    const text = String(forcedText || selection?.toString() || "").trim();

    if (!text) {
      return null;
    }

    let rect = null;

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      rect = getUsefulRect(range);
    }

    return {
      text,
      rect: rect || getCenteredRect(),
    };
  }

  function getUsefulRect(range) {
    const rects = [...range.getClientRects()].filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );

    if (rects.length > 0) {
      return rects[rects.length - 1];
    }

    const rect = range.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 ? rect : null;
  }

  function getCenteredRect() {
    return {
      left: window.innerWidth / 2 - 80,
      right: window.innerWidth / 2 + 80,
      top: window.innerHeight / 2 - 20,
      bottom: window.innerHeight / 2 + 20,
      width: 160,
      height: 40,
    };
  }

  async function updateSelectionFromPage() {
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

  function showToolbar(rect) {
    const nextToolbar = ensureToolbar();
    nextToolbar.classList.remove(HIDDEN_CLASS);
    setButtonEnabled("copy-translation", false);
    positionElement(nextToolbar, rect, "toolbar");
  }

  function showPanel(rect) {
    const nextPanel = ensurePanel();
    nextPanel.classList.remove(HIDDEN_CLASS);
    positionElement(nextPanel, rect, "panel");
  }

  function positionElement(element, rect, mode) {
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

  function setPanelState(kind, text, note = "") {
    const nextPanel = ensurePanel();
    nextPanel.dataset.state = kind;
    nextPanel.querySelector(".stx-panel-text").textContent = text;
    nextPanel.querySelector(".stx-panel-note").textContent = note;
  }

  function setButtonEnabled(action, enabled) {
    const button = toolbar?.querySelector(`[data-action="${action}"]`);
    if (button) {
      button.disabled = !enabled;
    }
  }

  async function handleToolbarAction(action) {
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
    const languageSelect = ensurePanel().querySelector(".stx-language-select");
    languageSelect.value = settings.targetLanguage || DEFAULT_SETTINGS.targetLanguage;

    const result = await sendMessage({
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
    setPanelState(
      "ready",
      result.translatedText,
      result.wasTrimmed ? "Текст был обрезан по лимиту из настроек." : "",
    );
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

  async function copyText(text) {
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

  function flashToolbar(message) {
    const translateButton = toolbar?.querySelector('[data-action="translate"]');
    if (!translateButton) {
      return;
    }

    const previous = translateButton.textContent;
    translateButton.textContent = message;
    setTimeout(() => {
      translateButton.textContent = previous;
    }, 900);
  }

  function flashPanel(message) {
    const note = panel?.querySelector(".stx-panel-note");
    if (!note) {
      return;
    }

    const previous = note.textContent;
    note.textContent = message;
    setTimeout(() => {
      note.textContent = previous;
    }, 1200);
  }

  async function handleLanguageChange(event) {
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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ST_CONTEXT_TRANSLATE") {
      void openTranslationPanel(message.text || "");
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "ST_CONTEXT_COPY_SELECTION") {
      void copySelectedText(message.text || "");
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  document.addEventListener("selectionchange", scheduleSelectionUpdate);
  document.addEventListener("mouseup", scheduleSelectionUpdate);
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") {
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

      cachedSettings = {
        ...cachedSettings,
        ...Object.fromEntries(
          Object.entries(changes).map(([key, change]) => [key, change.newValue]),
        ),
      };

      if (changes?.targetLanguage && panel && !panel.classList.contains(HIDDEN_CLASS)) {
        const languageSelect = panel.querySelector(".stx-language-select");
        languageSelect.value = cachedSettings.targetLanguage;
      }
    });
  }

  void refreshSettings();
})();
