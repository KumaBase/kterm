import { onCleanup, onMount } from "solid-js";

export interface KeyBinding {
  key: string;
  modifiers: string[];
  action: string;
}

export function useKeyboard(
  bindings: Record<string, (e: KeyboardEvent) => void>
) {
  const handler = (e: KeyboardEvent) => {
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push("CmdOrCtrl");
    if (e.shiftKey) parts.push("Shift");
    if (e.altKey) parts.push("Alt");
    parts.push(e.key.toLowerCase());

    const combo = parts.join("+");

    if (bindings[combo]) {
      e.preventDefault();
      bindings[combo](e);
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handler);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handler);
  });
}
