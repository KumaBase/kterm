import { For, Show, createSignal, onMount } from "solid-js";
import { useProjectStore } from "../../stores/project-store";
import { useTmuxStore } from "../../stores/tmux-store";
import "./ProjectSidebar.css";

interface ProjectSidebarProps {
  onNewProject?: () => void;
  onDeleteProject?: (projectId: string) => void;
  onTmuxAttach?: (tmuxSessionName: string) => void;
}

function EditableText(props: {
  value: string;
  onChange: (value: string) => void;
  class?: string;
}) {
  const [editing, setEditing] = createSignal(false);
  let inputRef!: HTMLInputElement;

  const startEdit = () => {
    setEditing(true);
    // Focus after DOM update
    queueMicrotask(() => {
      inputRef?.focus();
      inputRef?.select();
    });
  };

  const commit = () => {
    setEditing(false);
    const v = inputRef.value.trim();
    if (v && v !== props.value) props.onChange(v);
  };

  return (
    <Show
      when={editing()}
      fallback={
        <span
          class={props.class}
          onDblClick={(e) => { e.stopPropagation(); startEdit(); }}
        >
          {props.value}
        </span>
      }
    >
      <input
        ref={inputRef}
        class="project-sidebar__edit-input"
        value={props.value}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    </Show>
  );
}

export function ProjectSidebar(props: ProjectSidebarProps) {
  const { state, setActiveProject, updateProjectName } = useProjectStore();
  const tmuxStore = useTmuxStore();
  const [tmuxExpanded, setTmuxExpanded] = createSignal(false);
  const [newSessionName, setNewSessionName] = createSignal("");
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

  return (
    <div class="project-sidebar">
      <div class="project-sidebar__header">
        <span class="project-sidebar__title">Workspaces</span>
        <button
          class="project-sidebar__add-project"
          onClick={() => props.onNewProject?.()}
          title="New Workspace"
        >
          +
        </button>
      </div>
      <div class="project-sidebar__list">
        <For each={state.projects}>
          {(project) => (
            <div class={`project-sidebar__project ${state.activeProjectId === project.id ? "project-sidebar__project--active" : ""}`}>
              <div
                class="project-sidebar__project-header"
                onClick={() => setActiveProject(project.id)}
              >
                <EditableText
                  value={project.name}
                  onChange={(name) => updateProjectName(project.id, name)}
                />
                <button
                  class="project-sidebar__delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteProject?.(project.id);
                  }}
                  title="Delete Workspace"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* tmux section */}
      <Show when={tmuxStore.state.localInfo.installed}>
        <div class="project-sidebar__tmux-section">
          <div
            class="project-sidebar__tmux-header"
            onClick={() => setTmuxExpanded(!tmuxExpanded())}
          >
            <button class="project-sidebar__expand">
              {tmuxExpanded() ? "\u25BC" : "\u25B6"}
            </button>
            <span class="project-sidebar__tmux-title">tmux</span>
            <div class="project-sidebar__tmux-actions">
              <button
                class="project-sidebar__tmux-icon-btn"
                onClick={(e) => { e.stopPropagation(); tmuxStore.refreshLocal(); }}
                title="Refresh"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 4v4h4" /><path d="M3.5 12A6 6 0 1 0 3 7.5L1 8" />
                </svg>
              </button>
              <button
                class="project-sidebar__tmux-icon-btn"
                onClick={(e) => { e.stopPropagation(); setShowCreate(!showCreate()); }}
                title="New Session"
              >
                +
              </button>
            </div>
          </div>
          <Show when={tmuxStore.state.localInfo.double_tmux}>
            <div class="project-sidebar__tmux-warning">
              Nested tmux detected
            </div>
          </Show>
          <Show when={tmuxExpanded()}>
            <Show when={showCreate()}>
              <div class="project-sidebar__tmux-create">
                <input
                  class="project-sidebar__tmux-input"
                  type="text"
                  value={newSessionName()}
                  onInput={(e) => setNewSessionName(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                  placeholder="Session name"
                />
              </div>
            </Show>
            <div class="project-sidebar__tmux-sessions">
              <For each={tmuxStore.state.localSessions}>
                {(session) => (
                  <div
                    class={`project-sidebar__tmux-session ${session.attached ? "project-sidebar__tmux-session--attached" : ""}`}
                    onClick={() => !session.attached && props.onTmuxAttach?.(session.name)}
                  >
                    <span class="project-sidebar__tmux-session-name">
                      {session.name}
                    </span>
                    <span class="project-sidebar__tmux-session-info">
                      {session.windows}w
                    </span>
                    <Show when={!session.attached}>
                      <button
                        class="project-sidebar__tmux-kill"
                        onClick={(e) => { e.stopPropagation(); tmuxStore.killLocalSession(session.name); }}
                        title="Kill session"
                      >
                        ×
                      </button>
                    </Show>
                  </div>
                )}
              </For>
              <Show when={tmuxStore.state.localSessions.length === 0}>
                <div class="project-sidebar__tmux-empty">No sessions</div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>

      {/* Remote tmux sessions (from SSH connections) */}
      <Show when={tmuxStore.state.remoteStates.length > 0}>
        <div class="project-sidebar__tmux-section">
          <div
            class="project-sidebar__tmux-header"
            onClick={() => setTmuxExpanded(!tmuxExpanded())}
          >
            <button class="project-sidebar__expand">
              {tmuxExpanded() ? "\u25BC" : "\u25B6"}
            </button>
            <span class="project-sidebar__tmux-title">Remote tmux</span>
          </div>
          <Show when={tmuxExpanded()}>
            <For each={tmuxStore.state.remoteStates}>
              {(remote) => (
                <div class="project-sidebar__tmux-remote-host">
                  <div class="project-sidebar__tmux-remote-header">
                    <span class="project-sidebar__tmux-remote-name">{remote.host}</span>
                    <button
                      class="project-sidebar__tmux-icon-btn"
                      onClick={(e) => { e.stopPropagation(); tmuxStore.refreshRemote(remote.sessionId, remote.host); }}
                      title="Refresh"
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 4v4h4" /><path d="M3.5 12A6 6 0 1 0 3 7.5L1 8" />
                      </svg>
                    </button>
                  </div>
                  <Show when={remote.error}>
                    <div class="project-sidebar__tmux-error">{remote.error}</div>
                  </Show>
                  <For each={remote.sessions}>
                    {(session) => (
                      <div
                        class={`project-sidebar__tmux-session ${session.attached ? "project-sidebar__tmux-session--attached" : ""}`}
                        onClick={() => !session.attached && props.onTmuxAttach?.(session.name)}
                      >
                        <span class="project-sidebar__tmux-session-name">
                          {session.name}
                        </span>
                        <span class="project-sidebar__tmux-session-info">
                          {session.windows}w
                        </span>
                      </div>
                    )}
                  </For>
                  <Show when={remote.sessions.length === 0 && !remote.loading && !remote.error}>
                    <div class="project-sidebar__tmux-empty">No sessions</div>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}
