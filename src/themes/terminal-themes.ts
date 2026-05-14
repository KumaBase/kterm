import type { ITheme } from "@xterm/xterm";
import type { TerminalColorTheme } from "../ipc/color-theme-commands";

const TOKYO_NIGHT_DARK: ITheme = {
  background: "#1a1b26",
  foreground: "#c0caf5",
  cursor: "#c0caf5",
  selectionBackground: "#33467c",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#a9b1d6",
  brightBlack: "#414868",
  brightRed: "#f7768e",
  brightGreen: "#9ece6a",
  brightYellow: "#e0af68",
  brightBlue: "#7aa2f7",
  brightMagenta: "#bb9af7",
  brightCyan: "#7dcfff",
  brightWhite: "#c0caf5",
};

const TOKYO_NIGHT_LIGHT: ITheme = {
  background: "#e1e2e7",
  foreground: "#3760bf",
  cursor: "#3760bf",
  selectionBackground: "#99a7df",
  black: "#e1e2e7",
  red: "#f52a65",
  green: "#587539",
  yellow: "#8c6c3e",
  blue: "#2e7de9",
  magenta: "#9854f1",
  cyan: "#007197",
  white: "#6172b0",
  brightBlack: "#a1a6c5",
  brightRed: "#f52a65",
  brightGreen: "#587539",
  brightYellow: "#8c6c3e",
  brightBlue: "#2e7de9",
  brightMagenta: "#9854f1",
  brightCyan: "#007197",
  brightWhite: "#3760bf",
};

// Built-in themes as TerminalColorTheme for unified handling
export const BUILT_IN_THEMES: TerminalColorTheme[] = [
  {
    id: "builtin:tokyo-night-dark",
    name: "Tokyo Night Dark",
    source: "builtin",
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
  },
  {
    id: "builtin:tokyo-night-light",
    name: "Tokyo Night Light",
    source: "builtin",
    background: "#e1e2e7",
    foreground: "#3760bf",
    cursor: "#3760bf",
    selection_background: "#99a7df",
    black: "#e1e2e7",
    red: "#f52a65",
    green: "#587539",
    yellow: "#8c6c3e",
    blue: "#2e7de9",
    magenta: "#9854f1",
    cyan: "#007197",
    white: "#6172b0",
    bright_black: "#a1a6c5",
    bright_red: "#f52a65",
    bright_green: "#587539",
    bright_yellow: "#8c6c3e",
    bright_blue: "#2e7de9",
    bright_magenta: "#9854f1",
    bright_cyan: "#007197",
    bright_white: "#3760bf",
  },
];

// Keep legacy functions for backwards compatibility
export function getTerminalTheme(themeId: string, customThemes?: TerminalColorTheme[]): ITheme {
  const allThemes = [...BUILT_IN_THEMES, ...(customThemes ?? [])];
  const theme = allThemes.find((t) => t.id === themeId);
  if (theme) {
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
  return TOKYO_NIGHT_DARK;
}

export function getTerminalBackground(themeId: string, customThemes?: TerminalColorTheme[]): string {
  const allThemes = [...BUILT_IN_THEMES, ...(customThemes ?? [])];
  const theme = allThemes.find((t) => t.id === themeId);
  return theme?.background ?? "#1a1b26";
}
