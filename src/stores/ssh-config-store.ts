import { createStore } from "solid-js/store";
import { sshLoadSystemConfig, type SshConfigEntry } from "../ipc/ssh-config-commands";

interface SshConfigState {
  hosts: SshConfigEntry[];
  loaded: boolean;
  loading: boolean;
  error: string | null;
  searchQuery: string;
}

const [state, setState] = createStore<SshConfigState>({
  hosts: [],
  loaded: false,
  loading: false,
  error: null,
  searchQuery: "",
});

export function useSshConfigStore() {
  const load = async () => {
    if (state.loading) return;
    setState("loading", true);
    setState("error", null);
    try {
      const hosts = await sshLoadSystemConfig();
      setState("hosts", hosts);
      setState("loaded", true);
    } catch (e: any) {
      setState("error", e.toString());
    } finally {
      setState("loading", false);
    }
  };

  const setSearchQuery = (query: string) => {
    setState("searchQuery", query);
  };

  const filteredHosts = (): SshConfigEntry[] => {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) return state.hosts;
    return state.hosts.filter(
      (h) =>
        h.host_alias.toLowerCase().includes(query) ||
        (h.host_name?.toLowerCase().includes(query) ?? false) ||
        (h.user?.toLowerCase().includes(query) ?? false)
    );
  };

  return { state, load, setSearchQuery, filteredHosts };
}
