import { createStore } from "solid-js/store";
import { ptySpawn, sessionKill as killSession, sessionList as fetchSessionList, sessionWrite } from "../ipc/commands";
import type { SessionInfo } from "../ipc/commands";
import type { ShellProfile } from "../ipc/profile-commands";

interface SessionState {
  sessions: Record<string, SessionInfo>;
  activeSessionId: string | null;
}

const [state, setState] = createStore<SessionState>({
  sessions: {},
  activeSessionId: null,
});

export function useSessionStore() {
  const createSession = async (shell?: string, args?: string[], cwd?: string, env?: [string, string][]) => {
    const session = await ptySpawn(shell, args, cwd, 80, 24, env);
    setState("sessions", session.id, session);
    setState("activeSessionId", session.id);
    return session;
  };

  const createSessionFromProfile = async (profile: ShellProfile) => {
    const cwd = profile.cwd ?? undefined;
    const env = profile.env.length > 0 ? profile.env as [string, string][] : undefined;
    const args = profile.args.length > 0 ? profile.args : undefined;
    return createSession(profile.shell, args, cwd, env);
  };

  const removeSession = async (sessionId: string) => {
    // Backend may already be gone (natural exit) — that's fine
    try { await killSession(sessionId); } catch {}
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

  const writeToSession = async (sessionId: string, data: string) => {
    await sessionWrite(sessionId, data);
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
    createSessionFromProfile,
    removeSession,
    setActive,
    activeSession,
    sessionList,
    clearAll,
    writeToSession,
    restoreFromBackend,
  };
}
