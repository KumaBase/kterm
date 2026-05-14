import { Show, For } from "solid-js";
import { TerminalPane } from "./TerminalPane";
import { SplitPaneComponent } from "../common/SplitPane";
import type { SplitPane as SplitPaneType } from "../../types/project";

interface TerminalContainerProps {
  rootPane: SplitPaneType;
  onTitleChange?: (sessionId: string, title: string) => void;
}

function PaneRenderer(props: { pane: SplitPaneType; onTitleChange?: (sessionId: string, title: string) => void }) {
  return (
    <Show
      when={props.pane.children.length > 0}
      fallback={<TerminalPane sessionId={props.pane.sessionId ?? undefined} onTitleChange={props.onTitleChange} />}
    >
      <SplitPaneComponent direction={props.pane.direction || "horizontal"}>
        <For each={props.pane.children}>
          {(child) => <PaneRenderer pane={child} onTitleChange={props.onTitleChange} />}
        </For>
      </SplitPaneComponent>
    </Show>
  );
}

export function TerminalContainer(props: TerminalContainerProps) {
  return (
    <div class="terminal-container" style={{ width: "100%", height: "100%" }}>
      <PaneRenderer pane={props.rootPane} onTitleChange={props.onTitleChange} />
    </div>
  );
}
