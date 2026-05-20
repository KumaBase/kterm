import { invoke } from "@tauri-apps/api/core";

export interface ZellijSession {
  name: string;
  tabs: number;
  created: string;
  attached: boolean;
}

export interface ZellijTab {
  position: number;
  name: string;
  active: boolean;
}

export interface ZellijInfo {
  installed: boolean;
  sessions: ZellijSession[];
}

export async function zellijLocalInfo(): Promise<ZellijInfo> {
  return invoke("zellij_local_info");
}

export async function zellijLocalSessions(): Promise<ZellijSession[]> {
  return invoke("zellij_local_sessions");
}

export async function zellijLocalTabs(session: string): Promise<ZellijTab[]> {
  return invoke("zellij_local_tabs", { session });
}

export async function zellijLocalCreate(name: string): Promise<void> {
  return invoke("zellij_local_create", { name });
}

export async function zellijLocalKill(session: string): Promise<void> {
  return invoke("zellij_local_kill", { session });
}

export async function zellijLocalNewTab(session: string): Promise<void> {
  return invoke("zellij_local_new_tab", { session });
}

export async function zellijLocalCloseTab(session: string, tabPosition: number): Promise<void> {
  return invoke("zellij_local_close_tab", { session, tabPosition });
}

export async function zellijLocalRenameTab(session: string, tabPosition: number, name: string): Promise<void> {
  return invoke("zellij_local_rename_tab", { session, tabPosition, name });
}

export async function zellijLocalGoToTab(session: string, tabPosition: number): Promise<void> {
  return invoke("zellij_local_go_to_tab", { session, tabPosition });
}

export async function zellijRemoteExec(
  sessionId: string,
  command: string
): Promise<string> {
  return invoke("zellij_remote_exec", { sessionId, command });
}

export async function zellijSessionAttach(
  sessionId: string,
  zellijSession: string
): Promise<void> {
  return invoke("zellij_session_attach", { sessionId, zellijSession });
}
