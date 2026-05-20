import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { sessionWrite, sessionResize } from "../ipc/commands";
import { onSessionOutput } from "../ipc/events";
import { BUILT_IN_THEMES } from "../themes/terminal-themes";
import type { TerminalSettings } from "../ipc/commands";
import "@xterm/xterm/css/xterm.css";

import fontRegularUrl from "../assets/fonts/JetBrainsMonoNerdFont-Regular.ttf?url";
import fontBoldUrl from "../assets/fonts/JetBrainsMonoNerdFont-Bold.ttf?url";

interface UseTerminalOptions {
  terminalRef: HTMLElement;
  sessionId: string;
  settings?: Partial<TerminalSettings>;
  onTitleChange?: (title: string) => void;
}

let fontsLoaded = false;

async function ensureFontsLoaded(): Promise<void> {
  if (fontsLoaded) return;
  const name = "JetBrainsMono Nerd Font";
  // Check if already loaded
  if (document.fonts.check(`16px "${name}"`)) {
    fontsLoaded = true;
    return;
  }
  try {
    const regular = new FontFace(name, `url(${fontRegularUrl})`, { weight: "400", style: "normal" });
    const bold = new FontFace(name, `url(${fontBoldUrl})`, { weight: "700", style: "normal" });
    const loaded = await Promise.all([regular.load(), bold.load()]);
    for (const font of loaded) {
      document.fonts.add(font);
    }
    fontsLoaded = true;
    console.log("[kterm] Nerd Font loaded successfully");
  } catch (e) {
    console.warn("[kterm] Failed to load bundled Nerd Font:", e);
  }
}

function getDefaultTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  const id = attr === "light" ? "builtin:tokyo-night-light" : "builtin:tokyo-night-dark";
  const theme = BUILT_IN_THEMES.find((t) => t.id === id) ?? BUILT_IN_THEMES[0];
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.cursor,
    selectionBackground: theme.selection_background,
    black: theme.black,
    red: theme.red,
    green: theme.green,
    yellow: theme.yellow,
    blue: theme.blue,
    magenta: theme.magenta,
    cyan: theme.cyan,
    white: theme.white,
    brightBlack: theme.bright_black,
    brightRed: theme.bright_red,
    brightGreen: theme.bright_green,
    brightYellow: theme.bright_yellow,
    brightBlue: theme.bright_blue,
    brightMagenta: theme.bright_magenta,
    brightCyan: theme.bright_cyan,
    brightWhite: theme.bright_white,
  };
}

export function useTerminal(options: UseTerminalOptions) {
  const { terminalRef, sessionId } = options;

  const effectiveTheme = getDefaultTheme();

  const terminal = new Terminal({
    allowProposedApi: true,
    fontFamily: options.settings?.font_family || "'JetBrainsMono Nerd Font', 'JetBrains Mono', Menlo, 'Hiragino Sans', monospace",
    fontSize: options.settings?.font_size || 14,
    scrollback: options.settings?.scrollback || 10000,
    cursorBlink: options.settings?.cursor_blink ?? true,
    cursorStyle: (options.settings?.cursor_style as any) || "block",
    lineHeight: options.settings?.line_height ?? 1.2,
    letterSpacing: options.settings?.letter_spacing ?? 0,
    theme: effectiveTheme,
    macOptionClickForcesSelection: true,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const unicode11Addon = new Unicode11Addon();
  terminal.loadAddon(unicode11Addon);
  terminal.unicode.activeVersion = "11";

  let unlisten: (() => void) | null = null;
  let contextMenuHandler: ((e: Event) => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  let dataDisposable: { dispose: () => void } | null = null;
  let titleDisposable: { dispose: () => void } | null = null;
  let osc52Disposable: { dispose: () => void } | null = null;
  let webglAddon: WebglAddon | null = null;
  let disposed = false;

  const isVisible = () => {
    if (!terminalRef.isConnected) return false;
    const rect = terminalRef.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const fit = () => {
    if (disposed || !terminal.element || !isVisible()) return false;

    try {
      const dims = fitAddon.proposeDimensions();
      if (!dims || dims.cols < 1 || dims.rows < 1) return false;

      if (terminal.cols !== dims.cols || terminal.rows !== dims.rows) {
        terminal.resize(dims.cols, dims.rows);
        sessionResize(sessionId, dims.cols, dims.rows).catch(console.error);
      }
      return true;
    } catch (e) {
      console.warn("[kterm] Skipping terminal fit until layout is ready:", e);
      return false;
    }
  };

  const scheduleFit = (delay = 0) => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      fit();
    }, delay);
  };

  const init = async () => {
    await ensureFontsLoaded();
    if (disposed) return;

    terminal.open(terminalRef);

    // Clipboard handling via Tauri plugin (web Clipboard API doesn't work in Tauri)
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown") return true;
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      // Cmd+V / Ctrl+V: Paste from clipboard
      if (isCmdOrCtrl && e.key === "v") {
        e.preventDefault();
        e.stopPropagation();
        readText().then((text) => {
          if (text) terminal.paste(text);
        }).catch(() => {});
        return false;
      }
      // Cmd+C / Ctrl+C: Copy selection to clipboard (only when there's a selection)
      if (isCmdOrCtrl && e.key === "c" && terminal.hasSelection()) {
        e.preventDefault();
        e.stopPropagation();
        writeText(terminal.getSelection()).catch(() => {});
        return false;
      }
      return true;
    });

    try {
      webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon?.dispose();
        webglAddon = null;
      });
      terminal.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fallback to canvas
    }

    // Handle user input
    dataDisposable = terminal.onData(async (data) => {
      try {
        await sessionWrite(sessionId, data);
      } catch (e) {
        console.error("Failed to write to session:", e);
      }
    });

    // Copy on select
    if (options.settings?.copy_on_select) {
      terminal.onSelectionChange(() => {
        if (terminal.hasSelection()) {
          writeText(terminal.getSelection()).catch(() => {});
        }
      });
    }

    // Right-click to paste
    contextMenuHandler = (e: Event) => {
      e.preventDefault();
      readText().then((text) => {
        if (text) terminal.paste(text);
      }).catch(() => {});
    };
    terminalRef.addEventListener("contextmenu", contextMenuHandler);

    // Title change (OSC 0/2)
    if (options.onTitleChange) {
      titleDisposable = terminal.onTitleChange((title) => {
        options.onTitleChange!(title);
      });
    }

    // OSC 52: clipboard operations from remote applications (zellij, tmux, vim, etc.)
    // Format: \x1b]52;<selection>;<base64>\x07
    osc52Disposable = terminal.parser.registerOscHandler(52, (data) => {
      const semicolonIndex = data.indexOf(";");
      if (semicolonIndex === -1) return true;
      const base64Text = data.substring(semicolonIndex + 1);
      if (!base64Text) return true;
      try {
        const bytes = Uint8Array.from(atob(base64Text), (c) => c.charCodeAt(0));
        const text = new TextDecoder().decode(bytes);
        writeText(text).catch(() => {});
      } catch {
        // Invalid base64, ignore
      }
      return true;
    });

    // Handle session output
    unlisten = await onSessionOutput((payload) => {
      if (payload.session_id !== sessionId) return;
      if (payload.kind.type === "stdout") {
        terminal.write(payload.kind.data);
      } else if (payload.kind.type === "exited") {
        const code = payload.kind.data;
        terminal.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
        if (code === 0) {
          terminalRef.dispatchEvent(new CustomEvent("kterm:session-exit", {
            bubbles: true,
            detail: { sessionId, code },
          }));
        }
      }
    });

    // Resize handling (debounced)
    resizeObserver = new ResizeObserver(() => {
      scheduleFit(100);
    });
    resizeObserver.observe(terminalRef);

    // Initial resize. Restored/inactive tabs may be display:none at this point,
    // so fit is intentionally best-effort and retried when ResizeObserver fires.
    requestAnimationFrame(() => fit());
    scheduleFit(250);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (resizeTimer) clearTimeout(resizeTimer);
    if (contextMenuHandler) terminalRef.removeEventListener("contextmenu", contextMenuHandler);
    resizeObserver?.disconnect();
    dataDisposable?.dispose();
    titleDisposable?.dispose();
    osc52Disposable?.dispose();
    unlisten?.();
    webglAddon?.dispose();
    terminal.dispose();
  };

  return { terminal, fitAddon, init, fit, dispose };
}
