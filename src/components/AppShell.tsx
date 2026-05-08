import { onMount, onCleanup, For, Show, createSignal } from "solid-js";
import { loadTerminalSettings } from "../stores/terminal-settings-store";
import { ask } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSessionStore } from "../stores/session-store";
import { useProjectStore } from "../stores/project-store";
import { useUiStore } from "../stores/ui-store";
import { useThemeStore } from "../stores/theme-store";
import { useProfileStore } from "../stores/profile-store";
import { useTmuxStore } from "../stores/tmux-store";
import { useKeyboard } from "../hooks/use-keyboard";
import { ProjectSidebar } from "./project/ProjectSidebar";
import { SnippetPanel } from "./snippets/SnippetPanel";
import { TerminalContainer } from "./terminal/TerminalContainer";
import { SettingsView } from "./settings/SettingsView";
import { QuickConnect } from "./connection/QuickConnect";
import { SshHostPanel } from "./ssh/SshHostPanel";
import { sshConnect } from "../ipc/ssh-commands";
import { sessionGetCwd } from "../ipc/commands";
import type { SshConfigEntry } from "../ipc/ssh-config-commands";
import "./AppShell.css";

export function AppShell() {
  const sessionStore = useSessionStore();
  const projectStore = useProjectStore();
  const uiStore = useUiStore();
  const themeStore = useThemeStore();
  const profileStore = useProfileStore();
  const tmuxStore = useTmuxStore();

  // Cleanup holders for Tauri listeners (registered synchronously)
  const unlisteners: (() => void)[] = [];
  onCleanup(() => { for (const fn of unlisteners) fn(); });

  // Auto-close tab when process exits with code 0 (single-pane tabs only)
  const handleSessionExit = (e: Event) => {
    const { sessionId } = (e as CustomEvent).detail;
    for (const proj of projectStore.state.projects) {
      for (const tab of proj.tabs) {
        const sessions = collectSessions(tab.rootPane);
        if (sessions.includes(sessionId)) {
          if (sessions.length === 1) {
            // Single pane — close entire tab
            const tmuxTab = tmuxStore.getTmuxTab(tab.id);
            if (tmuxTab) {
              try {
                if (tmuxTab.isRemote) {
                  tmuxStore.detachRemoteSession(tmuxTab.sessionId, tmuxTab.tmuxSessionName);
                } else {
                  tmuxStore.detachLocalSession(tmuxTab.tmuxSessionName);
                }
              } catch {}
              tmuxStore.unregisterTmuxTab(tab.id);
            }
            sessionStore.removeSession(sessionId);
            projectStore.removeTab(proj.id, tab.id);
          } else {
            // Multiple panes — remove only the exited pane
            sessionStore.removeSession(sessionId);
            projectStore.removePaneBySession(proj.id, tab.id, sessionId);
          }
          return;
        }
      }
    }
  };
  document.addEventListener("kterm:session-exit", handleSessionExit);
  onCleanup(() => document.removeEventListener("kterm:session-exit", handleSessionExit));

  onMount(async () => {
    await themeStore.initTheme();
    await profileStore.initProfiles();
    await loadTerminalSettings();

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
    }).then((unlisten) => unlisteners.push(unlisten));

    // Listen for SSH host key verification requests
    listen<{ confirmation_id: string; host: string; key: string }>("ssh:host-key-verify", async (event) => {
      const { confirmation_id, host, key } = event.payload;
      const confirmed = await ask(
        `The authenticity of host '${host}' can't be established.\n\nHost key:\n${key}\n\nDo you want to trust this host?`,
        { title: "SSH Host Key Verification", kind: "warning", okLabel: "Trust", cancelLabel: "Reject" },
      );
      invoke("ssh_confirm_host_key", { confirmationId: confirmation_id, confirmed });
    }).then((unlisten) => unlisteners.push(unlisten));

    // Try to restore existing sessions from the backend
    const existing = await sessionStore.restoreFromBackend();

    if (existing.length > 0) {
      // Rebuild project/tab structure from surviving backend sessions
      projectStore.clearAll();
      const project = projectStore.createProject("Workspace");
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
      const project = projectStore.createProject("Workspace");
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

  const handleNewTab = async (profileId?: string) => {
    const project = projectStore.activeProject();
    if (!project) return;
    const tab = projectStore.addTab(project.id);
    let session;

    try {
      // Inherit cwd from active tab's session
      let inheritedCwd: string | undefined;
      const activeTab = projectStore.activeTab();
      if (activeTab) {
        const sid = collectSessions(activeTab.rootPane)[0];
        if (sid) {
          try { inheritedCwd = (await sessionGetCwd(sid)) ?? undefined; } catch {}
        }
      }

      const profile = profileId
        ? profileStore.getProfile(profileId)
        : profileStore.getDefaultProfile();

      if (profile) {
        const cwd = profile.cwd || inheritedCwd;
        const env = profile.env.length > 0 ? profile.env as [string, string][] : undefined;
        const args = profile.args.length > 0 ? profile.args : undefined;
        session = await sessionStore.createSession(profile.shell, args, cwd, env);
      } else {
        session = await sessionStore.createSession(undefined, undefined, inheritedCwd);
      }

      projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, session.id);
      syncActiveSession();
    } catch (e) {
      console.error("Failed to create session:", e);
      ask(`Failed to create terminal session:\n${e}`, {
        title: "Session Error", kind: "error", okLabel: "OK",
      }).catch(() => {});
      projectStore.removeTab(project.id, tab.id);
    }
  };

  // Open a new tab that attaches to a local tmux session
  const handleTmuxAttach = async (tmuxSessionName: string) => {
    const project = projectStore.activeProject();
    if (!project) return;
    const defaultProfile = profileStore.getDefaultProfile();
    const shell = defaultProfile?.shell;
    const tab = projectStore.addTab(project.id, `tmux: ${tmuxSessionName}`);
    const session = await sessionStore.createSession(shell);
    projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, session.id);
    // Register as tmux tab for window-tab integration
    tmuxStore.registerTmuxTab(tab.id, session.id, tmuxSessionName);
    tmuxStore.startPolling();
    syncActiveSession();
    // Send tmux attach + hide tmux status bar after a short delay
    setTimeout(async () => {
      await sessionStore.writeToSession(session.id, `tmux attach -t '${tmuxSessionName.replace(/'/g, "'\\''")}'\n`);
    }, 300);
  };

  // Attach to a remote tmux session from an existing SSH connection
  const handleRemoteTmuxAttach = async (sshSessionId: string, tmuxSessionName: string, host: string) => {
    const project = projectStore.activeProject();
    if (!project) return;

    // Find the kterm tab that holds this SSH session
    let targetTabId: string | null = null;
    for (const proj of projectStore.state.projects) {
      for (const tab of proj.tabs) {
        const sessions = collectSessions(tab.rootPane);
        if (sessions.includes(sshSessionId)) {
          targetTabId = tab.id;
          break;
        }
      }
      if (targetTabId) break;
    }

    // Register the tab as a remote tmux tab
    if (targetTabId) {
      tmuxStore.registerTmuxTab(targetTabId, sshSessionId, tmuxSessionName, true);
      tmuxStore.startPolling();
    }

    // Write tmux attach command to the SSH session
    await sessionStore.writeToSession(sshSessionId, `tmux attach -t '${tmuxSessionName.replace(/'/g, "'\\''")}'\n`);
  };

  const handleCloseActiveTab = async () => {
    const project = projectStore.activeProject();
    if (!project || !project.activeTabId) return;
    const tab = project.tabs.find((t) => t.id === project.activeTabId);
    if (!tab) return;
    // Detach tmux session before killing PTY to keep it alive
    const tmuxTab = tmuxStore.getTmuxTab(tab.id);
    if (tmuxTab) {
      try {
        if (tmuxTab.isRemote) {
          await tmuxStore.detachRemoteSession(tmuxTab.sessionId, tmuxTab.tmuxSessionName);
        } else {
          await tmuxStore.detachLocalSession(tmuxTab.tmuxSessionName);
        }
      } catch {}
      tmuxStore.unregisterTmuxTab(tab.id);
    }
    const sessions = collectSessions(tab.rootPane);
    sessions.forEach((s) => sessionStore.removeSession(s));
    projectStore.removeTab(project.id, tab.id);
  };

  const handleSshConnected = async (sessionInfo: any) => {
    const project = projectStore.activeProject();
    if (!project) return;
    const tab = projectStore.addTab(project.id, sessionInfo.title);
    projectStore.setPaneSession(project.id, tab.id, tab.rootPane.id, sessionInfo.id);
    // Auto-fetch remote tmux sessions
    if (sessionInfo.kind?.type === "Ssh") {
      const host = `${sessionInfo.kind.user}@${sessionInfo.kind.host}`;
      tmuxStore.refreshRemote(sessionInfo.id, host);
    }
  };

  const handleSshConfigConnect = async (entry: SshConfigEntry) => {
    const host = entry.host_name || entry.host_alias;
    const user = entry.user || "root";
    const auth = entry.identity_file
      ? { type: "PrivateKey" as const, key_path: entry.identity_file, passphrase: null as string | null }
      : { type: "Agent" as const };
    try {
      const sessionInfo = await sshConnect(host, entry.port, user, auth, 80, 24);
      handleSshConnected(sessionInfo);
    } catch (e: any) {
      console.error("SSH config connect failed:", e);
      ask(`SSH connection failed:\n${e}`, {
        title: "SSH Error", kind: "error", okLabel: "OK",
      }).catch(() => {});
    }
  };

  const handleNewProject = async () => {
    const count = projectStore.state.projects.length;
    const name = count === 0 ? "Workspace" : `Workspace ${count + 1}`;
    const project = projectStore.createProject(name);
    const defaultProfile = profileStore.getDefaultProfile();
    let session;
    if (defaultProfile) {
      session = await sessionStore.createSessionFromProfile(defaultProfile);
    } else {
      session = await sessionStore.createSession();
    }
    projectStore.setPaneSession(project.id, project.tabs[0].id, project.tabs[0].rootPane.id, session.id);
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projectStore.state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const confirmed = await ask(
      `"${project.name}" and all its tabs will be closed. Continue?`,
      { title: "Delete Workspace", kind: "warning", okLabel: "Delete", cancelLabel: "Cancel" },
    );
    if (!confirmed) return;

    for (const tab of project.tabs) {
      // Detach tmux sessions before killing PTYs (best-effort)
      const tmuxTab = tmuxStore.getTmuxTab(tab.id);
      if (tmuxTab) {
        try {
          if (tmuxTab.isRemote) {
            await tmuxStore.detachRemoteSession(tmuxTab.sessionId, tmuxTab.tmuxSessionName);
          } else {
            await tmuxStore.detachLocalSession(tmuxTab.tmuxSessionName);
          }
        } catch {}
        tmuxStore.unregisterTmuxTab(tab.id);
      }
      const sessions = collectSessions(tab.rootPane);
      for (const s of sessions) {
        await sessionStore.removeSession(s);
      }
    }
    projectStore.removeProject(projectId);
  };

  const activeTab = () => projectStore.activeTab();
  const activeProject = () => projectStore.activeProject();

  // Sync sessionStore.activeSessionId when active tab changes
  let lastActiveTabId: string | null = null;
  const syncActiveSession = () => {
    const tab = activeTab();
    if (!tab || tab.id === lastActiveTabId) return;
    lastActiveTabId = tab.id;
    const sessionId = collectSessions(tab.rootPane)[0];
    if (sessionId) sessionStore.setActive(sessionId);
  };

  // Inline tab title editing in tabbar
  const [editingTabId, setEditingTabId] = createSignal<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = createSignal(false);
  const [dragOverTabId, setDragOverTabId] = createSignal<string | null>(null);
  let draggedTabId: string | null = null;
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
        <button
          class={`app-shell__tabbar-icon-btn ${uiStore.state.sidebarVisible ? "app-shell__tabbar-icon-btn--active" : ""}`}
          onClick={() => uiStore.toggleSidebar()}
          title="Toggle Sidebar (Cmd+B)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="14" height="14" rx="2" />
            <line x1="5.5" y1="1" x2="5.5" y2="15" />
          </svg>
        </button>
        <div class="app-shell__tabbar-tabs">
          <Show
            when={activeTab() && tmuxStore.getTmuxTab(activeTab()!.id)}
          >
            {/* tmux window tabs — active tab is in tmux mode */}
            <For each={tmuxStore.getTmuxTab(activeTab()!.id)!.windows}>
              {(win) => (
                <div
                  class={`app-shell__tab ${win.active ? "app-shell__tab--active" : ""}`}
                  onClick={() => {
                    const t = tmuxStore.getTmuxTab(activeTab()!.id);
                    if (t) tmuxStore.selectWindow(t.tmuxSessionName, win.index);
                  }}
                >
                  <span class="app-shell__tab-title">{win.name}</span>
                  <button
                    class="app-shell__tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      const t = tmuxStore.getTmuxTab(activeTab()!.id);
                      if (t) tmuxStore.killWindow(t.tmuxSessionName, win.index);
                    }}
                    title="Close window"
                  >
                    ×
                  </button>
                </div>
              )}
            </For>
            <button
              class="app-shell__tabbar-new"
              onClick={() => {
                const t = tmuxStore.getTmuxTab(activeTab()!.id);
                if (t) tmuxStore.createWindow(t.tmuxSessionName);
              }}
              title="New tmux window"
            >
              +
            </button>
          </Show>
          {/* Show this when active tab is NOT in tmux mode */}
          <Show when={!activeTab() || !tmuxStore.getTmuxTab(activeTab()!.id)}>
            <Show when={activeProject()}>
              {(project) => (
                <For each={project().tabs}>
                  {(tab, getIndex) => (
                    <div
                      class={`app-shell__tab ${project().activeTabId === tab.id ? "app-shell__tab--active" : ""} ${dragOverTabId() === tab.id ? "app-shell__tab--drag-over" : ""}`}
                      draggable="true"
                      onClick={() => { projectStore.setActiveTab(project().id, tab.id); syncActiveSession(); }}
                      onDragStart={(e) => {
                        draggedTabId = tab.id;
                        e.dataTransfer!.effectAllowed = "move";
                        e.dataTransfer!.setData("text/plain", tab.id);
                        (e.currentTarget as HTMLElement).classList.add("app-shell__tab--dragging");
                      }}
                      onDragEnd={(e) => {
                        draggedTabId = null;
                        setDragOverTabId(null);
                        (e.currentTarget as HTMLElement).classList.remove("app-shell__tab--dragging");
                      }}
                      onDragOver={(e) => {
                        if (draggedTabId === null || draggedTabId === tab.id) return;
                        e.preventDefault();
                        e.dataTransfer!.dropEffect = "move";
                        setDragOverTabId(tab.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverTabId() === tab.id) setDragOverTabId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverTabId(null);
                        if (draggedTabId === null || draggedTabId === tab.id) return;
                        const tabs = project().tabs;
                        const fromIdx = tabs.findIndex((t) => t.id === draggedTabId);
                        const toIdx = getIndex();
                        if (fromIdx !== -1 && fromIdx !== toIdx) {
                          projectStore.reorderTabs(project().id, fromIdx, toIdx);
                        }
                        draggedTabId = null;
                      }}
                    >
                      <Show
                        when={editingTabId() === tab.id}
                        fallback={
                          <span
                            class="app-shell__tab-title"
                            onDblClick={(e) => {
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
                          const tmuxTab = tmuxStore.getTmuxTab(tab.id);
                          if (tmuxTab) {
                            if (tmuxTab.isRemote) {
                              tmuxStore.detachRemoteSession(tmuxTab.sessionId, tmuxTab.tmuxSessionName).catch(() => {});
                            } else {
                              tmuxStore.detachLocalSession(tmuxTab.tmuxSessionName).catch(() => {});
                            }
                            tmuxStore.unregisterTmuxTab(tab.id);
                          }
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
            <div class="app-shell__tabbar-new-wrapper">
              <button class="app-shell__tabbar-new" onClick={() => handleNewTab()} title="New Tab (Cmd+T)">
                +
              </button>
              <button
                class="app-shell__tabbar-new-chevron"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen())}
                title="New Tab with Profile"
              >
                ▾
              </button>
              <Show when={profileDropdownOpen()}>
                <div class="app-shell__profile-dropdown" onClick={(e) => e.stopPropagation()}>
                  <For each={profileStore.state.profiles}>
                    {(profile) => (
                      <button
                        class={`app-shell__profile-dropdown-item ${profileStore.state.defaultProfileId === profile.id ? "app-shell__profile-dropdown-item--default" : ""}`}
                        onClick={() => { handleNewTab(profile.id); setProfileDropdownOpen(false); }}
                      >
                        {profile.name}
                        <Show when={profileStore.state.defaultProfileId === profile.id}>
                          <span class="app-shell__profile-dropdown-star">★</span>
                        </Show>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
        </div>
        <div class="app-shell__tabbar-actions">
          <button
            class={`app-shell__tabbar-icon-btn ${uiStore.state.rightSidebarVisible ? "app-shell__tabbar-icon-btn--active" : ""}`}
            onClick={() => uiStore.toggleRightSidebar()}
            title="Toggle Panel (Cmd+Shift+S)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="1" width="12" height="14" rx="2" />
              <line x1="5" y1="4" x2="11" y2="4" />
              <line x1="5" y1="7" x2="11" y2="7" />
              <line x1="5" y1="10" x2="9" y2="10" />
            </svg>
          </button>
        </div>
      </div>
      <div class="app-shell__content">
        <Show when={uiStore.state.sidebarVisible}>
          <ProjectSidebar
            onNewProject={handleNewProject}
            onDeleteProject={handleDeleteProject}
            onTmuxAttach={handleTmuxAttach}
            onRemoteTmuxAttach={handleRemoteTmuxAttach}
          />
        </Show>
        <div class="app-shell__terminal-area">
          <For each={projectStore.state.projects}>
            {(project) => (
              <For each={project.tabs}>
                {(tab) => {
                  const isActive = () =>
                    projectStore.state.activeProjectId === project.id &&
                    project.activeTabId === tab.id;
                  return (
                    <div
                      class="app-shell__terminal-layer"
                      style={{
                        visibility: isActive() ? "visible" : "hidden",
                        "pointer-events": isActive() ? "auto" : "none",
                      }}
                    >
                      <TerminalContainer rootPane={tab.rootPane} />
                    </div>
                  );
                }}
              </For>
            )}
          </For>
          <Show when={!activeProject() || (activeProject() && activeProject()!.tabs.length === 0)}>
            <div class="app-shell__placeholder">
              <p>No terminal session</p>
              <p class="app-shell__placeholder-hint">Press + to open a new terminal</p>
            </div>
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
              <button
                class={`app-shell__right-sidebar-tab ${uiStore.state.rightSidebarTab === "hosts" ? "app-shell__right-sidebar-tab--active" : ""}`}
                onClick={() => uiStore.showHosts()}
              >
                Hosts
              </button>
            </div>
            <div class="app-shell__right-sidebar-content">
              <Show when={uiStore.state.rightSidebarTab === "snippets"}>
                <SnippetPanel />
              </Show>
              <Show when={uiStore.state.rightSidebarTab === "hosts"}>
                <SshHostPanel onConnect={handleSshConfigConnect} />
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
