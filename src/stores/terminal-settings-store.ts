import { createSignal } from "solid-js";
import { configLoad } from "../ipc/commands";
import type { TerminalSettings } from "../ipc/commands";

const defaultSettings: TerminalSettings = {
  font_family: "'JetBrainsMono Nerd Font', 'JetBrains Mono', Menlo, 'Hiragino Sans', monospace",
  font_size: 14,
  scrollback: 10000,
  cursor_style: "block",
  cursor_blink: true,
  line_height: 1.2,
  letter_spacing: 0,
  padding: 8,
  copy_on_select: false,
};

const [settings, setSettings] = createSignal<TerminalSettings>(defaultSettings);

export async function loadTerminalSettings() {
  try {
    const config = await configLoad();
    setSettings(config.terminal);
  } catch (e) {
    console.error("Failed to load terminal settings:", e);
  }
}

export function updateTerminalSettings(newSettings: TerminalSettings) {
  setSettings(newSettings);
}

export function useTerminalSettingsStore() {
  return { settings };
}
