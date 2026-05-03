import { createSignal, onMount } from "solid-js";
import { configLoad, configSave } from "../../ipc/commands";
import { updateTerminalSettings } from "../../stores/terminal-settings-store";

export function TerminalSettings() {
  const [fontFamily, setFontFamily] = createSignal("");
  const [fontSize, setFontSize] = createSignal(14);
  const [lineHeight, setLineHeight] = createSignal(1.2);
  const [letterSpacing, setLetterSpacing] = createSignal(0);
  const [padding, setPadding] = createSignal(8);
  const [scrollback, setScrollback] = createSignal(10000);
  const [cursorStyle, setCursorStyle] = createSignal("block");
  const [cursorBlink, setCursorBlink] = createSignal(true);

  onMount(async () => {
    try {
      const config = await configLoad();
      setFontFamily(config.terminal.font_family);
      setFontSize(config.terminal.font_size);
      setLineHeight(config.terminal.line_height);
      setLetterSpacing(config.terminal.letter_spacing);
      setPadding(config.terminal.padding);
      setScrollback(config.terminal.scrollback);
      setCursorStyle(config.terminal.cursor_style);
      setCursorBlink(config.terminal.cursor_blink);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  });

  const saveTerminalSetting = async (key: string, value: any) => {
    try {
      const config = await configLoad();
      (config.terminal as any)[key] = value;
      await configSave(config);
      updateTerminalSettings(config.terminal);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  return (
    <div>
      <div class="settings__section">
        <h3 class="settings__section-title">Font</h3>
        <div class="settings__field">
          <label>Font Family</label>
          <input
            type="text"
            value={fontFamily()}
            onInput={(e) => {
              setFontFamily(e.currentTarget.value);
              saveTerminalSetting("font_family", e.currentTarget.value);
            }}
          />
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
    </div>
  );
}
