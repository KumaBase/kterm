import { invoke } from "@tauri-apps/api/core";

export interface SshAuthMethod {
  type: "Password" | "PrivateKey" | "Agent";
  password?: string;
  key_path?: string;
  passphrase?: string | null;
}

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  auth: SshAuthMethod;
  last_connected?: string;
}

export async function sshConnect(
  host: string,
  port: number,
  user: string,
  auth: SshAuthMethod,
  cols: number = 80,
  rows: number = 24
): Promise<any> {
  return invoke("ssh_connect", { host, port, user, auth, cols, rows });
}

export async function sshDisconnect(sessionId: string): Promise<void> {
  return invoke("ssh_disconnect", { sessionId });
}

export async function sshLoadProfiles(): Promise<SshProfile[]> {
  return invoke("ssh_load_profiles");
}

export async function sshSaveProfiles(profiles: SshProfile[]): Promise<void> {
  return invoke("ssh_save_profiles", { profiles });
}
