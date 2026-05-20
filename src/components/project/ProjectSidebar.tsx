import { For, Show, createSignal, onMount } from "solid-js";
import { useProjectStore } from "../../stores/project-store";
import { useTmuxStore } from "../../stores/tmux-store";
import { useZellijStore } from "../../stores/zellij-store";
import { useTerminalSettingsStore } from "../../stores/terminal-settings-store";
import "./ProjectSidebar.css";

interface ProjectSidebarProps {
  onNewProject?: () => void;
  onDeleteProject?: (projectId: string) => void;
  onTmuxAttach?: (tmuxSessionName: string) => void;
  onRemoteTmuxAttach?: (sshSessionId: string, tmuxSessionName: string, host: string) => void;
  onZellijAttach?: (zellijSessionName: string) => void;
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
  const { state, setActiveProject, updateProjectName, reorderProjects } = useProjectStore();
  const tmuxStore = useTmuxStore();
  const zellijStore = useZellijStore();
  const { tmuxEnabled, zellijEnabled } = useTerminalSettingsStore();
  const [tmuxExpanded, setTmuxExpanded] = createSignal(false);
  const [zellijExpanded, setZellijExpanded] = createSignal(false);
  const [newSessionName, setNewSessionName] = createSignal("");
  const [showCreate, setShowCreate] = createSignal(false);
  const [dragOverProjectId, setDragOverProjectId] = createSignal<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = createSignal<string | null>(null);
  let draggedProjectId: string | null = null;
  let suppressNextClick = false;

  onMount(() => {
    tmuxStore.refreshLocal();
    zellijStore.refreshLocal();
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
          {(project, getIndex) => (
            <div
              class={`project-sidebar__project ${state.activeProjectId === project.id ? "project-sidebar__project--active" : ""} ${dragOverProjectId() === project.id ? "project-sidebar__project--drag-over" : ""} ${draggingProjectId() === project.id ? "project-sidebar__project--dragging" : ""}`}
              data-project-id={project.id}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const startY = e.clientY;
                const sourceProjectId = project.id;
                let moved = false;
                draggedProjectId = project.id;
                setDraggingProjectId(project.id);

                const onMove = (me: MouseEvent) => {
                  if (!moved && Math.abs(me.clientY - startY) < 4) return;
                  moved = true;
                  const projectEls = document.querySelectorAll('.project-sidebar__project[data-project-id]');
                  let overId: string | null = null;
                  projectEls.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    if (me.clientY >= rect.top && me.clientY <= rect.bottom) {
                      overId = el.getAttribute('data-project-id');
                    }
                  });
                  // If cursor is below all items, target the last one
                  if (!overId && projectEls.length > 0) {
                    const lastRect = projectEls[projectEls.length - 1].getBoundingClientRect();
                    if (me.clientY > lastRect.bottom) {
                      overId = projectEls[projectEls.length - 1].getAttribute('data-project-id');
                    }
                  }
                  setDragOverProjectId(overId !== sourceProjectId ? overId : null);
                };

                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                  const targetId = dragOverProjectId();
                  setDragOverProjectId(null);
                  setDraggingProjectId(null);
                  draggedProjectId = null;
                  if (moved && targetId && sourceProjectId !== targetId) {
                    const fromIdx = state.projects.findIndex((p) => p.id === sourceProjectId);
                    const toIdx = state.projects.findIndex((p) => p.id === targetId);
                    if (fromIdx !== -1 && toIdx !== -1) {
                      reorderProjects(fromIdx, toIdx);
                    }
                    suppressNextClick = true;
                  }
                };

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              <div
                class="project-sidebar__project-header"
                onClick={() => {
                  if (suppressNextClick) { suppressNextClick = false; return; }
                  setActiveProject(project.id);
                }}
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
      <Show when={tmuxEnabled() && tmuxStore.state.localInfo.installed}>
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
      <Show when={tmuxEnabled() && tmuxStore.state.remoteStates.length > 0}>
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
                        onClick={() => !session.attached && props.onRemoteTmuxAttach?.(remote.sessionId, session.name, remote.host)}
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

      {/* zellij section */}
      <Show when={zellijEnabled() && zellijStore.state.localInfo.installed}>
        <div class="project-sidebar__tmux-section">
          <div
            class="project-sidebar__tmux-header"
            onClick={() => setZellijExpanded(!zellijExpanded())}
          >
            <button class="project-sidebar__expand">
              {zellijExpanded() ? "\u25BC" : "\u25B6"}
            </button>
            <span class="project-sidebar__tmux-title">zellij</span>
            <div class="project-sidebar__tmux-actions">
              <button
                class="project-sidebar__tmux-icon-btn"
                onClick={(e) => { e.stopPropagation(); zellijStore.refreshLocal(); }}
                title="Refresh"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 4v4h4" /><path d="M3.5 12A6 6 0 1 0 3 7.5L1 8" />
                </svg>
              </button>
            </div>
          </div>
          <Show when={zellijExpanded()}>
            <div class="project-sidebar__tmux-sessions">
              <For each={zellijStore.state.localSessions}>
                {(session) => (
                  <div
                    class={`project-sidebar__tmux-session ${session.attached ? "project-sidebar__tmux-session--attached" : ""}`}
                    onClick={() => !session.attached && props.onZellijAttach?.(session.name)}
                  >
                    <span class="project-sidebar__tmux-session-name">
                      {session.name}
                    </span>
                    <Show when={session.tabs > 0}>
                      <span class="project-sidebar__tmux-session-info">
                        {session.tabs}t
                      </span>
                    </Show>
                    <button
                      class="project-sidebar__tmux-kill"
                      onClick={(e) => { e.stopPropagation(); zellijStore.killLocalSession(session.name); }}
                      title="Kill session"
                    >
                      ×
                    </button>
                  </div>
                )}
              </For>
              <Show when={zellijStore.state.localSessions.length === 0}>
                <div class="project-sidebar__tmux-empty">No sessions</div>
              </Show>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
