import type { ITheme } from "@xterm/xterm";

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

export function getTerminalTheme(effectiveTheme: "dark" | "light"): ITheme {
  return effectiveTheme === "light" ? TOKYO_NIGHT_LIGHT : TOKYO_NIGHT_DARK;
}

export function getTerminalBackground(effectiveTheme: "dark" | "light"): string {
  return effectiveTheme === "light"
    ? TOKYO_NIGHT_LIGHT.background!
    : TOKYO_NIGHT_DARK.background!;
}
