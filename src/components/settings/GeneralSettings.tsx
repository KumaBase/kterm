import { createSignal, onMount } from "solid-js";
import { configLoad, configSave } from "../../ipc/commands";

export function GeneralSettings() {
  const [rememberSize, setRememberSize] = createSignal(true);
  const [rememberPosition, setRememberPosition] = createSignal(false);
  const [tmuxEnabled, setTmuxEnabled] = createSignal(true);
  const [zellijEnabled, setZellijEnabled] = createSignal(true);

  onMount(async () => {
    try {
      const config = await configLoad();
      setRememberSize(config.window.remember_size);
      setRememberPosition(config.window.remember_position);
      setTmuxEnabled(config.tmux_enabled ?? true);
      setZellijEnabled(config.zellij_enabled ?? true);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  });

  const updateConfig = async (key: string, value: any) => {
    try {
      const config = await configLoad();
      if (key === "remember_size") {
        config.window.remember_size = value;
        setRememberSize(value);
      } else if (key === "remember_position") {
        config.window.remember_position = value;
        setRememberPosition(value);
      } else if (key === "tmux_enabled") {
        config.tmux_enabled = value;
        setTmuxEnabled(value);
      } else if (key === "zellij_enabled") {
        config.zellij_enabled = value;
        setZellijEnabled(value);
      }
      await configSave(config);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
  };

  return (
    <div>
      <div class="settings__section">
        <h3 class="settings__section-title">Window</h3>
        <div class="settings__field-row">
          <label>Remember window size</label>
          <div
            class={`settings__toggle ${rememberSize() ? "settings__toggle--active" : ""}`}
            onClick={() => updateConfig("remember_size", !rememberSize())}
          />
        </div>
        <div class="settings__field-row">
          <label>Remember window position</label>
          <div
            class={`settings__toggle ${rememberPosition() ? "settings__toggle--active" : ""}`}
            onClick={() => updateConfig("remember_position", !rememberPosition())}
          />
        </div>
      </div>
      <div class="settings__section">
        <h3 class="settings__section-title">Integrations</h3>
        <div class="settings__field-row">
          <label>tmux integration</label>
          <div
            class={`settings__toggle ${tmuxEnabled() ? "settings__toggle--active" : ""}`}
            onClick={() => updateConfig("tmux_enabled", !tmuxEnabled())}
          />
        </div>
        <div class="settings__field-row">
          <label>Zellij integration</label>
          <div
            class={`settings__toggle ${zellijEnabled() ? "settings__toggle--active" : ""}`}
            onClick={() => updateConfig("zellij_enabled", !zellijEnabled())}
          />
        </div>
      </div>
    </div>
  );
}
