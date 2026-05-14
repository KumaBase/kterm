import { onMount, onCleanup, createEffect } from "solid-js";
import { useTerminal } from "../../hooks/use-terminal";
import { useTerminalSettingsStore } from "../../stores/terminal-settings-store";
import { useColorThemeStore } from "../../stores/color-theme-store";

interface XtermAdapterProps {
  sessionId: string;
  onTitleChange?: (title: string) => void;
}

export function XtermAdapter(props: XtermAdapterProps) {
  let containerRef!: HTMLDivElement;
  const { settings } = useTerminalSettingsStore();
  const colorThemeStore = useColorThemeStore();

  let terminalRef: ReturnType<typeof useTerminal> | null = null;

  onCleanup(() => {
    terminalRef?.dispose();
    terminalRef = null;
  });

  onMount(async () => {
    try {
      const t = useTerminal({
        terminalRef: containerRef,
        sessionId: props.sessionId,
        settings: settings(),
        onTitleChange: props.onTitleChange,
      });
      terminalRef = t;
      await t.init();
      if (terminalRef !== t) return;

      // Apply initial padding and background
      const padding = settings();
      containerRef.style.padding = `${padding.padding}px`;
      containerRef.style.boxSizing = "border-box";
      containerRef.style.backgroundColor = colorThemeStore.activeBackground();
      t.fit();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[kterm] Terminal init failed:", e);
      terminalRef?.dispose();
      terminalRef = null;
      containerRef.textContent = `Terminal initialization failed: ${msg}`;
      containerRef.style.color = "var(--text-muted)";
      containerRef.style.padding = "16px";
      containerRef.style.fontSize = "13px";
      return;
    }
  });

  // Reactive: update terminal when settings or color theme changes
  createEffect(() => {
    const s = settings();
    const xtermTheme = colorThemeStore.activeXtermTheme();
    const bgColor = colorThemeStore.activeBackground();
    if (!terminalRef) return;
    const { terminal } = terminalRef;

    terminal.options.fontSize = s.font_size;
    terminal.options.fontFamily = s.font_family;
    terminal.options.lineHeight = s.line_height;
    terminal.options.letterSpacing = s.letter_spacing;
    terminal.options.scrollback = s.scrollback;
    terminal.options.cursorStyle = s.cursor_style as any;
    terminal.options.cursorBlink = s.cursor_blink;
    terminal.options.theme = xtermTheme;

    containerRef.style.padding = `${s.padding}px`;
    containerRef.style.backgroundColor = bgColor;
    terminalRef.fit();
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
