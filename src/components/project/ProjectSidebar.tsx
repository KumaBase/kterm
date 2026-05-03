import { For, Show, createSignal } from "solid-js";
import { useProjectStore } from "../../stores/project-store";
import "./ProjectSidebar.css";

interface ProjectSidebarProps {
  onNewTab?: () => void;
  onNewProject?: () => void;
  onDeleteProject?: (projectId: string) => void;
  onDeleteTab?: (projectId: string, tabId: string) => void;
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
  const { state, setActiveProject, toggleExpand, setActiveTab, updateProjectName, updateTabTitle } = useProjectStore();

  return (
    <div class="project-sidebar">
      <div class="project-sidebar__header">
        <span class="project-sidebar__title">Projects</span>
        <button
          class="project-sidebar__add-project"
          onClick={() => props.onNewProject?.()}
          title="New Project"
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
                <button
                  class="project-sidebar__expand"
                  onClick={(e) => { e.stopPropagation(); toggleExpand(project.id); }}
                >
                  {project.expanded ? "\u25BC" : "\u25B6"}
                </button>
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
                  title="Delete Project"
                >
                  ×
                </button>
              </div>
              <Show when={project.expanded}>
                <div class="project-sidebar__tabs">
                  <For each={project.tabs}>
                    {(tab) => (
                      <div
                        class={`project-sidebar__tab ${project.activeTabId === tab.id ? "project-sidebar__tab--active" : ""}`}
                        onClick={() => setActiveTab(project.id, tab.id)}
                      >
                        <EditableText
                          value={tab.title}
                          onChange={(title) => updateTabTitle(project.id, tab.id, title)}
                          class="project-sidebar__tab-name"
                        />
                        <button
                          class="project-sidebar__tab-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            props.onDeleteTab?.(project.id, tab.id);
                          }}
                          title="Close tab"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </For>
                  <button
                    class="project-sidebar__add-tab"
                    onClick={() => props.onNewTab?.()}
                  >
                    + New Tab
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
