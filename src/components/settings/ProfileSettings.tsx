import { createSignal, For, Show } from "solid-js";
import { useProfileStore } from "../../stores/profile-store";
import "./ProfileSettings.css";

export function ProfileSettings() {
  const profileStore = useProfileStore();
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [showForm, setShowForm] = createSignal(false);

  // Form state
  const [formName, setFormName] = createSignal("");
  const [formShell, setFormShell] = createSignal("/bin/zsh");
  const [formArgs, setFormArgs] = createSignal("");
  const [formCwd, setFormCwd] = createSignal("");

  const resetForm = () => {
    setFormName("");
    setFormShell("/bin/zsh");
    setFormArgs("");
    setFormCwd("");
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (profile: typeof profileStore.state.profiles[0]) => {
    setFormName(profile.name);
    setFormShell(profile.shell);
    setFormArgs(profile.args.join(" "));
    setFormCwd(profile.cwd ?? "");
    setEditingId(profile.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    const name = formName().trim();
    const shell = formShell().trim();
    if (!name || !shell) return;

    const args = formArgs().trim() ? formArgs().trim().split(/\s+/) : [];
    const cwd = formCwd().trim() || null;

    if (editingId()) {
      await profileStore.editProfile(editingId()!, name, shell, args, cwd, []);
    } else {
      await profileStore.addProfile(name, shell, args, cwd, []);
    }
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await profileStore.removeProfile(id);
    if (editingId() === id) resetForm();
  };

  const handleSetDefault = async (id: string) => {
    await profileStore.setDefault(id);
  };

  return (
    <div>
      <div class="settings__section">
        <div class="profile-settings__header">
          <h3 class="settings__section-title">Shell Profiles</h3>
          <Show when={!showForm()}>
            <button class="profile-settings__add-btn" onClick={() => { resetForm(); setShowForm(true); }}>
              + Add Profile
            </button>
          </Show>
        </div>

        <Show when={showForm()}>
          <div class="profile-settings__form">
            <div class="settings__field">
              <label>Name</label>
              <input
                type="text"
                value={formName()}
                onInput={(e) => setFormName(e.currentTarget.value)}
                placeholder="e.g. Zsh, Bash"
              />
            </div>
            <div class="settings__field">
              <label>Shell Path</label>
              <input
                type="text"
                value={formShell()}
                onInput={(e) => setFormShell(e.currentTarget.value)}
                placeholder="/bin/zsh"
              />
            </div>
            <div class="settings__field">
              <label>Arguments (space-separated)</label>
              <input
                type="text"
                value={formArgs()}
                onInput={(e) => setFormArgs(e.currentTarget.value)}
                placeholder="e.g. -l"
              />
            </div>
            <div class="settings__field">
              <label>Working Directory</label>
              <input
                type="text"
                value={formCwd()}
                onInput={(e) => setFormCwd(e.currentTarget.value)}
                placeholder="Leave empty for home directory"
              />
            </div>
            <div class="profile-settings__form-actions">
              <button class="profile-settings__save-btn" onClick={handleSubmit}>
                {editingId() ? "Update" : "Create"}
              </button>
              <button class="profile-settings__cancel-btn" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </div>
        </Show>

        <div class="profile-settings__list">
          <For each={profileStore.state.profiles}>
            {(profile) => (
              <div class={`profile-settings__item ${profileStore.state.defaultProfileId === profile.id ? "profile-settings__item--default" : ""}`}>
                <div class="profile-settings__item-info">
                  <span class="profile-settings__item-name">
                    {profile.name}
                    <Show when={profileStore.state.defaultProfileId === profile.id}>
                      <span class="profile-settings__default-badge">default</span>
                    </Show>
                  </span>
                  <span class="profile-settings__item-shell">{profile.shell}</span>
                </div>
                <div class="profile-settings__item-actions">
                  <Show when={profileStore.state.defaultProfileId !== profile.id}>
                    <button
                      class="profile-settings__action-btn"
                      onClick={() => handleSetDefault(profile.id)}
                      title="Set as default"
                    >
                      Set Default
                    </button>
                  </Show>
                  <button
                    class="profile-settings__action-btn"
                    onClick={() => startEdit(profile)}
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    class="profile-settings__action-btn profile-settings__action-btn--danger"
                    onClick={() => handleDelete(profile.id)}
                    title="Delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
