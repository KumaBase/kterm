export interface SessionOutputEvent {
  event: string;
  payload: SessionOutputPayload;
}

export interface SessionOutputPayload {
  session_id: string;
  kind: SessionOutputKind;
}

export type SessionOutputKind =
  | { type: "stdout"; data: string }
  | { type: "exited"; data: number };
