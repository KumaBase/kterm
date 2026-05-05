import { createSignal, createEffect, For } from "solid-js";
import { Modal } from "../common/Modal";
import { fontList } from "../../ipc/commands";
import "./FontPickerModal.css";

interface FontPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (fontFamily: string) => void;
}

export function FontPickerModal(props: FontPickerModalProps) {
  const [fonts, setFonts] = createSignal<string[]>([]);
  const [query, setQuery] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);

  createEffect(() => {
    if (props.open && !loaded()) {
      loadFonts();
    }
  });

  const loadFonts = async () => {
    setLoading(true);
    try {
      const list = await fontList();
      console.log("[kterm] System fonts loaded:", list.length);
      setFonts(list);
      setLoaded(true);
    } catch (e) {
      console.error("Failed to load fonts:", e);
    }
    setLoading(false);
  };

  const filtered = () => {
    const q = query().toLowerCase();
    if (!q) return fonts();
    return fonts().filter((f) => f.toLowerCase().includes(q));
  };

  const handleSelect = (font: string) => {
    props.onSelect(font);
    props.onClose();
  };

  return (
    <Modal open={props.open} onClose={props.onClose} title="システムフォントを追加">
      <div class="font-picker">
        <input
          class="font-picker__search"
          type="text"
          placeholder="フォント名で検索..."
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          autofocus
        />
        <div class="font-picker__list">
          {loading() ? (
            <div class="font-picker__loading">読み込み中...</div>
          ) : (
            <For each={filtered()}>
              {(font) => (
                <button
                  class="font-picker__item"
                  style={{ "font-family": `'${font}'` }}
                  onClick={() => handleSelect(font)}
                >
                  {font}
                </button>
              )}
            </For>
          )}
        </div>
      </div>
    </Modal>
  );
}
