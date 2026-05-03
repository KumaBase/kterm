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
  cwd?: string,
  cols: number = 80,
  rows: number = 24
): Promise<SessionInfo> {
  return invoke("pty_spawn", { shell, cwd, cols, rows });
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

export async function configLoad(): Promise<AppConfig> {
  return invoke("config_load");
}

export async function configSave(config: AppConfig): Promise<void> {
  return invoke("config_save", { config });
}

export async function appInfo(): Promise<{ name: string; version: string }> {
  return invoke("app_info");
}

export interface AppConfig {
  theme: Theme;
  terminal: TerminalSettings;
  window: WindowSettings;
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
}

export interface WindowSettings {
  width: number;
  height: number;
  remember_size: boolean;
  remember_position: boolean;
}
