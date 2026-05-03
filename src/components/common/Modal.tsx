import { JSX, Show } from "solid-js";
import "./Modal.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: JSX.Element;
}

export function Modal(props: ModalProps) {
  const handleBackdrop = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      props.onClose();
    }
  };

  return (
    <Show when={props.open}>
      <div class="modal-backdrop" onClick={handleBackdrop}>
        <div class="modal">
          <Show when={props.title}>
            <div class="modal__header">
              <h3 class="modal__title">{props.title}</h3>
              <button class="modal__close" onClick={props.onClose}>{"\u00D7"}</button>
            </div>
          </Show>
          <div class="modal__body">
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
}
