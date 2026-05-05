import { onMount, For, Show, createSignal } from "solid-js";
import { useTmuxStore } from "../../stores/tmux-store";
import "./TmuxPanel.css";

interface TmuxPanelProps {
  activeSessionId: string | null;
  isInsideTmux: boolean;
  onAttach?: (tmuxSessionName: string) => void;
  onRemoteAttach?: (sshSessionId: string, tmuxSessionName: string, host: string) => void;
}

export function TmuxPanel(props: TmuxPanelProps) {
  const tmuxStore = useTmuxStore();
  const [newSessionName, setNewSessionName] = createSignal("");
  const [expandedSession, setExpandedSession] = createSignal<string | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  onMount(() => {
    tmuxStore.refreshLocal();
  });

  const handleCreate = async () => {
    const name = newSessionName().trim();
    if (!name) return;
    await tmuxStore.createLocalSession(name);
    setNewSessionName("");
    setShowCreate(false);
  };

  const handleKill = async (name: string) => {
    await tmuxStore.killLocalSession(name);
    if (expandedSession() === name) setExpandedSession(null);
  };

  const toggleExpand = async (name: string) => {
    if (expandedSession() === name) {
      setExpandedSession(null);
    } else {
      setExpandedSession(name);
      await tmuxStore.loadLocalWindows(name);
    }
  };

  // Attach to a local tmux session — open as new tab
  const handleAttach = async (sessionName: string) => {
    props.onAttach?.(sessionName);
  };

  // Attach to a remote tmux session — write to SSH session
  const handleRemoteAttach = async (sshSessionId: string, sessionName: string, host: string) => {
    props.onRemoteAttach?.(sshSessionId, sessionName, host);
  };

  return (
    <div class="tmux-panel">
      <div class="tmux-panel__header">
        <span class="tmux-panel__title">tmux Sessions</span>
        <div class="tmux-panel__header-actions">
          <button
            class="tmux-panel__icon-btn"
            onClick={() => tmuxStore.refreshLocal()}
            title="Refresh"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v4h4" /><path d="M3.5 12A6 6 0 1 0 3 7.5L1 8" />
            </svg>
          </button>
          <Show when={tmuxStore.state.localInfo.installed}>
            <button
              class="tmux-panel__icon-btn"
              onClick={() => setShowCreate(!showCreate())}
              title="New Session"
            >
              +
            </button>
          </Show>
        </div>
      </div>

      <Show when={tmuxStore.state.localInfo.double_tmux}>
        <div class="tmux-panel__warning">
          Running inside tmux. Nested sessions may cause issues.
        </div>
      </Show>

      <Show when={!tmuxStore.state.localInfo.installed}>
        <div class="tmux-panel__empty">
          <p>tmux is not installed</p>
          <p class="tmux-panel__hint">Install tmux to manage sessions</p>
        </div>
      </Show>

      <Show when={!props.activeSessionId && tmuxStore.state.localInfo.installed}>
        <div class="tmux-panel__hint-bar">
          Open a terminal tab to attach to sessions
        </div>
      </Show>

      <Show when={showCreate()}>
        <div class="tmux-panel__create">
          <input
            class="tmux-panel__input"
            type="text"
            value={newSessionName()}
            onInput={(e) => setNewSessionName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
            placeholder="Session name"
            autofocus
          />
          <button class="tmux-panel__create-btn" onClick={handleCreate}>Create</button>
        </div>
      </Show>

      <Show when={tmuxStore.state.localInfo.installed}>
        <div class="tmux-panel__list">
          <Show when={tmuxStore.state.localSessions.length === 0}>
            <div class="tmux-panel__empty">
              <p>No tmux sessions</p>
            </div>
          </Show>
          <For each={tmuxStore.state.localSessions}>
            {(session) => (
              <div class="tmux-panel__session">
                <div class="tmux-panel__session-header" onClick={() => toggleExpand(session.name)}>
                  <span class="tmux-panel__session-name">
                    {session.name}
                    <Show when={session.attached}>
                      <span class="tmux-panel__attached-badge">attached</span>
                    </Show>
                  </span>
                  <span class="tmux-panel__session-windows">{session.windows}w</span>
                  <div class="tmux-panel__session-actions">
                    <Show when={props.activeSessionId && !session.attached}>
                      <button
                        class="tmux-panel__attach-btn"
                        onClick={(e) => { e.stopPropagation(); handleAttach(session.name); }}
                        title={props.isInsideTmux ? "Switch to session" : "Attach to session"}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="4,2 12,8 4,14" />
                        </svg>
                      </button>
                    </Show>
                    <button
                      class="tmux-panel__kill-btn"
                      onClick={(e) => { e.stopPropagation(); handleKill(session.name); }}
                      title="Kill session"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <Show when={expandedSession() === session.name}>
                  <div class="tmux-panel__windows">
                    <For each={tmuxStore.state.localWindows[session.name] ?? []}>
                      {(win) => (
                        <div class={`tmux-panel__window ${win.active ? "tmux-panel__window--active" : ""}`}>
                          <span class="tmux-panel__window-index">{win.index}</span>
                          <span class="tmux-panel__window-name">{win.name}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={tmuxStore.state.remoteStates.length > 0}>
        <div class="tmux-panel__section-title">Remote</div>
        <For each={tmuxStore.state.remoteStates}>
          {(remote) => (
            <div class="tmux-panel__remote">
              <div class="tmux-panel__remote-header">
                <span class="tmux-panel__remote-host">{remote.host}</span>
                <button
                  class="tmux-panel__icon-btn"
                  onClick={() => tmuxStore.refreshRemote(remote.sessionId, remote.host)}
                  title="Refresh remote"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v4h4" /><path d="M3.5 12A6 6 0 1 0 3 7.5L1 8" />
                  </svg>
                </button>
              </div>
              <Show when={remote.error}>
                <div class="tmux-panel__error">{remote.error}</div>
              </Show>
              <For each={remote.sessions}>
                {(session) => (
                  <div class="tmux-panel__session tmux-panel__session--remote">
                    <span class="tmux-panel__session-name">
                      {session.name}
                      <Show when={session.attached}>
                        <span class="tmux-panel__attached-badge">attached</span>
                      </Show>
                    </span>
                    <span class="tmux-panel__session-windows">{session.windows}w</span>
                    <Show when={!session.attached}>
                      <button
                        class="tmux-panel__attach-btn"
                        onClick={() => handleRemoteAttach(remote.sessionId, session.name, remote.host)}
                        title="Attach to remote session"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="4,2 12,8 4,14" />
                        </svg>
                      </button>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={remote.sessions.length === 0 && !remote.loading && !remote.error}>
                <div class="tmux-panel__empty tmux-panel__empty--small">No sessions</div>
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
