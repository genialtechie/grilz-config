import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

// A code-split component that shows `fallback` until its code arrives, then
// swaps at once. React.lazy with <Suspense> does the same job but, once a
// fallback has been on screen, holds the finished screen back until 500 ms
// have passed (so spinners don't flicker). The builder's fallback is its own
// frame with a still of the set, so there is nothing to flicker, and the wait
// would be dead time on a fast connection.
export function loadable<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  let Loaded: ComponentType<P> | null = null;
  let failure: unknown = null;
  let pending: Promise<void> | null = null;
  const start = () =>
    (pending ??= load().then(
      (module) => {
        Loaded = module.default;
      },
      (error) => {
        failure = error ?? new Error('Failed to load');
      },
    ));

  function Loadable({ fallback, ...props }: P & { fallback: ReactNode }) {
    const [, settle] = useState(0);
    useEffect(() => {
      if (Loaded || failure) return;
      let mounted = true;
      void start().then(() => mounted && settle((count) => count + 1));
      return () => {
        mounted = false;
      };
    }, []);
    // A chunk that can't be fetched (a deploy replaced it, or the connection dropped) fails as React.lazy does.
    if (failure) throw failure;
    return Loaded ? <Loaded {...(props as P)} /> : <>{fallback}</>;
  }
  /** Starts the download without rendering anything. */
  Loadable.preload = start;
  return Loadable;
}
