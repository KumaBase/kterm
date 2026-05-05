import { invoke } from "@tauri-apps/api/core";

export interface TmuxSession {
  name: string;
  windows: number;
  created: number;
  attached: boolean;
}

export interface TmuxWindow {
  index: number;
  name: string;
  active: boolean;
}

export interface TmuxInfo {
  installed: boolean;
  double_tmux: boolean;
  sessions: TmuxSession[];
}

export async function tmuxLocalInfo(): Promise<TmuxInfo> {
  return invoke("tmux_local_info");
}

export async function tmuxLocalSessions(): Promise<TmuxSession[]> {
  return invoke("tmux_local_sessions");
}

export async function tmuxLocalWindows(session: string): Promise<TmuxWindow[]> {
  return invoke("tmux_local_windows", { session });
}

export async function tmuxLocalCreate(name: string): Promise<void> {
  return invoke("tmux_local_create", { name });
}

export async function tmuxLocalKill(session: string): Promise<void> {
  return invoke("tmux_local_kill", { session });
}

export async function tmuxLocalDetach(session: string): Promise<void> {
  return invoke("tmux_local_detach", { session });
}

export async function tmuxLocalNewWindow(session: string): Promise<void> {
  return invoke("tmux_local_new_window", { session });
}

export async function tmuxLocalKillWindow(session: string, windowIndex: number): Promise<void> {
  return invoke("tmux_local_kill_window", { session, windowIndex });
}

export async function tmuxLocalRenameWindow(session: string, windowIndex: number, name: string): Promise<void> {
  return invoke("tmux_local_rename_window", { session, windowIndex, name });
}

export async function tmuxLocalSelectWindow(session: string, windowIndex: number): Promise<void> {
  return invoke("tmux_local_select_window", { session, windowIndex });
}

export async function tmuxRemoteExec(
  sessionId: string,
  command: string
): Promise<string> {
  return invoke("tmux_remote_exec", { sessionId, command });
}

export async function tmuxSessionAttach(
  sessionId: string,
  tmuxSession: string
): Promise<void> {
  return invoke("tmux_session_attach", { sessionId, tmuxSession });
}

export async function tmuxSessionSwitch(
  sessionId: string,
  tmuxSession: string
): Promise<void> {
  return invoke("tmux_session_switch", { sessionId, tmuxSession });
}
