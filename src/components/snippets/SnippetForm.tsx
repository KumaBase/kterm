import { createSignal, Show } from "solid-js";
import { Modal } from "../common/Modal";
import type { Snippet } from "../../ipc/snippet-commands";
import "./SnippetForm.css";

interface SnippetFormProps {
  open: boolean;
  snippet?: Snippet;
  onSave: (name: string, content: string, tags: string[]) => void;
  onClose: () => void;
}

export function SnippetForm(props: SnippetFormProps) {
  const [name, setName] = createSignal(props.snippet?.name ?? "");
  const [content, setContent] = createSignal(props.snippet?.content ?? "");
  const [tagsInput, setTagsInput] = createSignal(props.snippet?.tags.join(", ") ?? "");

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const n = name().trim();
    if (!n) return;
    const tags = tagsInput()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    props.onSave(n, content(), tags);
  };

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={props.snippet ? "Edit Snippet" : "New Snippet"}
    >
      <form class="snippet-form" onSubmit={handleSubmit}>
        <label class="snippet-form__field">
          <span class="snippet-form__label">Name</span>
          <input
            class="snippet-form__input"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. SSH to server"
          />
        </label>
        <label class="snippet-form__field">
          <span class="snippet-form__label">Command</span>
          <textarea
            class="snippet-form__textarea"
            value={content()}
            onInput={(e) => setContent(e.currentTarget.value)}
            placeholder="ssh {{user}}@{{host}}"
            rows={5}
          />
        </label>
        <label class="snippet-form__field">
          <span class="snippet-form__label">Tags (comma-separated)</span>
          <input
            class="snippet-form__input"
            type="text"
            value={tagsInput()}
            onInput={(e) => setTagsInput(e.currentTarget.value)}
            placeholder="ssh, deploy, server"
          />
        </label>
        <div class="snippet-form__actions">
          <button class="snippet-form__btn snippet-form__btn--cancel" type="button" onClick={props.onClose}>
            Cancel
          </button>
          <button class="snippet-form__btn snippet-form__btn--save" type="submit">
            <Show when={props.snippet} fallback="Create">
              Update
            </Show>
          </button>
        </div>
      </form>
    </Modal>
  );
}
