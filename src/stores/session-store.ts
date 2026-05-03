import { createStore } from "solid-js/store";
import { ptySpawn, sessionKill as killSession, sessionList as fetchSessionList } from "../ipc/commands";
import type { SessionInfo } from "../ipc/commands";

interface SessionState {
  sessions: Record<string, SessionInfo>;
  activeSessionId: string | null;
}

const [state, setState] = createStore<SessionState>({
  sessions: {},
  activeSessionId: null,
});

export function useSessionStore() {
  const createSession = async (shell?: string, cwd?: string) => {
    const session = await ptySpawn(shell, cwd, 80, 24);
    setState("sessions", session.id, session);
    setState("activeSessionId", session.id);
    return session;
  };

  const removeSession = async (sessionId: string) => {
    try {
      await killSession(sessionId);
    } catch (e) {
      console.error("Failed to kill session:", e);
    }
    const sessions = { ...state.sessions };
    delete sessions[sessionId];
    setState("sessions", sessions);
    if (state.activeSessionId === sessionId) {
      const remaining = Object.keys(sessions);
      setState("activeSessionId", remaining.length > 0 ? remaining[0] : null);
    }
  };

  const setActive = (sessionId: string) => {
    setState("activeSessionId", sessionId);
  };

  const activeSession = () =>
    state.activeSessionId ? state.sessions[state.activeSessionId] : null;

  const sessionList = () => Object.values(state.sessions);

  const clearAll = () => {
    setState({ sessions: {}, activeSessionId: null });
  };

  const restoreFromBackend = async (): Promise<SessionInfo[]> => {
    try {
      const sessions = await fetchSessionList();
      if (sessions.length > 0) {
        const map: Record<string, SessionInfo> = {};
        for (const s of sessions) map[s.id] = s;
        setState({ sessions: map, activeSessionId: sessions[0].id });
      }
      return sessions;
    } catch {
      return [];
    }
  };

  return {
    state,
    createSession,
    removeSession,
    setActive,
    activeSession,
    sessionList,
    clearAll,
    restoreFromBackend,
  };
}
