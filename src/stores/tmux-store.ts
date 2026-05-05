import { createStore } from "solid-js/store";
import {
  tmuxLocalInfo,
  tmuxLocalSessions,
  tmuxLocalWindows,
  tmuxLocalCreate,
  tmuxLocalKill,
  tmuxLocalDetach,
  tmuxLocalNewWindow,
  tmuxLocalKillWindow,
  tmuxLocalRenameWindow,
  tmuxLocalSelectWindow,
  tmuxRemoteExec,
} from "../ipc/tmux-commands";
import type { TmuxSession, TmuxWindow, TmuxInfo } from "../ipc/tmux-commands";

interface RemoteTmuxState {
  sessionId: string;
  host: string;
  sessions: TmuxSession[];
  loading: boolean;
  error: string | null;
}

/** Tracks which kterm tab is attached to which tmux session */
interface TmuxTabState {
  ktermTabId: string;
  sessionId: string; // kterm backend session ID
  tmuxSessionName: string;
  windows: TmuxWindow[];
}

interface TmuxState {
  localInfo: TmuxInfo;
  localSessions: TmuxSession[];
  localWindows: Record<string, TmuxWindow[]>; // sessionName → windows
  remoteStates: RemoteTmuxState[];
  /** Tabs that are in tmux mode */
  tmuxTabs: TmuxTabState[];
  loading: boolean;
  error: string | null;
}

const [state, setState] = createStore<TmuxState>({
  localInfo: { installed: false, double_tmux: false, sessions: [] },
  localSessions: [],
  localWindows: {},
  remoteStates: [],
  tmuxTabs: [],
  loading: false,
  error: null,
});

let pollTimer: ReturnType<typeof setInterval> | null = null;

function parseRemoteSessions(raw: string): TmuxSession[] {
  const sessions: TmuxSession[] = [];
  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 4) {
      sessions.push({
        name: parts[0],
        windows: parseInt(parts[1]) || 0,
        created: parseInt(parts[2]) || 0,
        attached: parts[3] === "1",
      });
    }
  }
  return sessions;
}

export function useTmuxStore() {
  const refreshLocal = async () => {
    setState("loading", true);
    setState("error", null);
    try {
      const info = await tmuxLocalInfo();
      setState("localInfo", info);
      if (info.installed) {
        const sessions = await tmuxLocalSessions();
        setState("localSessions", sessions);
      }
    } catch (e: any) {
      setState("error", e.toString());
    } finally {
      setState("loading", false);
    }
  };

  const loadLocalWindows = async (sessionName: string) => {
    try {
      const windows = await tmuxLocalWindows(sessionName);
      setState("localWindows", sessionName, windows);
    } catch (e: any) {
      console.error("Failed to load windows:", e);
    }
  };

  const createLocalSession = async (name: string) => {
    await tmuxLocalCreate(name);
    await refreshLocal();
  };

  const killLocalSession = async (sessionName: string) => {
    await tmuxLocalKill(sessionName);
    // Remove any tmux tabs for this session
    setState("tmuxTabs", (prev) => prev.filter((t) => t.tmuxSessionName !== sessionName));
    await refreshLocal();
  };

  /** Detach from a tmux session (keeps it alive for resume) */
  const detachLocalSession = async (sessionName: string) => {
    await tmuxLocalDetach(sessionName);
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

      const raw = await tmuxRemoteExec(
        sessionId,
        "tmux list-sessions -F '#{session_name}\t#{session_windows}\t#{session_created}\t#{session_attached}' 2>&1 || echo __NO_SESSIONS__"
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

  // --- Tmux tab mode ---

  /** Register a kterm tab as being in tmux mode */
  const registerTmuxTab = (ktermTabId: string, sessionId: string, tmuxSessionName: string) => {
    setState("tmuxTabs", (prev) => [
      ...prev.filter((t) => t.ktermTabId !== ktermTabId),
      { ktermTabId, sessionId, tmuxSessionName, windows: [] },
    ]);
  };

  const unregisterTmuxTab = (ktermTabId: string) => {
    setState("tmuxTabs", (prev) => prev.filter((t) => t.ktermTabId !== ktermTabId));
  };

  /** Get tmux tab state for a kterm tab */
  const getTmuxTab = (ktermTabId: string): TmuxTabState | undefined => {
    return state.tmuxTabs.find((t) => t.ktermTabId === ktermTabId);
  };

  /** Poll all active tmux tabs for window changes */
  const pollWindows = async () => {
    for (const tab of state.tmuxTabs) {
      try {
        const windows = await tmuxLocalWindows(tab.tmuxSessionName);
        const idx = state.tmuxTabs.findIndex((t) => t.ktermTabId === tab.ktermTabId);
        if (idx >= 0) {
          setState("tmuxTabs", idx, "windows", windows);
        }
      } catch {
        // Session may have been killed
      }
    }
  };

  /** Start polling (every 2 seconds) */
  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(pollWindows, 2000);
  };

  const stopPolling = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  /** Create a new window in a tmux session */
  const createWindow = async (tmuxSessionName: string) => {
    await tmuxLocalNewWindow(tmuxSessionName);
    await pollWindows();
  };

  /** Kill a window in a tmux session */
  const killWindow = async (tmuxSessionName: string, windowIndex: number) => {
    await tmuxLocalKillWindow(tmuxSessionName, windowIndex);
    await pollWindows();
  };

  /** Rename a window in a tmux session */
  const renameWindow = async (tmuxSessionName: string, windowIndex: number, name: string) => {
    await tmuxLocalRenameWindow(tmuxSessionName, windowIndex, name);
    await pollWindows();
  };

  /** Select (switch to) a window in a tmux session */
  const selectWindow = async (tmuxSessionName: string, windowIndex: number) => {
    await tmuxLocalSelectWindow(tmuxSessionName, windowIndex);
    await pollWindows();
  };

  return {
    state,
    refreshLocal,
    loadLocalWindows,
    createLocalSession,
    killLocalSession,
    detachLocalSession,
    refreshRemote,
    removeRemote,
    registerTmuxTab,
    unregisterTmuxTab,
    getTmuxTab,
    startPolling,
    stopPolling,
    createWindow,
    killWindow,
    renameWindow,
    selectWindow,
  };
}
