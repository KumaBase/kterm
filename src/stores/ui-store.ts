import { createStore } from "solid-js/store";

export type RightSidebarTab = "snippets";

interface UiState {
  sidebarVisible: boolean;
  rightSidebarVisible: boolean;
  rightSidebarTab: RightSidebarTab;
  settingsOpen: boolean;
  quickConnectOpen: boolean;
}

const [state, setState] = createStore<UiState>({
  sidebarVisible: true,
  rightSidebarVisible: false,
  rightSidebarTab: "snippets",
  settingsOpen: false,
  quickConnectOpen: false,
});

export function useUiStore() {
  const toggleSidebar = () => setState("sidebarVisible", (v) => !v);
  const toggleRightSidebar = () => setState("rightSidebarVisible", (v) => !v);
  const showSnippets = () => {
    setState("rightSidebarTab", "snippets");
    if (!state.rightSidebarVisible) setState("rightSidebarVisible", true);
  };
  const showSettings = () => setState("settingsOpen", true);
  const hideSettings = () => setState("settingsOpen", false);
  const showQuickConnect = () => setState("quickConnectOpen", true);
  const hideQuickConnect = () => setState("quickConnectOpen", false);

  return {
    state,
    toggleSidebar,
    toggleRightSidebar,
    showSnippets,
    showSettings,
    hideSettings,
    showQuickConnect,
    hideQuickConnect,
  };
}
