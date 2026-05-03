import { createStore } from "solid-js/store";
import {
  snippetsLoad,
  snippetCreate as createSnippet,
  snippetUpdate as updateSnippet,
  snippetDelete as deleteSnippet,
} from "../ipc/snippet-commands";
import type { Snippet } from "../ipc/snippet-commands";

interface SnippetState {
  snippets: Snippet[];
  searchQuery: string;
  loaded: boolean;
}

const [state, setState] = createStore<SnippetState>({
  snippets: [],
  searchQuery: "",
  loaded: false,
});

export function useSnippetStore() {
  const load = async () => {
    const config = await snippetsLoad();
    setState("snippets", config.snippets);
    setState("loaded", true);
  };

  const setSearchQuery = (query: string) => {
    setState("searchQuery", query);
  };

  const filteredSnippets = () => {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) return state.snippets;
    return state.snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query))
    );
  };

  const addSnippet = async (name: string, content: string, tags: string[]) => {
    const snippet = await createSnippet(name, content, tags);
    setState("snippets", (prev) => [...prev, snippet]);
  };

  const editSnippet = async (
    id: string,
    name: string,
    content: string,
    tags: string[]
  ) => {
    const updated = await updateSnippet(id, name, content, tags);
    setState("snippets", (prev) =>
      prev.map((s) => (s.id === id ? updated : s))
    );
  };

  const removeSnippet = async (id: string) => {
    await deleteSnippet(id);
    setState("snippets", (prev) => prev.filter((s) => s.id !== id));
  };

  const getSnippet = (id: string) => state.snippets.find((s) => s.id === id);

  return {
    state,
    load,
    setSearchQuery,
    filteredSnippets,
    addSnippet,
    editSnippet,
    removeSnippet,
    getSnippet,
  };
}
