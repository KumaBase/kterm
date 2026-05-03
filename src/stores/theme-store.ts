import { createSignal } from "solid-js";

type Theme = "Dark" | "Light" | "System";

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
    // TODO: Replace with actual configLoad/configSave when IPC commands are available
    try {
      applyTheme("Dark");
    } catch {
      applyTheme("Dark");
    }
  };

  const changeTheme = async (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    // TODO: Persist theme via configSave when IPC commands are available
    try {
      // Placeholder for config persistence
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  return { theme, initTheme, changeTheme };
}
