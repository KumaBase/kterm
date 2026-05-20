import { invoke } from "@tauri-apps/api/core";

export interface SessionInfo {
  id: string;
  kind: SessionKind;
  title: string;
  created_at: string;
}

export type SessionKind =
  | { type: "Pty" }
  | { type: "Ssh"; host: string; port: number; user: string };

export async function ptySpawn(
  shell?: string,
  args?: string[],
  cwd?: string,
  cols: number = 80,
  rows: number = 24,
  env?: [string, string][]
): Promise<SessionInfo> {
  return invoke("pty_spawn", { shell, args, cwd, env, cols, rows });
}

export async function sessionWrite(
  sessionId: string,
  data: string
): Promise<void> {
  return invoke("session_write", { sessionId, data });
}

export async function sessionResize(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  return invoke("session_resize", { sessionId, cols, rows });
}

export async function sessionKill(sessionId: string): Promise<void> {
  return invoke("session_kill", { sessionId });
}

export async function sessionList(): Promise<SessionInfo[]> {
  return invoke("session_list");
}

export async function sessionGetCwd(sessionId: string): Promise<string | null> {
  return invoke("session_get_cwd", { sessionId });
}

export async function configLoad(): Promise<AppConfig> {
  return invoke("config_load");
}

export async function configSave(config: AppConfig): Promise<void> {
  return invoke("config_save", { config });
}

export async function appInfo(): Promise<{ name: string; version: string }> {
  return invoke("app_info");
}

export async function fontList(): Promise<string[]> {
  return invoke("font_list");
}

export interface AppConfig {
  theme: Theme;
  terminal: TerminalSettings;
  window: WindowSettings;
  terminal_color_theme: string;
  tmux_enabled: boolean;
  zellij_enabled: boolean;
}

export type Theme = "Dark" | "Light" | "System";

export interface TerminalSettings {
  font_family: string;
  font_size: number;
  scrollback: number;
  cursor_style: string;
  cursor_blink: boolean;
  line_height: number;
  letter_spacing: number;
  padding: number;
  copy_on_select: boolean;
}

export interface WindowSettings {
  width: number;
  height: number;
  remember_size: boolean;
  remember_position: boolean;
}
