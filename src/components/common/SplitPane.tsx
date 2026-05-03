import { createSignal, onMount, JSX } from "solid-js";
import "./SplitPane.css";

interface SplitPaneProps {
  direction: "horizontal" | "vertical";
  children: JSX.Element[];
  onResize?: (sizes: number[]) => void;
  initialSizes?: number[];
}

export function SplitPaneComponent(props: SplitPaneProps) {
  const [sizes, setSizes] = createSignal<number[]>(props.initialSizes || []);
  let containerRef!: HTMLDivElement;
  let dragging = false;
  let dragIndex = -1;
  let startPos = 0;
  let startSizes: number[] = [];

  const getPos = (e: MouseEvent) =>
    props.direction === "horizontal" ? e.clientX : e.clientY;

  const getSize = () =>
    props.direction === "horizontal"
      ? containerRef.getBoundingClientRect().width
      : containerRef.getBoundingClientRect().height;

  const handleMouseDown = (index: number, e: MouseEvent) => {
    e.preventDefault();
    dragging = true;
    dragIndex = index;
    startPos = getPos(e);
    startSizes = [...sizes()];

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const diff = getPos(e) - startPos;
      const totalSize = getSize();
      const percentDiff = (diff / totalSize) * 100;

      const newSizes = [...startSizes];
      const minSize = 5;
      const proposed = newSizes[dragIndex] + percentDiff;
      const other = newSizes[dragIndex + 1] - percentDiff;

      if (proposed >= minSize && other >= minSize) {
        newSizes[dragIndex] = proposed;
        newSizes[dragIndex + 1] = other;
        setSizes(newSizes);
        props.onResize?.(newSizes);
      }
    };

    const handleMouseUp = () => {
      dragging = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  onMount(() => {
    const count = props.children.length;
    if (sizes().length === 0) {
      setSizes(Array(count).fill(100 / count));
    }
  });

  return (
    <div
      ref={containerRef}
      class={`split-pane split-pane--${props.direction}`}
    >
      {props.children.map((child, index) => (
        <>
          <div
            class="split-pane__child"
            style={{
              [props.direction === "horizontal" ? "width" : "height"]: `${sizes()[index] || 100 / props.children.length}%`,
            }}
          >
            {child}
          </div>
          {index < props.children.length - 1 && (
            <div
              class={`split-pane__divider split-pane__divider--${props.direction}`}
              onMouseDown={(e) => handleMouseDown(index, e)}
            />
          )}
        </>
      ))}
    </div>
  );
}
