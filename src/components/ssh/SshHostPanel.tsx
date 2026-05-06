import { For, Show, onMount } from "solid-js";
import { useSshConfigStore } from "../../stores/ssh-config-store";
import type { SshConfigEntry } from "../../ipc/ssh-config-commands";
import "./SshHostPanel.css";

interface SshHostPanelProps {
  onConnect: (entry: SshConfigEntry) => void;
}

export function SshHostPanel(props: SshHostPanelProps) {
  const store = useSshConfigStore();

  onMount(() => {
    if (!store.state.loaded) {
      store.load();
    }
  });

  const handleDoubleClick = (entry: SshConfigEntry) => {
    props.onConnect(entry);
  };

  return (
    <div class="ssh-host-panel">
      <div class="ssh-host-panel__search">
        <input
          class="ssh-host-panel__search-input"
          type="text"
          placeholder="Search hosts..."
          value={store.state.searchQuery}
          onInput={(e) => store.setSearchQuery(e.currentTarget.value)}
        />
      </div>
      <div class="ssh-host-panel__list">
        <Show when={store.state.loading}>
          <div class="ssh-host-panel__empty">Loading hosts...</div>
        </Show>
        <Show when={!store.state.loading && store.state.error}>
          <div class="ssh-host-panel__empty ssh-host-panel__empty--error">
            {store.state.error}
          </div>
        </Show>
        <Show when={!store.state.loading && !store.state.error}>
          <For each={store.filteredHosts()}>
            {(entry) => (
              <div
                class="ssh-host-panel__item"
                onDblClick={() => handleDoubleClick(entry)}
                title="Double-click to connect"
              >
                <div class="ssh-host-panel__item-alias">{entry.host_alias}</div>
                <Show when={entry.host_name && entry.host_name !== entry.host_alias}>
                  <div class="ssh-host-panel__item-hostname">{entry.host_name}</div>
                </Show>
                <div class="ssh-host-panel__item-tags">
                  <Show when={entry.user}>
                    <span class="ssh-host-panel__tag">{entry.user}@</span>
                  </Show>
                  <Show when={entry.port !== 22}>
                    <span class="ssh-host-panel__tag">:{entry.port}</span>
                  </Show>
                  <Show when={entry.identity_file}>
                    <span class="ssh-host-panel__tag ssh-host-panel__tag--key">key</span>
                  </Show>
                </div>
              </div>
            )}
          </For>
          <Show when={store.filteredHosts().length === 0}>
            <div class="ssh-host-panel__empty">
              {store.state.searchQuery ? "No matching hosts" : "No hosts found in ~/.ssh/config"}
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
