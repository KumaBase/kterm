import { Show, For } from "solid-js";
import { TerminalPane } from "./TerminalPane";
import { SplitPaneComponent } from "../common/SplitPane";
import type { SplitPane as SplitPaneType } from "../../types/project";

interface TerminalContainerProps {
  rootPane: SplitPaneType;
}

function PaneRenderer(props: { pane: SplitPaneType }) {
  return (
    <Show
      when={props.pane.children.length > 0}
      fallback={<TerminalPane sessionId={props.pane.sessionId ?? undefined} />}
    >
      <SplitPaneComponent direction={props.pane.direction || "horizontal"}>
        <For each={props.pane.children}>
          {(child) => <PaneRenderer pane={child} />}
        </For>
      </SplitPaneComponent>
    </Show>
  );
}

export function TerminalContainer(props: TerminalContainerProps) {
  return (
    <div class="terminal-container" style={{ width: "100%", height: "100%" }}>
      <PaneRenderer pane={props.rootPane} />
    </div>
  );
}
