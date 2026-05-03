import { Show } from "solid-js";
import { XtermAdapter } from "./XtermAdapter";
import "./TerminalPane.css";

interface TerminalPaneProps {
  sessionId?: string;
}

export function TerminalPane(props: TerminalPaneProps) {
  return (
    <div class="terminal-pane">
      <Show
        when={props.sessionId}
        fallback={
          <div class="terminal-pane__empty">
            <p>No active session</p>
          </div>
        }
      >
        <XtermAdapter sessionId={props.sessionId!} />
      </Show>
    </div>
  );
}
