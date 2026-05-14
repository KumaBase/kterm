import { invoke } from "@tauri-apps/api/core";

export interface TerminalColorTheme {
  id: string;
  name: string;
  source: string;
  background: string;
  foreground: string;
  cursor: string;
  selection_background: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  bright_black: string;
  bright_red: string;
  bright_green: string;
  bright_yellow: string;
  bright_blue: string;
  bright_magenta: string;
  bright_cyan: string;
  bright_white: string;
}

export interface ColorThemesConfig {
  themes: TerminalColorTheme[];
}

export async function colorThemesLoad(): Promise<ColorThemesConfig> {
  return invoke("color_themes_load");
}

export async function colorThemeSave(theme: TerminalColorTheme): Promise<void> {
  return invoke("color_theme_save", { theme });
}

export async function colorThemeDelete(id: string): Promise<void> {
  return invoke("color_theme_delete", { id });
}

export async function importItermcolors(filePath: string): Promise<TerminalColorTheme> {
  return invoke("import_itermcolors", { filePath });
}
