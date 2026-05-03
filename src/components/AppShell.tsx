import { onMount, For, Show, createSignal } from "solid-js";
import { ask } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../stores/session-store";
import { useProjectStore } from "../stores/project-store";
import { useUiStore } from "../stores/ui-store";
import { useThemeStore } from "../stores/theme-store";
import { useKeyboard } from "../hooks/use-keyboard";
import { ProjectSidebar } from "./project/ProjectSidebar";
import { SnippetPanel } from "./snippets/SnippetPanel";
import { TerminalContainer } from "./terminal/TerminalContainer";
import { SettingsView } from "./settings/SettingsView";
import { QuickConnect } from "./connection/QuickConnect";
import "./AppShell.css";

export function AppShell() {
  const sessionStore = useSessionStore();
  const projectStore = useProjectStore();
  const uiStore = useUiStore();
  const themeStore = useThemeStore();

  onMount(async () => {
    await themeStore.initTheme();

    // Listen for native menu events
    listen<string>("menu-event", (event) => {
      switch (event.payload) {
        case "settings":
          uiStore.showSettings();
          break;
        case "new_tab":
          handleNewTab();
          break;
        case "close_tab":
          handleCloseActiveTab();
          break;
        case "toggle_sidebar":
          uiStore.toggleSidebar();
          break;
        case "toggle_snippets":
          uiStore.showSnippets();
          break;
      }
    });

    // Listen for SSH host key verification requests
    listen<{ confirmation_id: string; host: string; key: string }>("ssh:host-key-verify", async (event) => {
      const { confirmation_id, host, key } = event.payload;
      const confirmed = await ask(
        `The authenticity of host '${host}' can't be established.\n\nHost key:\n${key}\n\nDo you want to trust this host?`,
        { title: "SSH Host Key Verification", kind: "warning", okLabel: "Trust", cancelLabel: "Reject" },
      );
      invoke("ssh_confirm_host_key", { confirmationId: confirmation_id, confirmed });
    });

    // Try to restore existing sessions from the backend
    const existing = await sessionStore.restoreFromBackend();

    if (existing.length > 0) {
      // Rebuild project/tab structure from surviving backend sessions
      projectStore.clearAll();
      const project = projectStore.createProject("Default Project");
      // Remove the default empty tab
      projectStore.removeTab(project.id, project.tabs[0].id);
      // Create one tab per surviving session
      for (const session of existing) {
        const tab = projectStore.addTab(project.id, session.title);
        projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, session.id);
      }
    } else {
      // Fresh start — no surviving sessions
      projectStore.clearAll();
      const project = projectStore.createProject("Default Project");
      const session = await sessionStore.createSession();
      projectStore.setPaneSession(project.id, project.tabs[0].id, project.tabs[0].rootPane.id, session.id);
    }
  });

  useKeyboard({
    "CmdOrCtrl+t": () => handleNewTab(),
    "CmdOrCtrl+w": () => handleCloseActiveTab(),
    "CmdOrCtrl+b": () => uiStore.toggleSidebar(),
    "CmdOrCtrl+,": () => uiStore.showSettings(),
    "CmdOrCtrl+Shift+k": () => uiStore.showQuickConnect(),
    "CmdOrCtrl+Shift+s": () => uiStore.showSnippets(),
  });

  const handleNewTab = async () => {
    const project = projectStore.activeProject();
    if (!project) return;
    const tab = projectStore.addTab(project.id);
    const session = await sessionStore.createSession();
    projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, session.id);
  };

  const handleCloseActiveTab = async () => {
    const project = projectStore.activeProject();
    if (!project || !project.activeTabId) return;
    const tab = project.tabs.find((t) => t.id === project.activeTabId);
    if (!tab) return;
    const sessions = collectSessions(tab.rootPane);
    sessions.forEach((s) => sessionStore.removeSession(s));
    projectStore.removeTab(project.id, tab.id);
  };

  const handleSshConnected = async (sessionInfo: any) => {
    const project = projectStore.activeProject();
    if (!project) return;
    const tab = projectStore.addTab(project.id, sessionInfo.title);
    projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, sessionInfo.id);
  };

  const handleNewProject = async () => {
    const name = `Project ${projectStore.state.projects.length + 1}`;
    const project = projectStore.createProject(name);
    const session = await sessionStore.createSession();
    projectStore.setPaneSession(project.id, project.tabs[0].id, project.tabs[0].rootPane.id, session.id);
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projectStore.state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const confirmed = await ask(
      `"${project.name}" and all its tabs will be closed. Continue?`,
      { title: "Delete Project", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
    );
    if (!confirmed) return;

    for (const tab of project.tabs) {
      const sessions = collectSessions(tab.rootPane);
      for (const s of sessions) {
        await sessionStore.removeSession(s);
      }
    }
    projectStore.removeProject(projectId);
  };

  const handleDeleteTab = async (projectId: string, tabId: string) => {
    const project = projectStore.state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const tab = project.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const sessions = collectSessions(tab.rootPane);
    for (const s of sessions) {
      await sessionStore.removeSession(s);
    }
    projectStore.removeTab(projectId, tabId);
  };

  const activeTab = () => projectStore.activeTab();
  const activeProject = () => projectStore.activeProject();

  // Inline tab title editing in tabbar
  const [editingTabId, setEditingTabId] = createSignal<string | null>(null);
  let tabEditRef!: HTMLInputElement;

  const startTabEdit = (tabId: string) => {
    setEditingTabId(tabId);
    queueMicrotask(() => {
      tabEditRef?.focus();
      tabEditRef?.select();
    });
  };

  const commitTabEdit = (projectId: string, tabId: string) => {
    const v = tabEditRef?.value.trim();
    if (v) projectStore.updateTabTitle(projectId, tabId, v);
    setEditingTabId(null);
  };

  const collectSessions = (pane: any): string[] => {
    const sessions: string[] = [];
    if (pane.sessionId) sessions.push(pane.sessionId);
    for (const child of pane.children) {
      sessions.push(...collectSessions(child));
    }
    return sessions;
  };

  return (
    <div class="app-shell">
      <div class="app-shell__tabbar">
        <div class="app-shell__tabbar-tabs">
          <Show when={activeProject()}>
            {(project) => (
              <For each={project().tabs}>
                {(tab) => (
                  <div
                    class={`app-shell__tab ${project().activeTabId === tab.id ? "app-shell__tab--active" : ""}`}
                    onClick={() => projectStore.setActiveTab(project().id, tab.id)}
                  >
                    <Show
                      when={editingTabId() === tab.id}
                      fallback={
                        <span
                          class="app-shell__tab-title"
                          onDblclick={(e) => {
                            e.stopPropagation();
                            startTabEdit(tab.id);
                          }}
                        >
                          {tab.title}
                        </span>
                      }
                    >
                      <input
                        ref={tabEditRef}
                        class="app-shell__tab-edit"
                        value={tab.title}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => commitTabEdit(project().id, tab.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitTabEdit(project().id, tab.id);
                          if (e.key === "Escape") setEditingTabId(null);
                        }}
                      />
                    </Show>
                    <button
                      class="app-shell__tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        const sessions = collectSessions(tab.rootPane);
                        sessions.forEach((s) => sessionStore.removeSession(s));
                        projectStore.removeTab(project().id, tab.id);
                      }}
                      title="Close tab"
                    >
                      ×
                    </button>
                  </div>
                )}
              </For>
            )}
          </Show>
          <button class="app-shell__tabbar-new" onClick={handleNewTab} title="New Tab (Cmd+T)">
            +
          </button>
        </div>
      </div>
      <div class="app-shell__content">
        <Show when={uiStore.state.sidebarVisible}>
          <ProjectSidebar
            onNewTab={handleNewTab}
            onNewProject={handleNewProject}
            onDeleteProject={handleDeleteProject}
            onDeleteTab={handleDeleteTab}
          />
        </Show>
        <div class="app-shell__terminal-area">
          <Show
            when={activeTab()}
            fallback={
              <div class="app-shell__placeholder">
                <p>No terminal session</p>
                <p class="app-shell__placeholder-hint">Press + to open a new terminal</p>
              </div>
            }
          >
            <TerminalContainer
              rootPane={activeTab()!.rootPane}
            />
          </Show>
        </div>
        <Show when={uiStore.state.rightSidebarVisible}>
          <div class="app-shell__right-sidebar">
            <div class="app-shell__right-sidebar-tabs">
              <button
                class={`app-shell__right-sidebar-tab ${uiStore.state.rightSidebarTab === "snippets" ? "app-shell__right-sidebar-tab--active" : ""}`}
                onClick={() => uiStore.showSnippets()}
              >
                Snippets
              </button>
            </div>
            <div class="app-shell__right-sidebar-content">
              <Show when={uiStore.state.rightSidebarTab === "snippets"}>
                <SnippetPanel />
              </Show>
            </div>
          </div>
        </Show>
      </div>
      <SettingsView
        open={uiStore.state.settingsOpen}
        onClose={() => uiStore.hideSettings()}
      />
      <QuickConnect
        open={uiStore.state.quickConnectOpen}
        onClose={() => uiStore.hideQuickConnect()}
        onConnected={handleSshConnected}
      />
    </div>
  );
}
