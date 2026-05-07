import { createSignal, onMount } from "solid-js";
import { configLoad, configSave } from "../../ipc/commands";
import { updateTerminalSettings } from "../../stores/terminal-settings-store";
import { FontPickerModal } from "./FontPickerModal";

const BUNDLED_NF = "JetBrainsMono Nerd Font";

const PRESET_FONTS = [
  BUNDLED_NF,
  "JetBrains Mono",
  "Menlo",
  "Monaco",
  "SF Mono",
  "Fira Code",
  "FiraCode Nerd Font",
  "Cascadia Code",
  "CascadiaCode Nerd Font",
  "Hack",
  "Hack Nerd Font",
  "Source Code Pro",
  "MesloLGS Nerd Font",
  "SFMono Nerd Font",
];

export function TerminalSettings() {
  const [fontFamily, setFontFamily] = createSignal("");
  const [fontSelect, setFontSelect] = createSignal("");
  const [customFont, setCustomFont] = createSignal("");
  const [addedFonts, setAddedFonts] = createSignal<string[]>([]);
  const [fontPickerOpen, setFontPickerOpen] = createSignal(false);
  const [fontSize, setFontSize] = createSignal(14);
  const [lineHeight, setLineHeight] = createSignal(1.2);
  const [letterSpacing, setLetterSpacing] = createSignal(0);
  const [padding, setPadding] = createSignal(8);
  const [scrollback, setScrollback] = createSignal(10000);
  const [cursorStyle, setCursorStyle] = createSignal("block");
  const [cursorBlink, setCursorBlink] = createSignal(true);
  const [copyOnSelect, setCopyOnSelect] = createSignal(false);

  const allFonts = () => [...PRESET_FONTS, ...addedFonts()];

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingSaves: Map<string, any> = new Map();

  const resolveSelectValue = (ff: string): string => {
    const primary = ff.split(",")[0].replace(/['"]/g, "").trim();
    if (allFonts().includes(primary)) return primary;
    return "__custom__";
  };

  const applyFont = (font: string) => {
    const value = `'${font}', 'JetBrains Mono', Menlo, monospace`;
    setFontFamily(value);
    setFontSelect(font);
    saveTerminalSetting("font_family", value);
  };

  onMount(async () => {
    try {
      const config = await configLoad();
      setFontFamily(config.terminal.font_family);

      const primary = config.terminal.font_family.split(",")[0].replace(/['"]/g, "").trim();
      if (!PRESET_FONTS.includes(primary) && primary !== "monospace") {
        setAddedFonts([primary]);
      }

      const sv = resolveSelectValue(config.terminal.font_family);
      setFontSelect(sv);
      if (sv === "__custom__") {
        setCustomFont(config.terminal.font_family);
      }
      setFontSize(config.terminal.font_size);
      setLineHeight(config.terminal.line_height);
      setLetterSpacing(config.terminal.letter_spacing);
      setPadding(config.terminal.padding);
      setScrollback(config.terminal.scrollback);
      setCursorStyle(config.terminal.cursor_style);
      setCursorBlink(config.terminal.cursor_blink);
      setCopyOnSelect(config.terminal.copy_on_select);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  });

  const saveTerminalSetting = (key: string, value: any) => {
    // Apply immediately to the UI
    const currentConfig: Record<string, any> = {
      font_family: fontFamily(),
      font_size: fontSize(),
      scrollback: scrollback(),
      cursor_style: cursorStyle(),
      cursor_blink: cursorBlink(),
      copy_on_select: copyOnSelect(),
      line_height: lineHeight(),
      letter_spacing: letterSpacing(),
      padding: padding(),
    };
    currentConfig[key] = value;
    updateTerminalSettings(currentConfig as any);

    pendingSaves.set(key, value);
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const config = await configLoad();
        for (const [k, v] of pendingSaves) {
          (config.terminal as any)[k] = v;
        }
        pendingSaves.clear();
        await configSave(config);
      } catch (e) {
        console.error("Failed to save config:", e);
      }
    }, 300);
  };

  const handleAddSystemFont = (font: string) => {
    if (!allFonts().includes(font)) {
      setAddedFonts((prev) => [...prev, font]);
    }
    applyFont(font);
  };

  return (
    <div>
      <div class="settings__section">
        <h3 class="settings__section-title">Font</h3>
        <div class="settings__field">
          <label>Font Family</label>
          <select
            value={fontSelect()}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setFontSelect(v);
              if (v === "__custom__") {
                setCustomFont(fontFamily());
              } else {
                applyFont(v);
              }
            }}
          >
            {allFonts().map((f) => (
              <option value={f} style={{ "font-family": f }}>
                {f}{f === BUNDLED_NF ? " (bundled)" : ""}
              </option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
          {fontSelect() === "__custom__" && (
            <input
              type="text"
              value={customFont()}
              style={{ "margin-top": "4px" }}
              placeholder="e.g. 'My Font', monospace"
              onInput={(e) => {
                const v = e.currentTarget.value;
                setCustomFont(v);
                setFontFamily(v);
                saveTerminalSetting("font_family", v);
              }}
            />
          )}
        </div>
        <div class="settings__field">
          <button
            class="settings__font-picker-btn"
            onClick={() => setFontPickerOpen(true)}
          >
            + システムフォントを追加...
          </button>
        </div>
        <div class="settings__field">
          <label>Font Size</label>
          <input
            type="number"
            value={fontSize()}
            min="8"
            max="72"
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              setFontSize(v);
              saveTerminalSetting("font_size", v);
            }}
          />
        </div>
      </div>
      <div class="settings__section">
        <h3 class="settings__section-title">Appearance</h3>
        <div class="settings__field">
          <label>Line Height</label>
          <div class="settings__range-row">
            <input
              type="range"
              min="1.0"
              max="2.0"
              step="0.1"
              value={lineHeight()}
              onInput={(e) => {
                const v = parseFloat(e.currentTarget.value);
                setLineHeight(v);
                saveTerminalSetting("line_height", v);
              }}
            />
            <span class="settings__range-value">{lineHeight().toFixed(1)}</span>
          </div>
        </div>
        <div class="settings__field">
          <label>Letter Spacing</label>
          <div class="settings__range-row">
            <input
              type="range"
              min="-5"
              max="20"
              step="1"
              value={letterSpacing()}
              onInput={(e) => {
                const v = parseInt(e.currentTarget.value, 10);
                setLetterSpacing(v);
                saveTerminalSetting("letter_spacing", v);
              }}
            />
            <span class="settings__range-value">{letterSpacing()}px</span>
          </div>
        </div>
        <div class="settings__field">
          <label>Padding</label>
          <div class="settings__range-row">
            <input
              type="range"
              min="0"
              max="32"
              step="2"
              value={padding()}
              onInput={(e) => {
                const v = parseInt(e.currentTarget.value, 10);
                setPadding(v);
                saveTerminalSetting("padding", v);
              }}
            />
            <span class="settings__range-value">{padding()}px</span>
          </div>
        </div>
      </div>
      <div class="settings__section">
        <h3 class="settings__section-title">Cursor</h3>
        <div class="settings__field">
          <label>Cursor Style</label>
          <select
            value={cursorStyle()}
            onChange={(e) => {
              const v = e.currentTarget.value;
              setCursorStyle(v);
              saveTerminalSetting("cursor_style", v);
            }}
          >
            <option value="block">Block</option>
            <option value="underline">Underline</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        <div class="settings__field-row">
          <label>Cursor Blink</label>
          <div
            class={`settings__toggle ${cursorBlink() ? "settings__toggle--active" : ""}`}
            onClick={() => {
              setCursorBlink(!cursorBlink());
              saveTerminalSetting("cursor_blink", !cursorBlink());
            }}
          />
        </div>
      </div>
      <div class="settings__section">
        <h3 class="settings__section-title">Clipboard</h3>
        <div class="settings__field-row">
          <label>Copy on Select</label>
          <div
            class={`settings__toggle ${copyOnSelect() ? "settings__toggle--active" : ""}`}
            onClick={() => {
              const v = !copyOnSelect();
              setCopyOnSelect(v);
              saveTerminalSetting("copy_on_select", v);
            }}
          />
        </div>
      </div>
      <div class="settings__section">
        <h3 class="settings__section-title">Scrollback</h3>
        <div class="settings__field">
          <label>Scrollback Lines</label>
          <input
            type="number"
            value={scrollback()}
            min="0"
            max="1000000"
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              setScrollback(v);
              saveTerminalSetting("scrollback", v);
            }}
          />
        </div>
      </div>
      <FontPickerModal
        open={fontPickerOpen()}
        onClose={() => setFontPickerOpen(false)}
        onSelect={handleAddSystemFont}
      />
    </div>
  );
}
