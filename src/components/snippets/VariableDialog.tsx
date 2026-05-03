import { For, createSignal } from "solid-js";
import { Modal } from "../common/Modal";
import "./VariableDialog.css";

interface VariableDialogProps {
  open: boolean;
  variables: string[];
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}

export function VariableDialog(props: VariableDialogProps) {
  const initialValues: Record<string, string> = {};
  for (const v of props.variables) {
    initialValues[v] = "";
  }
  const [values, setValues] = createSignal<Record<string, string>>(initialValues);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    props.onSubmit(values());
  };

  return (
    <Modal open={props.open} onClose={props.onCancel} title="Fill Variables">
      <form class="var-dialog__form" onSubmit={handleSubmit}>
        <For each={props.variables}>
          {(variable) => (
            <label class="var-dialog__field">
              <span class="var-dialog__label">{variable}</span>
              <input
                class="var-dialog__input"
                type="text"
                value={values()[variable]}
                onInput={(e) =>
                  setValues((prev) => ({ ...prev, [variable]: e.currentTarget.value }))
                }
                placeholder={variable}
                autofocus
              />
            </label>
          )}
        </For>
        <div class="var-dialog__actions">
          <button class="var-dialog__btn var-dialog__btn--cancel" type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button class="var-dialog__btn var-dialog__btn--submit" type="submit">
            Insert
          </button>
        </div>
      </form>
    </Modal>
  );
}
