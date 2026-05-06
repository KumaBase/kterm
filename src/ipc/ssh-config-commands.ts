import { invoke } from "@tauri-apps/api/core";

export interface SshConfigEntry {
  host_alias: string;
  host_name: string | null;
  user: string | null;
  port: number;
  identity_file: string | null;
}

export async function sshLoadSystemConfig(): Promise<SshConfigEntry[]> {
  return invoke("ssh_load_system_config");
}
