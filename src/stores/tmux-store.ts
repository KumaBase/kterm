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
  sessionId: string; // kterm backend session ID (PTY for local, SSH for remote)
  tmuxSessionName: string;
  windows: TmuxWindow[];
  isRemote: boolean; // true for SSH-based tmux
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

function parseRemoteWindows(raw: string): TmuxWindow[] {
  const windows: TmuxWindow[] = [];
  for (const line of raw.trim().split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 3) {
      windows.push({
        index: parseInt(parts[0]) || 0,
        name: parts[1],
        active: parts[2] === "1",
      });
    }
  }
  return windows;
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

  /** Detach from a remote tmux session via SSH exec */
  const detachRemoteSession = async (sessionId: string, sessionName: string) => {
    await tmuxRemoteExec(sessionId, `tmux detach-client -t '${sessionName.replace(/'/g, "'\\''")}' 2>/dev/null || true`);
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
  const registerTmuxTab = (ktermTabId: string, sessionId: string, tmuxSessionName: string, isRemote = false) => {
    setState("tmuxTabs", (prev) => [
      ...prev.filter((t) => t.ktermTabId !== ktermTabId),
      { ktermTabId, sessionId, tmuxSessionName, windows: [], isRemote },
    ]);
  };

  const unregisterTmuxTab = (ktermTabId: string) => {
    setState("tmuxTabs", (prev) => {
      const remaining = prev.filter((t) => t.ktermTabId !== ktermTabId);
      if (remaining.length === 0) stopPolling();
      return remaining;
    });
  };

  /** Get tmux tab state for a kterm tab */
  const getTmuxTab = (ktermTabId: string): TmuxTabState | undefined => {
    return state.tmuxTabs.find((t) => t.ktermTabId === ktermTabId);
  };

  /** Poll all active tmux tabs for window changes */
  const pollWindows = async () => {
    for (const tab of state.tmuxTabs) {
      try {
        let windows: TmuxWindow[];
        if (tab.isRemote) {
          const raw = await tmuxRemoteExec(
            tab.sessionId,
            `tmux list-windows -t '${tab.tmuxSessionName.replace(/'/g, "'\\''")}' -F '#{window_index}\\t#{window_name}\\t#{window_active}' 2>/dev/null`
          );
          windows = parseRemoteWindows(raw);
        } else {
          windows = await tmuxLocalWindows(tab.tmuxSessionName);
        }
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
    const tab = state.tmuxTabs.find((t) => t.tmuxSessionName === tmuxSessionName);
    if (tab?.isRemote) {
      await tmuxRemoteExec(tab.sessionId, `tmux new-window -t '${tmuxSessionName.replace(/'/g, "'\\''")}'`);
    } else {
      await tmuxLocalNewWindow(tmuxSessionName);
    }
    await pollWindows();
  };

  /** Kill a window in a tmux session */
  const killWindow = async (tmuxSessionName: string, windowIndex: number) => {
    const tab = state.tmuxTabs.find((t) => t.tmuxSessionName === tmuxSessionName);
    if (tab?.isRemote) {
      await tmuxRemoteExec(tab.sessionId, `tmux kill-window -t '${tmuxSessionName.replace(/'/g, "'\\''")}:${windowIndex}'`);
    } else {
      await tmuxLocalKillWindow(tmuxSessionName, windowIndex);
    }
    await pollWindows();
  };

  /** Rename a window in a tmux session */
  const renameWindow = async (tmuxSessionName: string, windowIndex: number, name: string) => {
    const tab = state.tmuxTabs.find((t) => t.tmuxSessionName === tmuxSessionName);
    if (tab?.isRemote) {
      await tmuxRemoteExec(tab.sessionId, `tmux rename-window -t '${tmuxSessionName.replace(/'/g, "'\\''")}:${windowIndex}' '${name.replace(/'/g, "'\\''")}'`);
    } else {
      await tmuxLocalRenameWindow(tmuxSessionName, windowIndex, name);
    }
    await pollWindows();
  };

  /** Select (switch to) a window in a tmux session */
  const selectWindow = async (tmuxSessionName: string, windowIndex: number) => {
    const tab = state.tmuxTabs.find((t) => t.tmuxSessionName === tmuxSessionName);
    if (tab?.isRemote) {
      await tmuxRemoteExec(tab.sessionId, `tmux select-window -t '${tmuxSessionName.replace(/'/g, "'\\''")}:${windowIndex}'`);
    } else {
      await tmuxLocalSelectWindow(tmuxSessionName, windowIndex);
    }
    await pollWindows();
  };

  return {
    state,
    refreshLocal,
    loadLocalWindows,
    createLocalSession,
    killLocalSession,
    detachLocalSession,
    detachRemoteSession,
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
