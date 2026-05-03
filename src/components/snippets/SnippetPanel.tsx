import { For, Show, createSignal, onMount } from "solid-js";
import { useSnippetStore } from "../../stores/snippet-store";
import { useSessionStore } from "../../stores/session-store";
import { sessionWrite } from "../../ipc/commands";
import { SnippetForm } from "./SnippetForm";
import { VariableDialog } from "./VariableDialog";
import type { Snippet } from "../../ipc/snippet-commands";
import "./SnippetPanel.css";

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_REGEX.source, VARIABLE_REGEX.flags);
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return Array.from(vars);
}

function expandVariables(content: string, values: Record<string, string>): string {
  return content.replace(VARIABLE_REGEX, (_, name) => values[name] ?? `{{${name}}}`);
}

export function SnippetPanel() {
  const snippetStore = useSnippetStore();
  const sessionStore = useSessionStore();

  const [formOpen, setFormOpen] = createSignal(false);
  const [editingSnippet, setEditingSnippet] = createSignal<Snippet | undefined>();
  const [varDialogOpen, setVarDialogOpen] = createSignal(false);
  const [pendingSnippet, setPendingSnippet] = createSignal<Snippet | null>(null);

  onMount(() => {
    if (!snippetStore.state.loaded) {
      snippetStore.load();
    }
  });

  const handleInsert = (snippet: Snippet) => {
    const variables = extractVariables(snippet.content);
    if (variables.length > 0) {
      setPendingSnippet(snippet);
      setVarDialogOpen(true);
    } else {
      writeToTerminal(snippet.content);
    }
  };

  const handleVarSubmit = (values: Record<string, string>) => {
    setVarDialogOpen(false);
    const snippet = pendingSnippet();
    if (snippet) {
      const expanded = expandVariables(snippet.content, values);
      writeToTerminal(expanded);
    }
    setPendingSnippet(null);
  };

  const writeToTerminal = (text: string) => {
    const sessionId = sessionStore.state.activeSessionId;
    if (!sessionId) return;
    sessionWrite(sessionId, text);
  };

  const handleSave = async (name: string, content: string, tags: string[]) => {
    const editing = editingSnippet();
    if (editing) {
      await snippetStore.editSnippet(editing.id, name, content, tags);
    } else {
      await snippetStore.addSnippet(name, content, tags);
    }
    setFormOpen(false);
    setEditingSnippet(undefined);
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    await snippetStore.removeSnippet(id);
  };

  const handleAddNew = () => {
    setEditingSnippet(undefined);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSnippet(undefined);
  };

  return (
    <div class="snippet-panel">
      <div class="snippet-panel__search">
        <input
          class="snippet-panel__search-input"
          type="text"
          placeholder="Search snippets..."
          value={snippetStore.state.searchQuery}
          onInput={(e) => snippetStore.setSearchQuery(e.currentTarget.value)}
        />
      </div>
      <div class="snippet-panel__list">
        <For each={snippetStore.filteredSnippets()}>
          {(snippet) => (
            <div class="snippet-panel__item" onClick={() => handleInsert(snippet)}>
              <div class="snippet-panel__item-name">{snippet.name}</div>
              <div class="snippet-panel__item-content">{snippet.content}</div>
              <Show when={snippet.tags.length > 0}>
                <div class="snippet-panel__item-tags">
                  <For each={snippet.tags}>
                    {(tag) => <span class="snippet-panel__tag">{tag}</span>}
                  </For>
                </div>
              </Show>
              <div class="snippet-panel__item-actions">
                <button
                  class="snippet-panel__action-btn"
                  onClick={(e) => { e.stopPropagation(); handleEdit(snippet); }}
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  class="snippet-panel__action-btn snippet-panel__action-btn--danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(snippet.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </For>
        <Show when={snippetStore.filteredSnippets().length === 0}>
          <div class="snippet-panel__empty">
            {snippetStore.state.searchQuery ? "No matching snippets" : "No snippets yet"}
          </div>
        </Show>
      </div>
      <div class="snippet-panel__footer">
        <button class="snippet-panel__add-btn" onClick={handleAddNew}>
          + Add Snippet
        </button>
      </div>
      <SnippetForm
        open={formOpen()}
        snippet={editingSnippet()}
        onSave={handleSave}
        onClose={closeForm}
      />
      <VariableDialog
        open={varDialogOpen()}
        variables={pendingSnippet() ? extractVariables(pendingSnippet()!.content) : []}
        onSubmit={handleVarSubmit}
        onCancel={() => { setVarDialogOpen(false); setPendingSnippet(null); }}
      />
    </div>
  );
}
