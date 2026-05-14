import { createSignal, onMount, Show, For } from "solid-js";
import { configLoad, configSave, type Theme } from "../../ipc/commands";
import { useColorThemeStore } from "../../stores/color-theme-store";
import type { TerminalColorTheme } from "../../ipc/color-theme-commands";
import { open } from "@tauri-apps/plugin-dialog";

export function AppearanceSettings() {
  const [theme, setTheme] = createSignal<Theme>("Dark");
  const colorThemeStore = useColorThemeStore();
  const [editingTheme, setEditingTheme] = createSignal<TerminalColorTheme | null>(null);
  const [showEditor, setShowEditor] = createSignal(false);

  onMount(async () => {
    try {
      const config = await configLoad();
      setTheme(config.theme);
      colorThemeStore.setActiveThemeId(config.terminal_color_theme);
      await colorThemeStore.load();
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  });

  const changeTheme = async (t: Theme) => {
    setTheme(t);
    let effective = t;
    if (t === "System") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
    }
    document.documentElement.setAttribute("data-theme", effective.toLowerCase());
    try {
      const config = await configLoad();
      config.theme = t;
      await configSave(config);
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  const selectColorTheme = async (id: string) => {
    colorThemeStore.selectTheme(id);
    try {
      const config = await configLoad();
      config.terminal_color_theme = id;
      await configSave(config);
    } catch (e) {
      console.error("Failed to save color theme:", e);
    }
  };

  const handleImportIterm2 = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "iTerm2 Color Schemes", extensions: ["itermcolors"] }],
      });
      if (!selected) return;
      const filePath = typeof selected === "string" ? selected : selected;
      const imported = await colorThemeStore.importIterm2(filePath);
      await selectColorTheme(imported.id);
    } catch (e) {
      console.error("Failed to import iTerm2 theme:", e);
    }
  };

  const handleNewTheme = () => {
    const newTheme: TerminalColorTheme = {
      id: `custom:${crypto.randomUUID()}`,
      name: "New Theme",
      source: "custom",
      background: "#1a1b26",
      foreground: "#c0caf5",
      cursor: "#c0caf5",
      selection_background: "#33467c",
      black: "#15161e",
      red: "#f7768e",
      green: "#9ece6a",
      yellow: "#e0af68",
      blue: "#7aa2f7",
      magenta: "#bb9af7",
      cyan: "#7dcfff",
      white: "#a9b1d6",
      bright_black: "#414868",
      bright_red: "#f7768e",
      bright_green: "#9ece6a",
      bright_yellow: "#e0af68",
      bright_blue: "#7aa2f7",
      bright_magenta: "#bb9af7",
      bright_cyan: "#7dcfff",
      bright_white: "#c0caf5",
    };
    setEditingTheme(newTheme);
    setShowEditor(true);
  };

  const handleEditTheme = (t: TerminalColorTheme) => {
    setEditingTheme({ ...t });
    setShowEditor(true);
  };

  const handleSaveTheme = async () => {
    const t = editingTheme();
    if (!t) return;
    await colorThemeStore.saveTheme(t);
    setShowEditor(false);
    setEditingTheme(null);
    await selectColorTheme(t.id);
  };

  const handleDeleteTheme = async (id: string) => {
    await colorThemeStore.removeTheme(id);
    // Re-read active from config
    try {
      const config = await configLoad();
      colorThemeStore.setActiveThemeId(config.terminal_color_theme);
    } catch (e) {
      console.error("Failed to reload config:", e);
    }
  };

  const themes: { id: Theme; label: string; desc: string }[] = [
    { id: "Dark", label: "Tokyo Night Dark", desc: "Default dark theme" },
    { id: "Light", label: "Tokyo Night Light", desc: "Default light theme" },
    { id: "System", label: "System", desc: "Follow OS setting" },
  ];

  const colorFields: { key: keyof TerminalColorTheme; label: string }[] = [
    { key: "background", label: "Background" },
    { key: "foreground", label: "Foreground" },
    { key: "cursor", label: "Cursor" },
    { key: "selection_background", label: "Selection" },
    { key: "black", label: "Black" },
    { key: "red", label: "Red" },
    { key: "green", label: "Green" },
    { key: "yellow", label: "Yellow" },
    { key: "blue", label: "Blue" },
    { key: "magenta", label: "Magenta" },
    { key: "cyan", label: "Cyan" },
    { key: "white", label: "White" },
    { key: "bright_black", label: "Bright Black" },
    { key: "bright_red", label: "Bright Red" },
    { key: "bright_green", label: "Bright Green" },
    { key: "bright_yellow", label: "Bright Yellow" },
    { key: "bright_blue", label: "Bright Blue" },
    { key: "bright_magenta", label: "Bright Magenta" },
    { key: "bright_cyan", label: "Bright Cyan" },
    { key: "bright_white", label: "Bright White" },
  ];

  const updateEditColor = (key: keyof TerminalColorTheme, value: string) => {
    const t = editingTheme();
    if (!t) return;
    setEditingTheme({ ...t, [key]: value });
  };

  const updateEditName = (name: string) => {
    const t = editingTheme();
    if (!t) return;
    setEditingTheme({ ...t, name });
  };

  const renderSwatches = (t: TerminalColorTheme) => {
    const colors = [t.black, t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan, t.white];
    return (
      <div class="appearance__color-swatches">
        <For each={colors}>
          {(c) => <span class="appearance__color-swatch" style={{ background: c }} />}
        </For>
      </div>
    );
  };

  return (
    <div>
      {/* Section: UI Theme (Dark/Light/System) */}
      <div class="settings__section">
        <h3 class="settings__section-title">Theme</h3>
        <div class="appearance__theme-list">
          {themes.map((t) => (
            <div
              class={`appearance__theme-card ${theme() === t.id ? "appearance__theme-card--active" : ""}`}
              onClick={() => changeTheme(t.id)}
            >
              <div class={`appearance__theme-preview appearance__theme-preview--${t.id.toLowerCase()}`} />
              <div class="appearance__theme-info">
                <span class="appearance__theme-name">{t.label}</span>
                <span class="appearance__theme-desc">{t.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Terminal Colors */}
      <div class="settings__section">
        <h3 class="settings__section-title">Terminal Colors</h3>

        <Show
          when={!showEditor()}
          fallback={
            <div class="appearance__color-editor">
              <div class="settings__field">
                <label>Theme Name</label>
                <input
                  type="text"
                  value={editingTheme()?.name ?? ""}
                  onInput={(e) => updateEditName(e.currentTarget.value)}
                />
              </div>
              <div class="appearance__color-editor-grid">
                <For each={colorFields}>
                  {(field) => (
                    <div class="appearance__color-editor-item">
                      <label>{field.label}</label>
                      <div class="appearance__color-editor-input">
                        <input
                          type="color"
                          value={editingTheme()?.[field.key] ?? "#000000"}
                          onInput={(e) => updateEditColor(field.key, e.currentTarget.value)}
                        />
                        <span class="appearance__color-editor-hex">
                          {editingTheme()?.[field.key] ?? "#000000"}
                        </span>
                      </div>
                    </div>
                  )}
                </For>
              </div>
              <div class="appearance__color-editor-actions">
                <button class="appearance__btn appearance__btn--primary" onClick={handleSaveTheme}>
                  Save Theme
                </button>
                <button
                  class="appearance__btn"
                  onClick={() => {
                    setShowEditor(false);
                    setEditingTheme(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          }
        >
          <>
            <div class="appearance__color-theme-list">
              <For each={colorThemeStore.allThemes()}>
                {(t) => (
                  <div
                    class={`appearance__theme-card ${colorThemeStore.state.activeThemeId === t.id ? "appearance__theme-card--active" : ""}`}
                    onClick={() => selectColorTheme(t.id)}
                  >
                    <div
                      class="appearance__color-theme-preview"
                      style={{ background: t.background }}
                    />
                    <div class="appearance__theme-info">
                      <span class="appearance__theme-name">{t.name}</span>
                      <span class="appearance__theme-desc">
                        {t.source === "builtin" ? "Built-in" : t.source === "iterm2" ? "iTerm2" : "Custom"}
                      </span>
                      {renderSwatches(t)}
                    </div>
                    <Show when={t.source !== "builtin"}>
                      <div class="appearance__color-theme-actions">
                        <button
                          class="appearance__icon-btn"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTheme(t);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          class="appearance__icon-btn appearance__icon-btn--danger"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTheme(t.id);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </Show>
                  </div>
                )}
              </For>
            </div>
            <div class="appearance__color-theme-actions-bar">
              <button class="appearance__btn" onClick={handleImportIterm2}>
                Import iTerm2 Theme...
              </button>
              <button class="appearance__btn appearance__btn--primary" onClick={handleNewTheme}>
                New Theme
              </button>
            </div>
          </>
        </Show>
      </div>
    </div>
  );
}
