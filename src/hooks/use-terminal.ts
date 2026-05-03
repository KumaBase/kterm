import { onCleanup, onMount } from "solid-js";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sessionWrite, sessionResize } from "../ipc/commands";
import { onSessionOutput } from "../ipc/events";
import { getTerminalTheme } from "../themes/terminal-themes";
import type { TerminalSettings } from "../ipc/commands";
import "@xterm/xterm/css/xterm.css";

interface UseTerminalOptions {
  terminalRef: HTMLElement;
  sessionId: string;
  settings?: Partial<TerminalSettings>;
}

function getEffectiveTheme(): "dark" | "light" {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

export function useTerminal(options: UseTerminalOptions) {
  const { terminalRef, sessionId } = options;

  const effectiveTheme = getEffectiveTheme();

  const terminal = new Terminal({
    fontFamily: options.settings?.font_family || "JetBrains Mono, Menlo, monospace",
    fontSize: options.settings?.font_size || 14,
    scrollback: options.settings?.scrollback || 10000,
    cursorBlink: options.settings?.cursor_blink ?? true,
    cursorStyle: (options.settings?.cursor_style as any) || "block",
    lineHeight: options.settings?.line_height ?? 1.2,
    letterSpacing: options.settings?.letter_spacing ?? 0,
    theme: getTerminalTheme(effectiveTheme),
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  let unlisten: (() => void) | null = null;

  const init = async () => {
    terminal.open(terminalRef);

    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fallback to canvas
    }

    fitAddon.fit();

    // Handle user input
    terminal.onData(async (data) => {
      try {
        await sessionWrite(sessionId, data);
      } catch (e) {
        console.error("Failed to write to session:", e);
      }
    });

    // Handle session output
    unlisten = await onSessionOutput((payload) => {
      if (payload.session_id !== sessionId) return;
      if (payload.kind.type === "stdout") {
        terminal.write(payload.kind.data);
      } else if (payload.kind.type === "exited") {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${payload.kind.data}]\x1b[0m\r\n`);
      }
    });

    // Resize handling
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        sessionResize(sessionId, dims.cols, dims.rows).catch(console.error);
      }
    });
    observer.observe(terminalRef);

    // Initial resize
    const dims = fitAddon.proposeDimensions();
    if (dims) {
      sessionResize(sessionId, dims.cols, dims.rows).catch(console.error);
    }

    onCleanup(() => {
      observer.disconnect();
      unlisten?.();
      terminal.dispose();
    });
  };

  return { terminal, fitAddon, init };
}
