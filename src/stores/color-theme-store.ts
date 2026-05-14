import { createStore } from "solid-js/store";
import { createMemo } from "solid-js";
import type { ITheme } from "@xterm/xterm";
import {
  colorThemesLoad,
  colorThemeSave,
  colorThemeDelete as deleteTheme,
  importItermcolors,
} from "../ipc/color-theme-commands";
import type { TerminalColorTheme } from "../ipc/color-theme-commands";
import { BUILT_IN_THEMES } from "../themes/terminal-themes";

interface ColorThemeState {
  customThemes: TerminalColorTheme[];
  activeThemeId: string;
  loaded: boolean;
}

const [state, setState] = createStore<ColorThemeState>({
  customThemes: [],
  activeThemeId: "builtin:tokyo-night-dark",
  loaded: false,
});

function themeToITheme(theme: TerminalColorTheme): ITheme {
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selectionBackground: theme.selection_background,
    black: theme.black,
    red: theme.red,
    green: theme.green,
    yellow: theme.yellow,
    blue: theme.blue,
    magenta: theme.magenta,
    cyan: theme.cyan,
    white: theme.white,
    brightBlack: theme.bright_black,
    brightRed: theme.bright_red,
    brightGreen: theme.bright_green,
    brightYellow: theme.bright_yellow,
    brightBlue: theme.bright_blue,
    brightMagenta: theme.bright_magenta,
    brightCyan: theme.bright_cyan,
    brightWhite: theme.bright_white,
  };
}

export function useColorThemeStore() {
  const load = async () => {
    const config = await colorThemesLoad();
    setState("customThemes", config.themes);
    setState("loaded", true);
  };

  const setActiveThemeId = (id: string) => {
    setState("activeThemeId", id);
  };

  const allThemes = createMemo((): TerminalColorTheme[] => {
    return [...BUILT_IN_THEMES, ...state.customThemes];
  });

  const activeXtermTheme = createMemo((): ITheme => {
    const theme = allThemes().find((t) => t.id === state.activeThemeId);
    if (!theme) {
      return themeToITheme(BUILT_IN_THEMES[0]);
    }
    return themeToITheme(theme);
  });

  const activeBackground = createMemo((): string => {
    const theme = allThemes().find((t) => t.id === state.activeThemeId);
    return theme?.background ?? "#1a1b26";
  });

  const selectTheme = (id: string) => {
    setState("activeThemeId", id);
  };

  const saveTheme = async (theme: TerminalColorTheme) => {
    await colorThemeSave(theme);
    const idx = state.customThemes.findIndex((t) => t.id === theme.id);
    if (idx >= 0) {
      setState("customThemes", idx, theme);
    } else {
      setState("customThemes", (prev) => [...prev, theme]);
    }
  };

  const removeTheme = async (id: string) => {
    await deleteTheme(id);
    setState("customThemes", (prev) => prev.filter((t) => t.id !== id));
    if (state.activeThemeId === id) {
      setState("activeThemeId", "builtin:tokyo-night-dark");
    }
  };

  const importIterm2 = async (filePath: string): Promise<TerminalColorTheme> => {
    const theme = await importItermcolors(filePath);
    setState("customThemes", (prev) => [...prev, theme]);
    return theme;
  };

  return {
    state,
    load,
    setActiveThemeId,
    allThemes,
    activeXtermTheme,
    activeBackground,
    selectTheme,
    saveTheme,
    removeTheme,
    importIterm2,
  };
}
