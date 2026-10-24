import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown instead of the children once one of them has thrown. */
  fallback: ReactNode;
};

type State = { failed: boolean };

/** Catches a render-time throw from the subtree — in practice a lazily
 * imported chunk that failed to load, after a deploy swapped the file out
 * from under a long-open tab.
 *
 * A class, unlike everything else here: React has no hook equivalent, and a
 * `lazy()` import rejecting can't be caught with try/catch around the JSX.
 * Without this, a missing chunk takes the whole page down rather than the one
 * panel that needed it. */
export class LazyChunkBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lazy chunk failed to render", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
