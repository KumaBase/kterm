import { createSignal, onMount } from "solid-js";
import { configLoad, configSave, type Theme } from "../../ipc/commands";

export function AppearanceSettings() {
  const [theme, setTheme] = createSignal<Theme>("Dark");

  onMount(async () => {
    try {
      const config = await configLoad();
      setTheme(config.theme);
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

  const themes: { id: Theme; label: string; desc: string }[] = [
    { id: "Dark", label: "Tokyo Night Dark", desc: "Default dark theme" },
    { id: "Light", label: "Tokyo Night Light", desc: "Default light theme" },
    { id: "System", label: "System", desc: "Follow OS setting" },
  ];

  return (
    <div>
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
    </div>
  );
}
