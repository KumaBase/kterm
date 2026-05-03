import { invoke } from "@tauri-apps/api/core";

export interface Snippet {
  id: string;
  name: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SnippetsConfig {
  snippets: Snippet[];
}

export async function snippetsLoad(): Promise<SnippetsConfig> {
  return invoke("snippets_load");
}

export async function snippetsSave(config: SnippetsConfig): Promise<void> {
  return invoke("snippets_save", { config });
}

export async function snippetCreate(
  name: string,
  content: string,
  tags: string[]
): Promise<Snippet> {
  return invoke("snippet_create", { name, content, tags });
}

export async function snippetUpdate(
  id: string,
  name: string,
  content: string,
  tags: string[]
): Promise<Snippet> {
  return invoke("snippet_update", { id, name, content, tags });
}

export async function snippetDelete(id: string): Promise<void> {
  return invoke("snippet_delete", { id });
}
