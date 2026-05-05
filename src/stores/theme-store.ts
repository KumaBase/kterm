import { createSignal } from "solid-js";
import { configLoad, configSave } from "../ipc/commands";
import type { Theme } from "../ipc/commands";

const [theme, setTheme] = createSignal<Theme>("Dark");

export function useThemeStore() {
  const applyTheme = (t: Theme) => {
    let effective = t;
    if (t === "System") {
      effective = window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light";
    }
    document.documentElement.setAttribute("data-theme", effective.toLowerCase());
  };

  const initTheme = async () => {
    try {
      const config = await configLoad();
      const saved = config.theme;
      setTheme(saved);
      applyTheme(saved);
    } catch {
      applyTheme("Dark");
    }
  };

  const changeTheme = async (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      const config = await configLoad();
      config.theme = t;
      await configSave(config);
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  return { theme, initTheme, changeTheme };
}
