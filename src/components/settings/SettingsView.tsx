import { createSignal } from "solid-js";
import { Modal } from "../common/Modal";
import { GeneralSettings } from "./GeneralSettings";
import { TerminalSettings } from "./TerminalSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import "./SettingsView.css";

type SettingsTab = "general" | "terminal" | "appearance" | "keybindings";

interface SettingsViewProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsView(props: SettingsViewProps) {
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("general");

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "terminal", label: "Terminal" },
    { id: "appearance", label: "Appearance" },
    { id: "keybindings", label: "Keybindings" },
  ];

  return (
    <Modal open={props.open} onClose={props.onClose} title="Settings">
      <div class="settings">
        <div class="settings__sidebar">
          {tabs.map((tab) => (
            <button
              class={`settings__tab ${activeTab() === tab.id ? "settings__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="settings__content">
          {activeTab() === "general" && <GeneralSettings />}
          {activeTab() === "terminal" && <TerminalSettings />}
          {activeTab() === "appearance" && <AppearanceSettings />}
          {activeTab() === "keybindings" && (
            <div class="settings__placeholder">
              <p>Keybindings settings coming soon</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
