export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  scrollback: number;
  cursorStyle: "block" | "underline" | "bar";
  cursorBlink: boolean;
}

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface SessionInfo {
  id: string;
  kind: SessionKind;
  title: string;
  created_at: string;
}

export type SessionKind =
  | { type: "Pty" }
  | { type: "Ssh"; host: string; port: number; user: string };

export interface SessionOutput {
  session_id: string;
  kind: SessionOutputKind;
}

export type SessionOutputKind =
  | { type: "stdout"; data: string }
  | { type: "exited"; data: number };
