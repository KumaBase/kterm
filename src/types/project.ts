export type ProjectId = string;
export type TabId = string;
export type PaneId = string;

export interface Project {
  id: ProjectId;
  name: string;
  tabs: Tab[];
  activeTabId: TabId | null;
  expanded: boolean;
}

export interface Tab {
  id: TabId;
  title: string;
  rootPane: SplitPane;
  sessionId: string | null;
}

export type PaneLayout = "horizontal" | "vertical";

export interface SplitPane {
  id: PaneId;
  direction: PaneLayout | null;
  children: SplitPane[];
  sessionId: string | null;
  size: number;
}

export interface CreateProjectParams {
  name?: string;
}

export interface CreateTabParams {
  projectId: ProjectId;
  title?: string;
}

export interface SplitPaneParams {
  projectId: ProjectId;
  tabId: TabId;
  paneId: PaneId;
  direction: PaneLayout;
  sessionId: string;
}
