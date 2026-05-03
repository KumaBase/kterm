import { createStore } from "solid-js/store";

interface UiState {
  sidebarVisible: boolean;
  settingsOpen: boolean;
  quickConnectOpen: boolean;
}

const [state, setState] = createStore<UiState>({
  sidebarVisible: true,
  settingsOpen: false,
  quickConnectOpen: false,
});

export function useUiStore() {
  const toggleSidebar = () => setState("sidebarVisible", (v) => !v);
  const showSettings = () => setState("settingsOpen", true);
  const hideSettings = () => setState("settingsOpen", false);
  const showQuickConnect = () => setState("quickConnectOpen", true);
  const hideQuickConnect = () => setState("quickConnectOpen", false);

  return {
    state,
    toggleSidebar,
    showSettings,
    hideSettings,
    showQuickConnect,
    hideQuickConnect,
  };
}
