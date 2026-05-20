import { createStore } from "solid-js/store";
import {
  zellijLocalInfo,
  zellijLocalSessions,
  zellijLocalTabs,
  zellijLocalCreate,
  zellijLocalKill,
  zellijLocalNewTab,
  zellijLocalCloseTab,
  zellijLocalGoToTab,
  zellijRemoteExec,
} from "../ipc/zellij-commands";
import { sessionWrite } from "../ipc/commands";
import type { ZellijSession, ZellijTab, ZellijInfo } from "../ipc/zellij-commands";

interface RemoteZellijState {
  sessionId: string;
  host: string;
  sessions: ZellijSession[];
  loading: boolean;
  error: string | null;
}

/** Tracks which kterm tab is attached to which zellij session */
interface ZellijTabState {
  ktermTabId: string;
  sessionId: string; // kterm backend session ID (PTY for local, SSH for remote)
  zellijSessionName: string;
  tabs: ZellijTab[];
  isRemote: boolean; // true for SSH-based zellij
}

interface ZellijState {
  localInfo: ZellijInfo;
  localSessions: ZellijSession[];
  remoteStates: RemoteZellijState[];
  /** Tabs that are in zellij mode */
  zellijTabs: ZellijTabState[];
  loading: boolean;
  error: string | null;
}

const [state, setState] = createStore<ZellijState>({
  localInfo: { installed: false, sessions: [] },
  localSessions: [],
  remoteStates: [],
  zellijTabs: [],
  loading: false,
  error: null,
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function parseRemoteSessions(raw: string): ZellijSession[] {
  const sessions: ZellijSession[] = [];
  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    const attached = line.includes("(Attached)") || line.includes("[Attached]");
    const name = line.trim().split(/\s+/)[0];
    if (name) {
      sessions.push({
        name,
        tabs: 0,
        created: "",
        attached,
      });
    }
  }
  return sessions;
}

function parseRemoteTabs(raw: string): ZellijTab[] {
  try {
    const parsed = JSON.parse(raw.trim());
    return parsed.map((t: any) => ({
      position: t.position,
      name: t.name,
      active: t.active,
    }));
  } catch {
    return [];
  }
}

export function useZellijStore() {
  const refreshLocal = async () => {
    setState("loading", true);
    setState("error", null);
    try {
      const info = await zellijLocalInfo();
      setState("localInfo", info);
      if (info.installed) {
        const sessions = await zellijLocalSessions();
        setState("localSessions", sessions);
      }
    } catch (e: any) {
      setState("error", e.toString());
    } finally {
      setState("loading", false);
    }
  };

  const createLocalSession = async (name: string) => {
    await zellijLocalCreate(name);
    await refreshLocal();
  };

  const killLocalSession = async (sessionName: string) => {
    await zellijLocalKill(sessionName);
    // Remove any zellij tabs for this session
    setState("zellijTabs", (prev) => prev.filter((t) => t.zellijSessionName !== sessionName));
    await refreshLocal();
  };

  const refreshRemote = async (sessionId: string, host: string) => {
    const idx = state.remoteStates.findIndex((r) => r.sessionId === sessionId);
    try {
      if (idx >= 0) {
        setState("remoteStates", idx, "loading", true);
      } else {
        setState("remoteStates", (prev) => [
          ...prev,
          { sessionId, host, sessions: [], loading: true, error: null },
        ]);
      }

      const raw = await zellijRemoteExec(
        sessionId,
        "zellij list-sessions -n 2>&1 || echo __NO_SESSIONS__"
      );

      const sessions = raw.includes("__NO_SESSIONS__")
        ? []
        : parseRemoteSessions(raw);

      const currentIdx = state.remoteStates.findIndex(
        (r) => r.sessionId === sessionId
      );
      if (currentIdx >= 0) {
        setState("remoteStates", currentIdx, {
          sessions,
          loading: false,
          error: null,
        });
      }
    } catch (e: any) {
      const currentIdx = state.remoteStates.findIndex(
        (r) => r.sessionId === sessionId
      );
      if (currentIdx >= 0) {
        setState("remoteStates", currentIdx, {
          loading: false,
          error: e.toString(),
        });
      }
    }
  };

  const removeRemote = (sessionId: string) => {
    setState("remoteStates", (prev) =>
      prev.filter((r) => r.sessionId !== sessionId)
    );
  };

  // --- Zellij tab mode ---

  /** Register a kterm tab as being in zellij mode */
  const registerZellijTab = (ktermTabId: string, sessionId: string, zellijSessionName: string, isRemote = false) => {
    setState("zellijTabs", (prev) => [
      ...prev.filter((t) => t.ktermTabId !== ktermTabId),
      { ktermTabId, sessionId, zellijSessionName, tabs: [], isRemote },
    ]);
  };

  const unregisterZellijTab = (ktermTabId: string) => {
    setState("zellijTabs", (prev) => {
      const remaining = prev.filter((t) => t.ktermTabId !== ktermTabId);
      if (remaining.length === 0) stopPolling();
      return remaining;
    });
  };

  /** Get zellij tab state for a kterm tab */
  const getZellijTab = (ktermTabId: string): ZellijTabState | undefined => {
    return state.zellijTabs.find((t) => t.ktermTabId === ktermTabId);
  };

  /** Send zellij detach key sequence (Ctrl+O then d) to the PTY */
  const detachSession = async (ktermTabId: string) => {
    const tab = state.zellijTabs.find((t) => t.ktermTabId === ktermTabId);
    if (!tab) return;
    try {
      await sessionWrite(tab.sessionId, "\x0f"); // Ctrl+O (default zellij prefix)
      await new Promise((r) => setTimeout(r, 50));
      await sessionWrite(tab.sessionId, "d"); // detach
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // PTY may already be gone
    }
  };

  /** Poll all active zellij tabs for tab changes and detect session loss */
  const pollTabs = async () => {
    const toRemove: string[] = [];
    for (const tab of state.zellijTabs) {
      try {
        let tabs: ZellijTab[];
        if (tab.isRemote) {
          const raw = await zellijRemoteExec(
            tab.sessionId,
            `ZELLIJ_SESSION_NAME='${tab.zellijSessionName.replace(/'/g, "'\\''")}' zellij action list-tabs --json 2>/dev/null`
          );
          tabs = parseRemoteTabs(raw);
        } else {
          tabs = await zellijLocalTabs(tab.zellijSessionName);
        }
        const idx = state.zellijTabs.findIndex((t) => t.ktermTabId === tab.ktermTabId);
        if (idx >= 0) {
          setState("zellijTabs", idx, "tabs", tabs);
        }
      } catch {
        // Session no longer exists — auto-unregister
        toRemove.push(tab.ktermTabId);
      }
    }
    // Auto-unregister tabs whose zellij sessions have been killed
    for (const id of toRemove) {
      unregisterZellijTab(id);
    }
  };

  /** Start polling (every 2 seconds) */
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(pollTabs, 2000);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  /** Create a new tab in a zellij session */
  const createTab = async (zellijSessionName: string) => {
    const tab = state.zellijTabs.find((t) => t.zellijSessionName === zellijSessionName);
    if (tab?.isRemote) {
      await zellijRemoteExec(tab.sessionId, `ZELLIJ_SESSION_NAME='${zellijSessionName.replace(/'/g, "'\\''")}' zellij action new-tab`);
    } else {
      await zellijLocalNewTab(zellijSessionName);
    }
    await pollTabs();
  };

  /** Close a tab in a zellij session */
  const closeTab = async (zellijSessionName: string, tabPosition: number) => {
    const tab = state.zellijTabs.find((t) => t.zellijSessionName === zellijSessionName);
    if (tab?.isRemote) {
      await zellijRemoteExec(tab.sessionId, `ZELLIJ_SESSION_NAME='${zellijSessionName.replace(/'/g, "'\\''")}' zellij action close-tab`);
    } else {
      await zellijLocalCloseTab(zellijSessionName, tabPosition);
    }
    await pollTabs();
  };

  /** Select (switch to) a tab in a zellij session */
  const selectTab = async (zellijSessionName: string, tabPosition: number) => {
    const tab = state.zellijTabs.find((t) => t.zellijSessionName === zellijSessionName);
    if (tab?.isRemote) {
      await zellijRemoteExec(tab.sessionId, `ZELLIJ_SESSION_NAME='${zellijSessionName.replace(/'/g, "'\\''")}' zellij action go-to-tab ${tabPosition}`);
    } else {
      await zellijLocalGoToTab(zellijSessionName, tabPosition);
    }
    await pollTabs();
  };

  return {
    state,
    refreshLocal,
    createLocalSession,
    killLocalSession,
    refreshRemote,
    removeRemote,
    registerZellijTab,
    unregisterZellijTab,
    getZellijTab,
    detachSession,
    startPolling,
    stopPolling,
    createTab,
    closeTab,
    selectTab,
  };
}
