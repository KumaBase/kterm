import { onMount, onCleanup, createEffect } from "solid-js";
import { useTerminal } from "../../hooks/use-terminal";
import { useTerminalSettingsStore } from "../../stores/terminal-settings-store";
import { getTerminalTheme, getTerminalBackground } from "../../themes/terminal-themes";

interface XtermAdapterProps {
  sessionId: string;
}

function getEffectiveTheme(): "dark" | "light" {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function XtermAdapter(props: XtermAdapterProps) {
  let containerRef!: HTMLDivElement;
  const { settings } = useTerminalSettingsStore();

  let terminalRef: ReturnType<typeof useTerminal> | null = null;

  onMount(async () => {
    const t = useTerminal({
      terminalRef: containerRef,
      sessionId: props.sessionId,
    });
    terminalRef = t;
    await t.init();

    // Apply initial padding
    const padding = settings().padding;
    containerRef.style.padding = `${padding}px`;
    containerRef.style.boxSizing = "border-box";
    containerRef.style.backgroundColor = getTerminalBackground(getEffectiveTheme());
    t.fitAddon.fit();

    // Watch for theme attribute changes via MutationObserver
    const observer = new MutationObserver(() => {
      if (terminalRef) {
        const theme = getEffectiveTheme();
        terminalRef.terminal.options.theme = getTerminalTheme(theme);
        containerRef.style.backgroundColor = getTerminalBackground(theme);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    onCleanup(() => observer.disconnect());
  });

  // Reactive settings updates
  createEffect(() => {
    const s = settings();
    if (!terminalRef) return;
    const { terminal, fitAddon } = terminalRef;

    terminal.options.fontSize = s.font_size;
    terminal.options.fontFamily = s.font_family;
    terminal.options.lineHeight = s.line_height;
    terminal.options.letterSpacing = s.letter_spacing;
    terminal.options.scrollback = s.scrollback;
    terminal.options.cursorStyle = s.cursor_style as any;
    terminal.options.cursorBlink = s.cursor_blink;
    terminal.options.theme = getTerminalTheme(getEffectiveTheme());

    containerRef.style.padding = `${s.padding}px`;
    containerRef.style.backgroundColor = getTerminalBackground(getEffectiveTheme());
    fitAddon.fit();
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        "background-color": "#1a1b26",
        "box-sizing": "border-box",
      }}
    />
  );
}
