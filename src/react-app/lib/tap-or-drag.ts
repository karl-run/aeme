import { useRef } from "react";

/** Lets a grid cell support mouse drag-select without hijacking touch
 * scrolling.
 *
 * Acting on `pointerdown` is what makes drag-select work, but on a touch
 * screen `pointerdown` also fires at the start of a pan — so swiping
 * sideways across a scrollable grid selects whatever happens to be under the
 * finger. Touch therefore waits for `click`, which the browser only fires
 * when the gesture didn't turn into a scroll, and which is all a touch user
 * needs anyway since there's no drag-select on a phone.
 *
 * Mouse and pen keep acting on `pointerdown` and must ignore the `click`
 * that follows, or they'd toggle twice. */
export const useTapOrDrag = () => {
  const pointerTypeRef = useRef("mouse");

  return {
    /** Call from `onPointerDown`: true when this pointer should act now and
     * may start a drag. False for touch, which defers to `onClick`. */
    beginsDrag: (event: { pointerType: string }) => {
      pointerTypeRef.current = event.pointerType;
      return event.pointerType !== "touch";
    },
    /** Call from `onClick`: true for touch, which deferred to this, and for
     * keyboard activation, which fires a click with no pointer event before
     * it (`detail` 0). False for mouse and pen, which already acted on
     * `pointerdown`. */
    handlesClick: (event?: { detail: number }) =>
      pointerTypeRef.current === "touch" || event?.detail === 0,
  };
};
