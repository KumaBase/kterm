import { invoke } from "@tauri-apps/api/core";

export interface ShellProfile {
  id: string;
  name: string;
  shell: string;
  args: string[];
  cwd: string | null;
  env: [string, string][];
}

export interface ShellProfilesConfig {
  profiles: ShellProfile[];
  default_profile_id: string | null;
}

export async function shellProfilesLoad(): Promise<ShellProfilesConfig> {
  return invoke("shell_profiles_load");
}

export async function shellProfilesSave(config: ShellProfilesConfig): Promise<void> {
  return invoke("shell_profiles_save", { config });
}

export async function shellProfileCreate(
  name: string,
  shell: string,
  args: string[],
  cwd: string | null,
  env: [string, string][]
): Promise<ShellProfile> {
  return invoke("shell_profile_create", { name, shell, args, cwd, env });
}

export async function shellProfileUpdate(
  id: string,
  name: string,
  shell: string,
  args: string[],
  cwd: string | null,
  env: [string, string][]
): Promise<ShellProfile> {
  return invoke("shell_profile_update", { id, name, shell, args, cwd, env });
}

export async function shellProfileDelete(id: string): Promise<void> {
  return invoke("shell_profile_delete", { id });
}

export async function shellProfileSetDefault(id: string): Promise<void> {
  return invoke("shell_profile_set_default", { id });
}

export async function shellDetectAvailable(): Promise<string[]> {
  return invoke("shell_detect_available");
}
