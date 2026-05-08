import { createStore, produce } from "solid-js/store";
import { v4 as uuidv4 } from "uuid";
import type { Project, Tab, SplitPane, ProjectId, TabId, PaneId, PaneLayout } from "../types/project";

function createDefaultPane(): SplitPane {
  return {
    id: uuidv4(),
    direction: null,
    children: [],
    sessionId: null,
    size: 100,
  };
}

function createDefaultTab(title?: string): Tab {
  return {
    id: uuidv4(),
    title: title || "Terminal",
    rootPane: createDefaultPane(),
    sessionId: null,
  };
}

interface ProjectState {
  projects: Project[];
  activeProjectId: ProjectId | null;
}

const [state, setState] = createStore<ProjectState>({
  projects: [],
  activeProjectId: null,
});

export function useProjectStore() {
  const createProject = (name?: string) => {
    const defaultTab = createDefaultTab();
    const project: Project = {
      id: uuidv4(),
      name: name || "Workspace",
      tabs: [defaultTab],
      activeTabId: defaultTab.id,
      expanded: true,
    };
    setState(produce((s) => {
      s.projects.push(project);
      s.activeProjectId = project.id;
    }));
    return project;
  };

  const removeProject = (projectId: ProjectId) => {
    setState(produce((s) => {
      s.projects = s.projects.filter((p) => p.id !== projectId);
      if (s.activeProjectId === projectId) {
        s.activeProjectId = s.projects.length > 0 ? s.projects[0].id : null;
      }
    }));
  };

  const setActiveProject = (projectId: ProjectId) => {
    setState("activeProjectId", projectId);
  };

  const addTab = (projectId: ProjectId, title?: string) => {
    const tab = createDefaultTab(title);
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (project) {
        project.tabs.push(tab);
        project.activeTabId = tab.id;
      }
    }));
    return tab;
  };

  const removeTab = (projectId: ProjectId, tabId: TabId) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return;
      project.tabs = project.tabs.filter((t) => t.id !== tabId);
      if (project.activeTabId === tabId) {
        project.activeTabId = project.tabs.length > 0 ? project.tabs[0].id : null;
      }
    }));
  };

  const setActiveTab = (projectId: ProjectId, tabId: TabId) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (project) {
        project.activeTabId = tabId;
      }
    }));
  };

  const updateTabTitle = (projectId: ProjectId, tabId: TabId, title: string) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return;
      const tab = project.tabs.find((t) => t.id === tabId);
      if (tab) tab.title = title;
    }));
  };

  const updateProjectName = (projectId: ProjectId, name: string) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (project) project.name = name;
    }));
  };

  const reorderProjects = (fromIndex: number, toIndex: number) => {
    const arr = [...state.projects];
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    setState("projects", arr);
  };

  const reorderTabs = (projectId: ProjectId, fromIndex: number, toIndex: number) => {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const arr = [...project.tabs];
    const [tab] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, tab);
    setState(
      "projects",
      (p) => p.id === projectId,
      "tabs",
      arr,
    );
  };

  const splitPane = (
    projectId: ProjectId,
    tabId: TabId,
    paneId: PaneId,
    direction: PaneLayout,
    newSessionId: string
  ) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return;
      const tab = project.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const findAndSplit = (pane: SplitPane): boolean => {
        if (pane.id === paneId) {
          const newChild = createDefaultPane();
          newChild.sessionId = newSessionId;
          newChild.size = 50;
          pane.direction = direction;
          pane.children = [
            { ...pane, id: pane.id, size: 50, children: [...pane.children] },
            newChild,
          ];
          pane.sessionId = null;
          return true;
        }
        return pane.children.some(findAndSplit);
      };

      findAndSplit(tab.rootPane);
    }));
  };

  const removePane = (projectId: ProjectId, tabId: TabId, paneId: PaneId) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return;
      const tab = project.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const removeFromParent = (pane: SplitPane): boolean => {
        const idx = pane.children.findIndex((c) => c.id === paneId);
        if (idx !== -1) {
          const remaining = pane.children.filter((c) => c.id !== paneId);
          if (remaining.length === 1 && remaining[0].children.length === 0) {
            pane.sessionId = remaining[0].sessionId;
            pane.direction = null;
            pane.children = [];
          } else {
            pane.children = remaining;
          }
          return true;
        }
        return pane.children.some(removeFromParent);
      };

      removeFromParent(tab.rootPane);
    }));
  };

  const setPaneSession = (projectId: ProjectId, tabId: TabId, paneId: PaneId, sessionId: string) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return;
      const tab = project.tabs.find((t) => t.id === tabId);
      if (!tab) return;

      const findAndSet = (pane: SplitPane): boolean => {
        if (pane.id === paneId) {
          pane.sessionId = sessionId;
          return true;
        }
        return pane.children.some(findAndSet);
      };

      findAndSet(tab.rootPane);
    }));
  };

  const removePaneBySession = (projectId: ProjectId, tabId: TabId, sessionId: string) => {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const tab = project.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const findPaneId = (pane: SplitPane): PaneId | null => {
      if (pane.sessionId === sessionId) return pane.id;
      for (const child of pane.children) {
        const found = findPaneId(child);
        if (found) return found;
      }
      return null;
    };

    const paneId = findPaneId(tab.rootPane);
    if (paneId) removePane(projectId, tabId, paneId);
  };

  const toggleExpand = (projectId: ProjectId) => {
    setState(produce((s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (project) project.expanded = !project.expanded;
    }));
  };

  const clearAll = () => {
    setState({ projects: [], activeProjectId: null });
  };

  const activeProject = () =>
    state.projects.find((p) => p.id === state.activeProjectId);

  const activeTab = () => {
    const project = activeProject();
    if (!project) return null;
    return project.tabs.find((t) => t.id === project.activeTabId) || null;
  };

  return {
    state,
    createProject,
    removeProject,
    setActiveProject,
    addTab,
    removeTab,
    setActiveTab,
    updateProjectName,
    reorderProjects,
    reorderTabs,
    updateTabTitle,
    splitPane,
    removePane,
    removePaneBySession,
    setPaneSession,
    toggleExpand,
    clearAll,
    activeProject,
    activeTab,
  };
}
