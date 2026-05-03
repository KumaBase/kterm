import { listen } from "@tauri-apps/api/event";

export interface SessionOutputPayload {
  session_id: string;
  kind: SessionOutputKind;
}

export type SessionOutputKind =
  | { type: "stdout"; data: string }
  | { type: "exited"; data: number };

export function onSessionOutput(
  callback: (payload: SessionOutputPayload) => void
) {
  return listen<SessionOutputPayload>("session:output", (event) => {
    callback(event.payload);
  });
}
